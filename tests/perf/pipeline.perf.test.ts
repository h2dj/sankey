import { expect, test } from 'vitest';
import { buildGraph } from '../../src/core/buildGraph';
import { DEFAULT_SETTINGS } from '../../src/core/config';
import { computeLayout, suggestHeight } from '../../src/core/layout';
import type { Row } from '../../src/core/types';

/**
 * T1.6: 행 수별 검증 → 그래프 → 레이아웃 시간(중앙값).
 * 5단계 계층 DAG에 무작위 연결(고정 시드)을 만들어 실제 입력과 비슷한 모양을 흉내 낸다.
 * 실행: npm run perf
 */
function randomRows(n: number, seed = 42): Row[] {
  let s = seed;
  const rand = () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const layers = 5;
  const perLayer = Math.max(2, Math.ceil(Math.sqrt(n)));
  return Array.from({ length: n }, (_, i) => {
    const layer = Math.floor(rand() * (layers - 1));
    return {
      id: `r${i}`,
      source: `L${layer}-${Math.floor(rand() * perLayer)}`,
      target: `L${layer + 1}-${Math.floor(rand() * perLayer)}`,
      value: String(1 + Math.floor(rand() * 100)),
    };
  });
}

function run(rows: Row[]) {
  const g = buildGraph(rows, DEFAULT_SETTINGS);
  const layout = computeLayout(g, DEFAULT_SETTINGS, {
    width: 960,
    height: suggestHeight(g.nodes.length, DEFAULT_SETTINGS),
  });
  return { nodes: g.nodes.length, links: layout.links.length };
}

test('pipeline timing', () => {
  const lines = ['| 행 | 노드 | 링크 | 중앙값(ms) | 최대(ms) |', '|---:|---:|---:|---:|---:|'];
  for (const n of [50, 200, 500, 1000, 2000]) {
    const rows = randomRows(n);
    for (let i = 0; i < 3; i++) run(rows); // 워밍업
    const times: number[] = [];
    let shape = { nodes: 0, links: 0 };
    for (let i = 0; i < 15; i++) {
      const t = performance.now();
      shape = run(rows);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    lines.push(
      `| ${n} | ${shape.nodes} | ${shape.links} | ${times[7]!.toFixed(1)} | ${times.at(-1)!.toFixed(1)} |`,
    );
  }
  console.log(lines.join('\n'));
  expect(lines.length).toBe(7);
}, 120_000);
