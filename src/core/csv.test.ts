import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkMapping,
  columnNames,
  guessMapping,
  parseCsv,
  recordsToRows,
  serializeCsv,
  type ParsedCsv,
} from './csv';
import { SAMPLES, loadSample } from './samples';
import type { Row } from './types';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(__dirname, '../../tests/fixtures/csv', name)));

function ok(bytes: Uint8Array): ParsedCsv {
  const res = parseCsv(bytes);
  if (!res.ok) throw new Error(res.error);
  return res.csv;
}

const enc = (s: string) => new TextEncoder().encode(s);
const rowsOf = (csv: ParsedCsv) => recordsToRows(csv, csv.mapping, csv.hasHeader).rows;
const plain = (rows: Row[]) =>
  rows.map(({ source, target, value, group, memo }) => [source, target, value, group, memo]);

describe('parseCsv: 인코딩', () => {
  it('UTF-8', () => {
    const csv = ok(fixture('utf8.csv'));
    expect(csv).toMatchObject({
      encoding: 'utf-8',
      delimiter: ',',
      hasHeader: true,
      columnCount: 5,
    });
    expect(csv.mapping).toEqual({ source: 0, target: 1, value: 2, group: 3, memo: 4 });
    expect(plain(rowsOf(csv))[2]).toEqual(['교육', '강사비', '25', '세부 항목', '외부 강사 포함']);
  });

  it('UTF-8 BOM + CRLF: BOM이 첫 열 이름에 섞이지 않는다', () => {
    const csv = ok(fixture('utf8-bom.csv'));
    expect(csv.records[0]![0]).toBe('출발 노드');
    expect(csv.mapping.source).toBe(0);
    expect(rowsOf(csv)).toHaveLength(4);
  });

  it('CP949(엑셀 기본 CSV): 자동으로 다시 읽고, 값 열 이름의 단위를 가져온다', () => {
    const csv = ok(fixture('cp949.csv'));
    expect(csv.encoding).toBe('euc-kr');
    expect(csv.unit).toBe('백만 원');
    expect(csv.mapping).toMatchObject({ source: 0, target: 1, value: 2, group: 3, memo: null });
    expect(plain(rowsOf(csv))[0]).toEqual(['전체 예산', '교육', '40', '사업 분야', undefined]);
  });

  it('UTF-16(엑셀 "유니코드 텍스트") 탭 구분', () => {
    const csv = ok(fixture('excel-utf16.txt'));
    expect(csv).toMatchObject({ encoding: 'utf-16le', delimiter: '\t', hasHeader: true });
    expect(plain(rowsOf(csv))).toEqual([['A', 'B', '1', undefined, undefined]]);
  });
});

describe('parseCsv: 구분자·머리글', () => {
  it('탭 구분, 영문 머리글', () => {
    const csv = ok(fixture('tab.tsv'));
    expect(csv.delimiter).toBe('\t');
    expect(csv.mapping).toMatchObject({ source: 0, target: 1, value: 2 });
    expect(rowsOf(csv)).toHaveLength(3);
  });

  it('세미콜론 구분, from/to/amount', () => {
    const csv = ok(fixture('semicolon.csv'));
    expect(csv.delimiter).toBe(';');
    expect(csv.mapping).toMatchObject({ source: 0, target: 1, value: 2 });
    // 유럽식 숫자는 그대로 가져오고, 검증 단계에서 숫자 오류로 안내된다.
    expect(rowsOf(csv)[0]!.value).toBe('1.234,5');
  });

  it('머리글 없음: 첫 줄도 데이터, 앞 열부터 차례로', () => {
    const csv = ok(fixture('no-header.csv'));
    expect(csv.hasHeader).toBe(false);
    expect(csv.mapping).toEqual({ source: 0, target: 1, value: 2, group: null, memo: null });
    expect(rowsOf(csv)).toHaveLength(3);
  });

  it('따옴표 안의 쉼표·줄바꿈·큰따옴표', () => {
    const rows = rowsOf(ok(fixture('quoted.csv')));
    expect(rows[0]).toMatchObject({
      source: '서울, 본부',
      value: '1,200',
      memo: '줄바꿈\n있는 메모',
    });
    expect(rows[1]!.target).toBe('사업 "가"');
  });

  it('열 이름이 달라도 아는 별칭이면 매핑한다', () => {
    expect(guessMapping(['메모', '값 (명)', '도착지', '출발지', '분류'], 5)).toEqual({
      source: 3,
      target: 2,
      value: 1,
      group: 4,
      memo: 0,
    });
  });

  it('모르는 열 이름이면 남은 앞 열로 채운다', () => {
    expect(guessMapping(['가', '나', '다', '라'], 4)).toEqual({
      source: 0,
      target: 1,
      value: 2,
      group: null,
      memo: null,
    });
  });

  it('columnNames', () => {
    const csv = ok(fixture('tab.tsv'));
    expect(columnNames(csv, true)).toEqual(['source (열 1)', 'target (열 2)', 'value (열 3)']);
    expect(columnNames(csv, false)).toEqual(['열 1', '열 2', '열 3']);
  });
});

