import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGraph } from './buildGraph';
import { DEFAULT_SETTINGS } from './config';
import { parseCsv, recordsToRows } from './csv';

/** docs/USABILITY_TEST.md 과제 2 파일이 대본에 적은 문제를 그대로 일으키는지 */
describe('사용성 테스트 과제 2 자료', () => {
  const bytes = new Uint8Array(
    readFileSync(join(__dirname, '../../docs/usability/task2-주민참여예산.csv')),
  );
  const res = parseCsv(bytes);
  if (!res.ok) throw new Error(res.error);
  const { csv } = res;
  const rows = recordsToRows(csv, csv.mapping, csv.hasHeader).rows;
  const graph = buildGraph(rows, DEFAULT_SETTINGS);
  const at = (rowNo: number) => graph.issues.filter((i) => i.rowId === rows[rowNo - 1]!.id);

  it('엑셀 기본 형식(EUC-KR), 단위 "만 원", 11행', () => {
    expect(csv.encoding).toBe('euc-kr');
    expect(csv.unit).toBe('만 원');
    expect(rows).toHaveLength(11);
  });

  it('대본의 의도한 오류 4건', () => {
    expect(at(5)).toEqual([expect.objectContaining({ code: 'NOT_NUMBER', field: 'value' })]);
    expect(at(5)[0]!.message).toContain('"만원"을 빼고');
    expect(at(7)).toEqual([expect.objectContaining({ code: 'REQUIRED', field: 'target' })]);
    expect(at(9)).toEqual([expect.objectContaining({ code: 'SELF_LOOP', level: 'warning' })]);
    expect(at(11)).toEqual([expect.objectContaining({ code: 'NOT_POSITIVE' })]);
    expect(graph.issues.filter((i) => i.level === 'error')).toHaveLength(3);
    expect(graph.drawable).toBe(true);
  });

  it('11행 값을 고치면 10·11행 중복이 합산 안내로 바뀐다', () => {
    const fixed = rows.map((r, i) => (i === 10 ? { ...r, value: '100' } : r));
    const g = buildGraph(fixed, DEFAULT_SETTINGS);
    expect(g.issues.some((i) => i.code === 'DUPLICATE_PAIR')).toBe(true);
  });
});
