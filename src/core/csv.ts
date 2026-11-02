import Papa from 'papaparse';
import { LIMITS, createRow } from './config';
import { normalizeName, parseValue } from './normalize';
import type { Row, TimelineSettings } from './types';

/** 이보다 큰 파일은 읽지 않는다(500행 CSV는 보통 수십 KB). */
export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const CSV_BOM = '﻿';

export type CsvEncoding = 'utf-8' | 'euc-kr' | 'utf-16le' | 'utf-16be';

export const ENCODING_LABEL: Record<CsvEncoding, string> = {
  'utf-8': 'UTF-8',
  'euc-kr': 'EUC-KR(한글 윈도·엑셀 기본)',
  'utf-16le': 'UTF-16(엑셀 유니코드 텍스트)',
  'utf-16be': 'UTF-16',
};

export const DELIMITER_LABEL: Record<string, string> = {
  ',': '쉼표',
  '\t': '탭',
  ';': '세미콜론',
  '|': '세로 막대',
};

/** 열 번호(0부터). group·memo는 없을 수 있다. */
export interface CsvMapping {
  source: number;
  target: number;
  value: number;
  group: number | null;
  memo: number | null;
  /** 시기 모드: 출발·도착 노드의 시기 이름 열(선택) */
  sourcePeriod: number | null;
  targetPeriod: number | null;
}

export interface ParsedCsv {
  encoding: CsvEncoding;
  delimiter: string;
  /** 첫 줄을 포함한 모든 레코드(빈 줄 제외) */
  records: string[][];
  columnCount: number;
  /** 첫 줄이 열 이름으로 보이는지(사용자가 바꿀 수 있다) */
  hasHeader: boolean;
  /** 열 이름으로 추정한 매핑. 추정하지 못하면 앞 열부터 차례로 */
  mapping: CsvMapping;
  /** "값 (백만 원)" 같은 헤더에서 읽은 단위 */
  unit?: string;
}

export type CsvParseResult = { ok: true; csv: ParsedCsv } | { ok: false; error: string };

// ─── 1. 인코딩 ──────────────────────────────────────────────────────────────

export function decodeCsvBytes(
  bytes: Uint8Array,
): { ok: true; text: string; encoding: CsvEncoding } | { ok: false; error: string } {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 3 &&
    bytes[3] === 4
  ) {
    return {
      ok: false,
      error:
        '엑셀 통합 문서(.xlsx)는 바로 읽을 수 없습니다. 엑셀에서 [다른 이름으로 저장] → "CSV UTF-8(쉼표로 분리)"로 저장한 뒤 불러오세요.',
    };
  }

  let text: string;
  let encoding: CsvEncoding;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    text = new TextDecoder('utf-8').decode(bytes.subarray(3));
    encoding = 'utf-8';
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
    encoding = 'utf-16le';
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
    encoding = 'utf-16be';
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      encoding = 'utf-8';
    } catch {
      // UTF-8이 아니면 한글 윈도·엑셀의 기본 인코딩(CP949 ⊃ EUC-KR)으로 다시 읽는다.
      text = new TextDecoder('euc-kr').decode(bytes);
      encoding = 'euc-kr';
    }
  }

  if (looksBinary(text)) {
    return {
      ok: false,
      error:
        '텍스트 CSV 파일이 아닌 것 같습니다(이미지나 문서 파일일 수 있습니다). 쉼표나 탭으로 구분한 .csv 파일을 선택하세요.',
    };
  }
  return { ok: true, text, encoding };
}

function looksBinary(text: string): boolean {
  if (text.includes('\u0000')) return true;
  let bad = 0;
  for (const ch of text) {
    if (ch === '�') bad += 1;
    else {
      const c = ch.charCodeAt(0);
      if (c < 0x20 && ch !== '\n' && ch !== '\r' && ch !== '\t') bad += 1;
    }
  }
  return bad > Math.max(2, text.length * 0.01);
}

// ─── 2. 열 이름 추정 ────────────────────────────────────────────────────────

const ALIASES: Record<keyof CsvMapping, readonly string[]> = {
  source: ['출발노드', '출발', '출발지', '시작', '시작노드', 'source', 'from', 'src', 'origin'],
  target: ['도착노드', '도착', '도착지', '대상', 'target', 'to', 'dest', 'destination'],
  value: ['값', '흐름값', '양', '수량', '금액', 'value', 'amount', 'weight', 'count', 'flow'],
  group: ['색상그룹', '그룹', '분류', 'group', 'category', 'color', 'colorgroup'],
  memo: ['메모', '비고', 'memo', 'note', 'notes', 'comment'],
  sourcePeriod: ['출발시기', '출발기간', '시작시기', 'sourceperiod', 'fromperiod', 'sourcetime'],
  targetPeriod: ['도착시기', '도착기간', 'targetperiod', 'toperiod', 'targettime'],
};

