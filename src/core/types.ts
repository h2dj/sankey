/**
 * 데이터 계약. 이후 모든 단계(validate → buildGraph → layout → render)가 이 타입에 의존한다.
 * 변경 시 schemaVersion 마이그레이션(persist.ts)도 함께 고친다.
 */

/** 입력 표의 한 행 = 연결 한 건. */
export interface Row {
  /** 안정 ID. 정렬·삭제 후에도 유지되어 차트 요소와 행을 잇는다. */
  id: string;
  /** 원문 그대로 저장한다. 비교할 때만 정규화한다. */
  source: string;
  target: string;
  /** 입력 원문. 검증 후 숫자로 변환한다. */
  value: string;
  /** 색상 그룹(선택). */
  group?: string;
  /** 편집용 메모(선택). 이미지 내보내기에는 포함하지 않는다. */
  memo?: string;
}

export type RowField = 'source' | 'target' | 'value' | 'group' | 'memo';

export interface DiagramMeta {
  title: string;
  description: string;
  /** 값의 단위. 예: 원, 명, kWh */
  unit: string;
}

export interface Settings {
  direction: 'ltr' | 'rtl';
  nodeAlign: 'justify' | 'left' | 'right' | 'center';
  /** px */
  nodeWidth: number;
  /** 노드 세로 간격(px) */
  nodePadding: number;
  /** 작은 흐름도 보이도록 하는 링크 최소 두께(px) */
  minLinkWidth: number;
  fontSize: number;
  showValues: boolean;
  /**
   * inside: 레이블을 차트 가운데 쪽에 둔다(양끝 열의 레이블이 차트 안쪽으로).
   * outside: 첫 열은 왼쪽 바깥, 마지막 열은 오른쪽 바깥에 두고 그만큼 여백을 잡는다.
   */
  labelPosition: 'outside' | 'inside';
  paletteId: string;
  /** 노드별 색 / 색상 그룹별 색 */
  colorMode: 'node' | 'group';
  linkColor: 'source' | 'target' | 'gradient' | 'neutral';
  /** 정규화된 노드 이름 → 색(#rrggbb) */
  nodeColorOverrides: Record<string, string>;
  /** 같은 출발·도착 쌍: 자동 합산 / 별도 흐름 */
  duplicateMode: 'merge' | 'separate';
  numberFormat: { decimals: number | 'auto'; thousands: boolean };
  /** 시기 축 배치(시기별로 열을 고정) */
  timeline: TimelineSettings;
  /** 노드 메모를 보이는 방식: 툴팁만 / 레이블 아래 / 레이블에 번호 + 차트 아래 각주 */
  noteDisplay: 'tooltip' | 'below' | 'footnote';
}

/** 시기(시간 축의 한 칸). 예: 2019년, 1단계 준비기 */
export interface Period {
  id: string;
  label: string;
}

export interface TimelineSettings {
  /** 켜면 노드를 지정한 시기의 열에 놓는다(연결 단계 깊이 대신) */
  enabled: boolean;
  /** 시간 순서대로 */
  periods: Period[];
  /** 정규화된 노드 이름 → 시기 id. 없는 노드는 연결을 따라 자동으로 놓는다 */
  nodePeriods: Record<string, string>;
  /** 시기마다 번갈아 칠한 배경 띠 */
  showBands: boolean;
  /** 시기 머리글 아래에 다른 시기에서 들어오고 나간 흐름 합계 */
  showTotals: boolean;
}

export interface DiagramDoc {
  schemaVersion: 1;
  meta: DiagramMeta;
  rows: Row[];
  /** 정규화된 노드 이름 → 노드 메모(차트에 툴팁·레이블 아래·각주로 보일 수 있다) */
  nodeNotes: Record<string, string>;
  settings: Settings;
  /** ISO 8601 */
  updatedAt: string;
}

export type IssueLevel = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'REQUIRED'
  | 'NOT_NUMBER'
  | 'NOT_POSITIVE'
  | 'NOT_FINITE'
  | 'SELF_LOOP'
  | 'DUPLICATE_PAIR'
  | 'CYCLE'
  | 'IMBALANCE'
  | 'DISCONNECTED_GROUPS'
  | 'ROW_LIMIT'
  | 'TIME_BACKWARD'
  | 'TIME_INFERRED';

export interface Issue {
  level: IssueLevel;
  code: IssueCode;
  rowId?: string;
  field?: RowField;
  nodeName?: string;
  /** 화면에 그대로 노출하는 문장(i18n/ko.ts에서 생성). */
  message: string;
}

export interface GraphNode {
  /** 정규화된 이름 */
  id: string;
  /** 처음 입력된 원문 이름(표시용) */
  label: string;
  group?: string;
  inflow: number;
  outflow: number;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  value: number;
  /** 이 링크를 만든 원본 행들. 차트 ↔ 표 연결에 쓴다. */
  rowIds: string[];
}

export interface BuildResult {
  nodes: GraphNode[];
  links: GraphLink[];
  issues: Issue[];
  /** 순환이나 유효 행 0개처럼 그리기 자체를 막는 오류가 있으면 false */
  drawable: boolean;
}