describe('parseCsv: 오류 안내', () => {
  it.each([
    ['empty.csv', '빈 파일'],
    ['blank-lines.csv', '빈 줄만'],
    ['two-columns.csv', '3개 열이 필요'],
    ['unclosed-quote.csv', '큰따옴표(")가 닫히지 않았습니다'],
    ['image.png', '텍스트 CSV 파일이 아닌'],
  ])('%s → %s', (name, message) => {
    const res = parseCsv(fixture(name));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(message);
  });

  it('xlsx(ZIP)는 엑셀 저장 방법을 안내한다', () => {
    const res = parseCsv(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0]));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('.xlsx');
  });

  it('checkMapping', () => {
    expect(checkMapping({ source: 0, target: 1, value: 2, group: null, memo: null }, 3)).toBeNull();
    expect(checkMapping({ source: 0, target: 0, value: 2, group: null, memo: null }, 3)).toContain(
      '서로 다른',
    );
    expect(checkMapping({ source: 0, target: 1, value: 5, group: null, memo: null }, 3)).toContain(
      '모두',
    );
  });
});

describe('recordsToRows', () => {
  it('빈 레코드는 건너뛰고 행 수 제한을 넘는 행은 버린다', () => {
    const csv = ok(enc('a,b,c\nA,B,1\n,,\nB,C,2\nC,D,3\n'));
    const res = recordsToRows(csv, csv.mapping, true, 2);
    expect(res.rows.map((r) => r.source)).toEqual(['A', 'B']);
    expect(res.dropped).toBe(1);
  });

  it('머리글 여부를 바꾸면 첫 줄이 데이터가 된다', () => {
    const csv = ok(fixture('no-header.csv'));
    expect(recordsToRows(csv, csv.mapping, true).rows).toHaveLength(2);
  });
});

describe('serializeCsv / 왕복(A6)', () => {
  it('UTF-8 BOM, CRLF, 단위가 붙은 값 열 이름', () => {
    const out = serializeCsv([{ id: '1', source: 'A', target: 'B', value: '1' }], '명');
    expect(out.startsWith('﻿출발 노드,도착 노드,값 (명),색상 그룹,메모\r\n')).toBe(true);
    expect(out.endsWith('A,B,1,,\r\n')).toBe(true);
  });

  it('완전히 빈 행은 빼고, 특수 문자는 따옴표로 감싼다', () => {
    const out = serializeCsv([
      { id: '1', source: '서울, 본부', target: '말 "따옴표"', value: '1,200', memo: '두\n줄' },
      { id: '2', source: '', target: '', value: '' },
    ]);
    expect(out).toContain('"서울, 본부","말 ""따옴표""","1,200",,"두\n줄"');
    expect(out.trim().split('\r\n')).toHaveLength(2);
  });

  it('수식으로 해석될 수 있는 칸은 보호하고 가져올 때 되돌린다', () => {
    const rows: Row[] = [
      { id: '1', source: '=SUM(A1)', target: '@user', value: '-5', memo: '+메모' },
    ];
    const out = serializeCsv(rows);
    expect(out).toContain("'=SUM(A1),'@user,-5,,'+메모");
    const back = rowsOf(ok(enc(out)));
    expect(plain(back)).toEqual([['=SUM(A1)', '@user', '-5', undefined, '+메모']]);
  });

  it.each(SAMPLES.map((s) => s.id))(
    '예시 %s: 내보낸 CSV를 다시 불러오면 데이터·단위 유지',
    (id) => {
      const doc = loadSample(id);
      const csv = ok(enc(serializeCsv(doc.rows, doc.meta.unit)));
      expect(csv.unit).toBe(doc.meta.unit);
      expect(plain(rowsOf(csv))).toEqual(plain(doc.rows));
    },
  );
});
