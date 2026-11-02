import { describe, expect, it } from 'vitest';
import { normalizeName, parseValue } from './normalize';
import { validate } from './validate';
import type { Row } from './types';

let seq = 0;
const row = (source: string, target: string, value: string, extra: Partial<Row> = {}): Row => ({
  id: `r${++seq}`,
  source,
  target,
  value,
  ...extra,
});

describe('parseValue', () => {
  it.each([
    ['40', 40],
    [' 40 ', 40],
    ['1.5', 1.5],
    ['.5', 0.5],
    ['1,234', 1234],
    ['1,234,567.89', 1234567.89],
    ['1e3', 1000],
    ['+7', 7],
  ])('%s → %d', (raw, expected) => {
    expect(parseValue(raw)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ['', 'REQUIRED'],
    ['   ', 'REQUIRED'],
    ['abc', 'NOT_NUMBER'],
    ['12a', 'NOT_NUMBER'],
    ['0x10', 'NOT_NUMBER'],
    ['1,23', 'NOT_NUMBER'],
    ['1,,234', 'NOT_NUMBER'],
    ['40원', 'NOT_NUMBER'],
    ['0', 'NOT_POSITIVE'],
    ['-3', 'NOT_POSITIVE'],
    ['-0', 'NOT_POSITIVE'],
    ['Infinity', 'NOT_FINITE'],
    ['-infinity', 'NOT_FINITE'],
    ['1e309', 'NOT_FINITE'],
  ])('%j → %s', (raw, code) => {
    expect(parseValue(raw)).toEqual({ ok: false, code });
  });
});

describe('normalizeName', () => {
  it('앞뒤 공백을 지우고 NFC로 맞춘다', () => {
    const nfd = '교육'.normalize('NFD');
    expect(nfd).not.toBe('교육');
    expect(normalizeName(`  ${nfd} `)).toBe('교육');
  });

  it('대소문자는 구분한다', () => {
    expect(normalizeName('Gas')).not.toBe(normalizeName('gas'));
  });
});

describe('validate', () => {
  it('정상 행은 validRows로 넘긴다', () => {
    const r = row(' 전체 예산 ', '교육', '40', { group: ' 분야 ' });
    const { issues, validRows } = validate([r]);
    expect(issues).toEqual([]);
    expect(validRows).toEqual([
      {
        rowId: r.id,
        source: '전체 예산',
        target: '교육',
        sourceLabel: '전체 예산',
        targetLabel: '교육',
        value: 40,
        group: '분야',
      },
    ]);
  });

  it('완전히 빈 행은 무시한다', () => {
    expect(validate([row('', '', ''), row(' ', '', '  ')])).toEqual({ issues: [], validRows: [] });
  });

  it('필수 셀이 비면 셀마다 오류를 낸다', () => {
    const r = row('', '', '', { memo: '메모만 있음' });
    const { issues, validRows } = validate([r]);
    expect(validRows).toEqual([]);
    expect(issues.map((i) => [i.code, i.field, i.rowId, i.level])).toEqual([
      ['REQUIRED', 'source', r.id, 'error'],
      ['REQUIRED', 'target', r.id, 'error'],
      ['REQUIRED', 'value', r.id, 'error'],
    ]);
    expect(issues[0]!.message).toContain('출발 노드');
  });

  it.each([
    ['abc', 'NOT_NUMBER'],
    ['-3', 'NOT_POSITIVE'],
    ['0', 'NOT_POSITIVE'],
    ['Infinity', 'NOT_FINITE'],
    ['1e309', 'NOT_FINITE'],
  ])('값 %s → %s, 해당 행만 제외', (value, code) => {
    const bad = row('A', 'B', value);
    const good = row('B', 'C', '1');
    const { issues, validRows } = validate([bad, good]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code, field: 'value', rowId: bad.id, level: 'error' });
    expect(validRows.map((v) => v.rowId)).toEqual([good.id]);
  });

  it('숫자가 아닌 값은 입력 원문을 메시지에 보인다', () => {
    const { issues } = validate([row('A', 'B', '사십')]);
    expect(issues[0]!.message).toContain('"사십"');
  });

  it('자기 자신으로 이어지는 행은 경고하고 제외한다', () => {
    const r = row('교육', ' 교육', '5');
    const { issues, validRows } = validate([r]);
    expect(validRows).toEqual([]);
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'SELF_LOOP',
        level: 'warning',
        rowId: r.id,
        nodeName: '교육',
      }),
    ]);
  });

  it('행 수 경고·제한', () => {
    const limits = { maxRows: 3, warnRows: 2, renderDebounceMs: 0, autosaveDelayMs: 0 };
    const rows = (n: number) => Array.from({ length: n }, (_, i) => row(`N${i}`, `N${i + 1}`, '1'));

    expect(validate(rows(2), limits).issues).toEqual([]);

    const warn = validate(rows(3), limits);
    expect(warn.issues).toEqual([expect.objectContaining({ code: 'ROW_LIMIT', level: 'warning' })]);
    expect(warn.validRows).toHaveLength(3);

    const over = validate(rows(5), limits);
    expect(over.issues).toEqual([expect.objectContaining({ code: 'ROW_LIMIT', level: 'error' })]);
    expect(over.validRows).toHaveLength(3);
  });

  it.each([
    ['40원', '원'],
    ['1,000 명', '명'],
    ['35%', '%'],
    ['12.5kWh', 'kWh'],
  ])('숫자 뒤에 단위를 붙인 값(%s)은 단위를 빼라고 안내한다', (value, suffix) => {
    const { issues } = validate([row('A', 'B', value)]);
    expect(issues[0]).toMatchObject({ code: 'NOT_NUMBER' });
    expect(issues[0]!.message).toContain(`"${suffix}"`);
    expect(issues[0]!.message).toContain('값의 단위');
  });

  it('조사를 받침에 맞게 붙인다', () => {
    const { issues } = validate([row('', 'B', '1'), row('홍보', '홍보', '1')]);
    expect(issues[0]!.message).toBe('출발 노드를 입력하세요.');
    expect(issues[1]!.message).toContain('"홍보"가 자기 자신으로');
  });
});