/** 비교용 열 이름: 괄호 안 내용(단위)을 떼고 공백·밑줄을 지운 소문자 */
function headerKey(cell: string): { key: string; paren?: string } {
  const m = /^(.*?)\s*[(（]([^)）]*)[)）]\s*$/.exec(cell.trim());
  const base = m ? m[1]! : cell;
  const key = base.toLowerCase().replace(/[\s_\-.]/g, '');
  return m?.[2]?.trim() ? { key, paren: m[2].trim() } : { key };
}

function matchHeader(header: readonly string[]) {
  const found: Partial<Record<keyof CsvMapping, number>> = {};
  let unit: string | undefined;
  header.forEach((cell, i) => {
    const { key, paren } = headerKey(cell);
    for (const field of Object.keys(ALIASES) as (keyof CsvMapping)[]) {
      if (found[field] === undefined && ALIASES[field].includes(key)) {
        found[field] = i;
        if (field === 'value' && paren) unit = paren;
        break;
      }
    }
  });
  return { found, unit };
}

/** 열 이름 줄로 보이는지(출발·도착·값 중 둘 이상의 열 이름이 있음). 표에 붙여넣을 때도 쓴다. */
export function looksLikeHeaderRow(cells: readonly string[]): boolean {
  const { found } = matchHeader(cells);
  return [found.source, found.target, found.value].filter((v) => v !== undefined).length >= 2;
}

const isNumeric = (s: string | undefined) => s !== undefined && parseValue(s).ok;
/** 부호와 관계없이 숫자 모양인지(수식 보호 판단용) */
const looksNumeric = (s: string) => /^[+-]?(\d[\d,]*\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s.trim());

function detectHeader(records: readonly string[][]): boolean {
  const first = records[0] ?? [];
  const { found } = matchHeader(first);
  const required = [found.source, found.target, found.value].filter((v) => v !== undefined);
  if (required.length >= 2) return true;
  // 열 이름을 몰라도: 첫 줄의 셋째 칸은 숫자가 아니고 둘째 줄은 숫자이면 머리글
  const second = records[1];
  return !!second && !isNumeric(first[2]) && isNumeric(second[2]);
}

/** 열 이름으로 매핑을 추정한다. 없는 필수 열은 아직 쓰이지 않은 앞 열로 채운다. */
export function guessMapping(header: readonly string[] | null, columnCount: number): CsvMapping {
  const found = header ? matchHeader(header).found : {};
  const used = new Set(Object.values(found));
  const nextFree = () => {
    for (let i = 0; i < columnCount; i++) {
      if (!used.has(i)) {
        used.add(i);
        return i;
      }
    }
    return 0;
  };
  const source = found.source ?? nextFree();
  const target = found.target ?? nextFree();
  const value = found.value ?? nextFree();
  // 머리글이 없으면 4·5번째 열을 그룹·메모로 본다(내보낸 CSV와 같은 순서).
  const group = found.group ?? (!header && columnCount > 3 ? 3 : null);
  const memo = found.memo ?? (!header && columnCount > 4 ? 4 : null);
  return {
    source,
    target,
    value,
    group,
    memo,
    sourcePeriod: found.sourcePeriod ?? null,
    targetPeriod: found.targetPeriod ?? null,
  };
}

/** 필수 열이 모두 있고 서로 다른지 확인. 문제가 있으면 안내 문장 */
export function checkMapping(m: CsvMapping, columnCount: number): string | null {
  const required = [m.source, m.target, m.value];
  if (required.some((i) => i < 0 || i >= columnCount))
    return '출발 노드, 도착 노드, 값 열을 모두 고르세요.';
  if (new Set(required).size < 3) return '출발 노드, 도착 노드, 값에는 서로 다른 열을 고르세요.';
  return null;
}

// ─── 3. 파싱 ────────────────────────────────────────────────────────────────

export function parseCsv(bytes: Uint8Array): CsvParseResult {
  if (bytes.length === 0) return { ok: false, error: '빈 파일입니다.' };
  if (bytes.length > MAX_CSV_BYTES) {
    return { ok: false, error: `파일이 너무 큽니다(최대 ${MAX_CSV_BYTES / 1024 / 1024}MB).` };
  }
  const decoded = decodeCsvBytes(bytes);
  if (!decoded.ok) return decoded;

  const result = Papa.parse<string[]>(decoded.text, {
    delimitersToGuess: [',', '\t', ';', '|'],
    skipEmptyLines: 'greedy',
  });

  const quoteError = result.errors.find((e) => e.type === 'Quotes');
  if (quoteError) {
    const line = (quoteError.row ?? 0) + 1;
    return {
      ok: false,
      error: `CSV 형식 오류: ${line}번째 줄 근처에서 시작한 큰따옴표(")가 닫히지 않았습니다. 해당 칸을 확인하세요.`,
    };
  }

  const records = result.data.map((r) => r.map(unescapeCell));
  if (records.length === 0)
    return { ok: false, error: '데이터가 없습니다. 빈 줄만 있는 파일입니다.' };

  const columnCount = Math.max(...records.map((r) => r.length));
  if (columnCount < 3) {
    return {
      ok: false,
      error: `열을 ${columnCount}개만 찾았습니다. 출발 노드, 도착 노드, 값의 3개 열이 필요합니다. 쉼표·탭으로 구분했는지 확인하세요.`,
    };
  }

  const hasHeader = detectHeader(records);
  const { unit } = hasHeader ? matchHeader(records[0]!) : { unit: undefined };
  return {
    ok: true,
    csv: {
      encoding: decoded.encoding,
      delimiter: result.meta.delimiter,
      records,
      columnCount,
      hasHeader,
      mapping: guessMapping(hasHeader ? records[0]! : null, columnCount),
      ...(unit ? { unit } : {}),
    },
  };
}

