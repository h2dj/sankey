import { describe, expect, it } from 'vitest';
import { createDoc, createRow } from '../core/config';
import { createEditorStore } from './store';

function setup() {
  let t = 0;
  const clock = { advance: (ms: number) => (t += ms) };
  const row = createRow({ source: 'A', target: 'B', value: '1' });
  const store = createEditorStore(createDoc({ rows: [row] }), () => t);
  return { store, row, clock, s: () => store.getState() };
}

describe('editor store', () => {
  it('셀 변경 후 실행 취소·다시 실행', () => {
    const { store, row, s, clock } = setup();
    s().setCell(row.id, 'value', '5');
    clock.advance(5000);
    s().setCell(row.id, 'source', 'Z');
    expect(s().doc.rows[0]).toMatchObject({ source: 'Z', value: '5' });

    s().undo();
    expect(s().doc.rows[0]).toMatchObject({ source: 'A', value: '5' });
    s().undo();
    expect(s().doc.rows[0]).toMatchObject({ source: 'A', value: '1' });
    s().undo(); // 더 없으면 그대로
    expect(s().past).toHaveLength(0);

    s().redo();
    s().redo();
    expect(s().doc.rows[0]).toMatchObject({ source: 'Z', value: '5' });
    expect(store.getState().future).toHaveLength(0);
  });

  it('같은 셀 연속 입력은 한 번의 실행 취소로 묶는다', () => {
    const { row, s, clock } = setup();
    for (const v of ['1', '12', '123']) {
      s().setCell(row.id, 'value', v);
      clock.advance(200);
    }
    expect(s().past).toHaveLength(1);
    s().undo();
    expect(s().doc.rows[0]!.value).toBe('1');
  });

  it('시간이 지나거나 다른 셀이면 따로 기록한다', () => {
    const { row, s, clock } = setup();
    s().setCell(row.id, 'value', '2');
    clock.advance(2000);
    s().setCell(row.id, 'value', '3');
    s().setCell(row.id, 'target', 'C');
    expect(s().past).toHaveLength(3);
  });

  it('같은 값이면 기록하지 않는다', () => {
    const { row, s } = setup();
    s().setCell(row.id, 'value', '1');
    expect(s().past).toHaveLength(0);
  });

  it('새 변경은 다시 실행 목록을 비운다', () => {
    const { row, s } = setup();
    s().setCell(row.id, 'value', '2');
    s().undo();
    expect(s().future).toHaveLength(1);
    s().addRow();
    expect(s().future).toHaveLength(0);
  });

  it('행 추가·삭제·붙여넣기·문서 교체도 되돌린다', () => {
    const { row, s } = setup();
    const id = s().addRow(row.id)!;
    expect(s().doc.rows.map((r) => r.id)).toEqual([row.id, id]);
    s().paste(id, 'source', [
      ['B', 'C', '1'],
      ['C', 'D', '1'],
    ]);
    expect(s().doc.rows).toHaveLength(3);
    s().deleteRow(row.id);
    s().replaceDoc(createDoc());
    expect(s().doc.rows).toHaveLength(1);

    s().undo();
    s().undo();
    s().undo();
    expect(s().doc.rows.map((r) => r.id)).toEqual([row.id, id]);
  });

  it('설정 슬라이더 연속 변경은 한 번의 실행 취소로 묶는다', () => {
    const { s, clock } = setup();
    const before = s().doc.settings.nodePadding;
    for (const v of [10, 20, 30, 40]) {
      s().setSettings({ nodePadding: v });
      clock.advance(100);
    }
    s().setSettings({ fontSize: 20 });
    expect(s().past).toHaveLength(2);
    s().undo();
    s().undo();
    expect(s().doc.settings.nodePadding).toBe(before);
  });

  it('CSV 가져오기: 대체·추가·단위·행 수 제한·실행 취소', () => {
    const { s, row } = setup();
    const r = (v: string) => createRow({ source: 'X', target: 'Y', value: v });

    s().importRows([r('1'), r('2')], 'replace', '명');
    expect(s().doc.rows.map((x) => x.value)).toEqual(['1', '2']);
    expect(s().doc.meta.unit).toBe('명');

    // 추가: 단위가 이미 있으면 바꾸지 않는다
    s().importRows([r('3')], 'append', '원');
    expect(s().doc.rows.map((x) => x.value)).toEqual(['1', '2', '3']);
    expect(s().doc.meta.unit).toBe('명');

    const many = Array.from({ length: 600 }, (_, i) => r(String(i + 1)));
    expect(s().importRows(many, 'append').dropped).toBe(103);
    expect(s().doc.rows).toHaveLength(500);

    s().undo();
    s().undo();
    s().undo();
    expect(s().doc.rows.map((x) => x.id)).toEqual([row.id]);
  });

  it('추가할 때 빈 행은 버린다', () => {
    const { s } = setup();
    s().addRow();
    s().importRows([createRow({ source: 'A', target: 'B', value: '1' })], 'append');
    expect(s().doc.rows).toHaveLength(2);
  });

  it('노드 메모: 연속 입력은 한 번의 실행 취소, 빈 글은 지움', () => {
    const { s, clock } = setup();
    for (const t of ['강', '강사', '강사비']) {
      s().setNodeNote('A', t);
      clock.advance(200);
    }
    expect(s().doc.nodeNotes).toEqual({ A: '강사비' });
    expect(s().past).toHaveLength(1);
    clock.advance(5000);
    s().setNodeNote('A', '  ');
    expect(s().doc.nodeNotes).toEqual({});
    s().undo();
    expect(s().doc.nodeNotes).toEqual({ A: '강사비' });
    s().undo();
    expect(s().doc.nodeNotes).toEqual({});
  });

  it('CSV 메모: 바꾸기는 CSV 메모로, 추가는 덧씌우기, 메모 열이 없으면 유지', () => {
    const { s } = setup();
    const r = createRow({ source: 'X', target: 'Y', value: '1' });
    s().setNodeNote('Z', '기존');
    s().importRows([r], 'append', undefined, undefined, new Map([['X', '새 메모']]));
    expect(s().doc.nodeNotes).toEqual({ Z: '기존', X: '새 메모' });
    s().importRows([r], 'replace', undefined, undefined, new Map([['Y', '바꿈']]));
    expect(s().doc.nodeNotes).toEqual({ Y: '바꿈' });
    s().importRows([r], 'replace');
    expect(s().doc.nodeNotes).toEqual({ Y: '바꿈' });
  });
});
