import { describe, expect, it } from 'vitest';
import { buildGraph, findCycle } from './buildGraph';
import { DEFAULT_SETTINGS } from './config';
import { SAMPLES, loadSample } from './samples';
import type { Row } from './types';

let seq = 0;
const row = (source: string, target: string, value: string | number, group?: string): Row => ({
  id: `r${++seq}`,
  source,
  target,
  value: String(value),
  ...(group ? { group } : {}),
});

const merge = DEFAULT_SETTINGS;
const separate = { ...DEFAULT_SETTINGS, duplicateMode: 'separate' as const };
const codes = (r: ReturnType<typeof buildGraph>) => r.issues.map((i) => i.code);

describe('buildGraph', () => {
  it('기획서 §5 예시: 노드 5개, 링크 4개, 교육 유입 = 유출', () => {
    const g = buildGraph(
      [
        row('전체 예산', '교육', 40),
        row('전체 예산', '운영', 30),
        row('교육', '강사비', 25),
        row('교육', '교재비', 15),
      ],
      merge,
    );
    expect(g.drawable).toBe(true);
    expect(g.issues).toEqual([]);
    expect(g.nodes.map((n) => n.id)).toEqual(['전체 예산', '교육', '운영', '강사비', '교재비']);
    expect(g.links).toHaveLength(4);
    const edu = g.nodes.find((n) => n.id === '교육')!;
    expect([edu.inflow, edu.outflow]).toEqual([40, 40]);
  });

  it('같은 이름(공백·NFC 차이)은 같은 노드, 레이블은 처음 원문', () => {
    const g = buildGraph([row('A', '교육 ', 1), row('교육'.normalize('NFD'), 'B', 1)], merge);
    expect(g.nodes.map((n) => n.id)).toEqual(['A', '교육', 'B']);
    expect(g.nodes[1]!.label).toBe('교육');
  });

  it('링크 ID와 rowIds로 원본 행을 가리킨다', () => {
    const r = row('A', 'B', 1);
    const g = buildGraph([r], merge);
    expect(g.links[0]).toMatchObject({ id: r.id, rowIds: [r.id] });
  });

  describe('중복 출발·도착 쌍', () => {
    const rows = () => [row('A', 'B', 10), row('A', 'C', 5), row('A', 'B', 2.5)];

    it('merge: 합산하고 info로 안내', () => {
      const input = rows();
      const g = buildGraph(input, merge);
      expect(g.links).toHaveLength(2);
      expect(g.links[0]).toMatchObject({ value: 12.5, rowIds: [input[0]!.id, input[2]!.id] });
      const dup = g.issues.find((i) => i.code === 'DUPLICATE_PAIR')!;
      expect(dup).toMatchObject({ level: 'info', rowId: input[2]!.id });
      expect(dup.message).toContain('2번');
      expect(dup.message).toContain('합산');
    });

    it('separate: 행마다 링크', () => {
      const g = buildGraph(rows(), separate);
      expect(g.links.map((l) => l.value)).toEqual([10, 5, 2.5]);
      expect(codes(g)).toEqual(['DUPLICATE_PAIR']);
      expect(g.drawable).toBe(true);
    });
  });

  it('순환이면 오류, 그리지 않음, 경로를 레이블로 보인다', () => {
    const closing = row('다', '가', 1);
    const g = buildGraph(
      [row('시작', '가', 3), row('가', '나', 2), row('나', '다', 2), closing],
      merge,
    );
    expect(g.drawable).toBe(false);
    const cyc = g.issues.find((i) => i.code === 'CYCLE')!;
    expect(cyc).toMatchObject({ level: 'error', rowId: closing.id });
    expect(cyc.message).toContain('가 → 나 → 다 → 가');
    // 순환이 있으면 불균형 경고는 내지 않는다(순환 해결이 먼저).
    expect(codes(g)).not.toContain('IMBALANCE');
  });

  it('두 노드 순환(A→B, B→A)도 찾는다', () => {
    const g = buildGraph([row('A', 'B', 1), row('B', 'A', 1)], merge);
    expect(g.drawable).toBe(false);
    expect(g.issues.find((i) => i.code === 'CYCLE')!.message).toContain('A → B → A');
  });

  it('갈래가 다시 만나는 그래프(다이아몬드)는 순환이 아니다', () => {
    const g = buildGraph(
      [row('A', 'B', 1), row('A', 'C', 1), row('B', 'D', 1), row('C', 'D', 1)],
      merge,
    );
    expect(g.drawable).toBe(true);
    expect(codes(g)).toEqual([]);
  });

  it('중간 노드의 유입·유출 불균형은 경고하고 그린다', () => {
    const g = buildGraph([row('A', 'B', 10), row('B', 'C', 7), row('B', 'D', 1)], merge);
    expect(g.drawable).toBe(true);
    const imb = g.issues.find((i) => i.code === 'IMBALANCE')!;
    expect(imb).toMatchObject({ level: 'warning', nodeName: 'B' });
    expect(imb.message).toContain('(10)');
    expect(imb.message).toContain('(8)');
  });

  it('부동소수 오차는 불균형으로 보지 않는다', () => {
    const g = buildGraph([row('A', 'B', 0.3), row('B', 'C', 0.1), row('B', 'D', 0.2)], merge);
    expect(codes(g)).toEqual([]);
  });

  it('서로 이어지지 않은 묶음이 여럿이면 info', () => {
    const g = buildGraph([row('A', 'B', 1), row('C', 'D', 1)], merge);
    expect(g.issues).toEqual([
      expect.objectContaining({ code: 'DISCONNECTED_GROUPS', level: 'info' }),
    ]);
    expect(g.issues[0]!.message).toContain('2개');
  });

  it('노드 그룹: 들어오는 행의 그룹, 시작 노드는 나가는 행의 그룹', () => {
    const g = buildGraph(
      [row('석탄', '발전', 1, '에너지원'), row('발전', '가정', 1, '소비')],
      merge,
    );
    expect(Object.fromEntries(g.nodes.map((n) => [n.id, n.group]))).toEqual({
      석탄: '에너지원',
      발전: '에너지원',
      가정: '소비',
    });
  });

  it('오류 행은 빼고 나머지로 그린다', () => {
    const g = buildGraph([row('A', 'B', 'x'), row('B', 'C', 1)], merge);
    expect(g.drawable).toBe(true);
    expect(g.links).toHaveLength(1);
    expect(codes(g)).toEqual(['NOT_NUMBER']);
  });

  it('유효 행이 없으면 그리지 않는다', () => {
    expect(buildGraph([], merge)).toEqual({ nodes: [], links: [], issues: [], drawable: false });
    expect(buildGraph([row('A', 'A', 1)], merge).drawable).toBe(false);
  });

  it.each(SAMPLES.map((s) => s.id))('예시 %s는 오류·경고 없이 그려진다', (id) => {
    const g = buildGraph(loadSample(id).rows, merge);
    expect(g.drawable).toBe(true);
    expect(g.issues.filter((i) => i.level !== 'info')).toEqual([]);
  });
});

describe('findCycle', () => {
  it('큰 선형 그래프에서도 스택 오버플로 없이 동작한다', () => {
    const n = 20000;
    const nodes = Array.from({ length: n }, (_, i) => ({
      id: `n${i}`,
      label: '',
      inflow: 0,
      outflow: 0,
    }));
    const links = Array.from({ length: n - 1 }, (_, i) => ({
      id: `l${i}`,
      source: `n${i}`,
      target: `n${i + 1}`,
      value: 1,
      rowIds: [`l${i}`],
    }));
    expect(findCycle(nodes, links)).toBeNull();
    links.push({ id: 'back', source: `n${n - 1}`, target: 'n0', value: 1, rowIds: ['back'] });
    expect(findCycle(nodes, links)?.rowId).toBe('back');
  });
});