/** 표에 보일 열 이름: 머리글이 있으면 그 이름, 없으면 "열 1"… */
export function columnNames(csv: ParsedCsv, hasHeader: boolean): string[] {
  return Array.from({ length: csv.columnCount }, (_, i) => {
    const name = hasHeader ? csv.records[0]?.[i]?.trim() : '';
    return name ? `${name} (열 ${i + 1})` : `열 ${i + 1}`;
  });
}

export interface RecordsToRowsResult {
  rows: Row[];
  /** 행 수 제한으로 버린 행 */
  dropped: number;
  /** 시기 열에서 읽은 노드(정규화 이름) → 시기 이름. 처음 나온 값을 쓴다 */
  nodePeriods: Map<string, string>;
  /** 같은 노드에 서로 다른 시기가 적힌 경우의 수(처음 값을 썼음) */
  periodConflicts: number;
}

export function recordsToRows(
  csv: ParsedCsv,
  mapping: CsvMapping,
  hasHeader: boolean,
  maxRows: number = LIMITS.maxRows,
): RecordsToRowsResult {
  const data = hasHeader ? csv.records.slice(1) : csv.records;
  const cell = (r: string[], i: number | null) => (i === null ? '' : (r[i] ?? '').trim());
  const rows: Row[] = [];
  let dropped = 0;
  const nodePeriods = new Map<string, string>();
  let periodConflicts = 0;
  const notePeriod = (node: string, label: string) => {
    const id = normalizeName(node);
    if (!id || !label) return;
    const prev = nodePeriods.get(id);
    if (prev === undefined) nodePeriods.set(id, label);
    else if (prev !== label) periodConflicts += 1;
  };
  for (const r of data) {
    const source = cell(r, mapping.source);
    const target = cell(r, mapping.target);
    const value = cell(r, mapping.value);
    const group = cell(r, mapping.group);
    const memo = cell(r, mapping.memo);
    if (!source && !target && !value && !group && !memo) continue;
    if (rows.length >= maxRows) {
      dropped += 1;
      continue;
    }
    rows.push(createRow({ source, target, value, ...(group && { group }), ...(memo && { memo }) }));
    notePeriod(source, cell(r, mapping.sourcePeriod));
    notePeriod(target, cell(r, mapping.targetPeriod));
  }
  return { rows, dropped, nodePeriods, periodConflicts };
}

// ─── 4. 내보내기 ────────────────────────────────────────────────────────────

/**
 * 엑셀이 수식으로 해석할 수 있는 칸(=, +, -, @로 시작하는데 숫자가 아님)은 앞에 '를 붙인다.
 * 가져올 때 같은 규칙으로 떼어 원래 값을 되살린다.
 */
function escapeCell(v: string): string {
  if (/^[=+\-@]/.test(v) && !looksNumeric(v)) v = `'${v}`;
  return /[",\r\n]|^\s|\s$/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

function unescapeCell(v: string): string {
  return /^'[=+\-@]/.test(v) && !looksNumeric(v.slice(1)) ? v.slice(1) : v;
}

/** 표 데이터 → CSV(UTF-8 BOM, CRLF). 빈 행은 뺀다. 단위가 있으면 값 열 이름에 붙인다. */
export function serializeCsv(rows: readonly Row[], unit = '', timeline?: TimelineSettings): string {
  // 시기 모드에서 노드에 시기를 정해 두었으면 출발·도착 시기 열을 더한다(다시 불러오면 복원).
  const periodLabel = new Map(timeline?.periods.map((p) => [p.id, p.label]));
  const withPeriods =
    !!timeline?.enabled && Object.values(timeline.nodePeriods).some((id) => periodLabel.has(id));
  const periodOf = (node: string) =>
    periodLabel.get(timeline!.nodePeriods[normalizeName(node)] ?? '') ?? '';
  const header = [
    '출발 노드',
    '도착 노드',
    unit.trim() ? `값 (${unit.trim()})` : '값',
    '색상 그룹',
    '메모',
    ...(withPeriods ? ['출발 시기', '도착 시기'] : []),
  ];
  const lines = [header.map(escapeCell).join(',')];
  for (const r of rows) {
    const cells = [r.source, r.target, r.value, r.group ?? '', r.memo ?? ''];
    if (cells.every((c) => c.trim() === '')) continue;
    if (withPeriods) cells.push(periodOf(r.source), periodOf(r.target));
    lines.push(cells.map(escapeCell).join(','));
  }
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}
