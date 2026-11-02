import { describe, expect, it } from 'vitest';
import { applyPaste, insertRow, parseClipboardTable, removeRow, updateCell } from './rows';
import type { Row } from './types';

const r = (id: string, source = '', target = '', value = ''): Row => ({
  id,
  source,
  target,
  value,
});

describe('row operations', () => {
  it('updateCell은 해당 셀만 바꾸고 원본을 바꾸지 않는다', () => {
    const rows = [r('a', 'A'), r('b', 'B')];
    const next = updateCell(rows, 'b', 'value', '3');
    expect(next[1]).toEqual(r('b', 'B', '', '3'));
    expect(next[0]).toBe(rows[0]);
    expect(rows[1]!.value).toBe('');
  });

  it('insertRow: 지정한 행 다음, 없으면 끝', () => {
    const rows = [r('a'), r('b')];
    expect(insertRow(rows, 'a')!.rows.map((x) => x.id)).toEqual(['a', expect.any(String), 'b']);
    const end = insertRow(rows)!;
    expect(end.rows.at(-1)).toBe(end.row);
  });

  it('insertRow: 제한에 닿으면 null', () => {
    expect(insertRow([r('a'), r('b')], 'a', 2)).toBeNull();
  });

  it('removeRow: 마지막 한 행은 빈 행으로 바꾼다', () => {
    expect(removeRow([r('a'), r('b')], 'a').map((x) => x.id)).toEqual(['b']);
    const last = removeRow([r('a', 'A', 'B', '1')], 'a');
    expect(last).toHaveLength(1);
    expect(last[0]).toMatchObject({ source: '', target: '', value: '' });
    expect(last[0]!.id).not.toBe('a');
  });
});

describe('parseClipboardTable', () => {
  it('셀 하나는 null', () => {
    expect(parseClipboardTable('40')).toBeNull();
    expect(parseClipboardTable('40\n')).toBeNull();
  });

  it('엑셀 TSV(CRLF, 끝 줄바꿈)', () => {
    expect(parseClipboardTable('A\tB\t1\r\nB\tC\t2\r\n')).toEqual([
      ['A', 'B', '1'],
      ['B', 'C', '2'],
    ]);
  });

  it('한 열 여러 행', () => {
    expect(parseClipboardTable('10\n20')).toEqual([['10'], ['20']]);
  });

  it('따옴표로 감싼 셀', () => {
    expect(parseClipboardTable('"1,234"\t"say ""hi"""')).toEqual([['1,234', 'say "hi"']]);
  });
});

describe('applyPaste', () => {
  it('시작 셀부터 오른쪽·아래로 채우고 부족한 행은 만든다', () => {
    const rows = [r('a'), r('b')];
    const res = applyPaste(rows, 'b', 'source', [
      ['A', 'B', ' 1 '],
      ['B', 'C', '2', '그룹', '메모', '넘치는 열'],
    ]);
    expect(res.rows).toHaveLength(3);
    expect(res.rows[0]).toBe(rows[0]);
    expect(res.rows[1]).toMatchObject({ id: 'b', source: 'A', target: 'B', value: '1' });
    expect(res.rows[2]).toMatchObject({
      source: 'B',
      target: 'C',
      value: '2',
      group: '그룹',
      memo: '메모',
    });
    expect(res.touchedRowIds).toEqual(['b', res.rows[2]!.id]);
    expect(res.droppedRows).toBe(0);
  });

  it('값 열부터 붙여넣으면 값·그룹·메모만 바뀐다', () => {
    const res = applyPaste([r('a', 'A', 'B', '1')], 'a', 'value', [['9', 'g']]);
    expect(res.rows[0]).toMatchObject({ source: 'A', target: 'B', value: '9', group: 'g' });
  });

  it('행 수 제한을 넘는 행은 버리고 개수를 알려준다', () => {
    const res = applyPaste([r('a')], 'a', 'source', [['1'], ['2'], ['3'], ['4']], 2);
    expect(res.rows).toHaveLength(2);
    expect(res.droppedRows).toBe(2);
  });

  it('없는 행이면 그대로', () => {
    const rows = [r('a')];
    expect(applyPaste(rows, 'zzz', 'source', [['x']]).touchedRowIds).toEqual([]);
  });
});
