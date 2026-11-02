import { createDoc, createRow } from './config';
import type { DiagramDoc } from './types';

/** 기획서 §3 대표 사용 사례에 맞춘 예시. 수치는 모두 가상이다. */

type SampleRow = [source: string, target: string, value: number, group?: string, memo?: string];

interface SampleDef {
  id: string;
  /** 예시 메뉴에 보이는 이름 */
  name: string;
  title: string;
  description: string;
  unit: string;
  rows: SampleRow[];
  /** 시기별 배치 예시: 시기 이름(순서대로)과 노드 → 시기 이름 */
  timeline?: { periods: string[]; nodes: Record<string, string> };
}

const DEFS: readonly SampleDef[] = [
  {
    id: 'budget',
    name: '사업 예산 배분',
    title: '2026년 사업 예산 배분',
    description: '전체 예산이 사업 분야와 세부 항목으로 나뉘는 흐름(가상 수치)',
    unit: '백만 원',
    rows: [
      ['전체 예산', '교육', 40, '사업 분야'],
      ['전체 예산', '운영', 30, '사업 분야'],
      ['전체 예산', '홍보', 20, '사업 분야'],
      ['전체 예산', '예비비', 10, '사업 분야'],
      ['교육', '강사비', 25, '세부 항목', '외부 강사 포함'],
      ['교육', '교재비', 15, '세부 항목'],
      ['운영', '인건비', 18, '세부 항목'],
      ['운영', '임대료', 12, '세부 항목'],
      ['홍보', '온라인 광고', 12, '세부 항목'],
      ['홍보', '인쇄물', 8, '세부 항목'],
    ],
  },
  {
    id: 'energy',
    name: '에너지 흐름',
    title: '지역 에너지 흐름',
    description: '에너지원이 발전·난방을 거쳐 부문별로 소비되는 흐름(가상 수치)',
    unit: 'GWh',
    rows: [
      ['석탄', '발전', 120, '에너지원'],
      ['천연가스', '발전', 80, '에너지원'],
      ['태양광', '발전', 40, '에너지원'],
      ['천연가스', '지역난방', 30, '에너지원'],
      ['발전', '가정', 70, '소비'],
      ['발전', '산업', 110, '소비'],
      ['발전', '전환 손실', 60, '손실'],
      ['지역난방', '가정', 30, '소비'],
    ],
  },
  {
    id: 'program',
    name: '프로그램 참여 단계',
    title: '청년 일자리 프로그램 참여 경로',
    description: '신청자가 선발·교육을 거쳐 성과로 이어지는 단계(가상 수치)',
    unit: '명',
    rows: [
      ['신청', '서류 통과', 180],
      ['신청', '서류 탈락', 70],
      ['서류 통과', '교육 수료', 140],
      ['서류 통과', '중도 포기', 40],
      ['교육 수료', '취업 연계', 90],
      ['교육 수료', '후속 과정', 50],
    ],
  },
  {
    id: 'survey',
    name: '설문 응답 경로',
    title: '연령대별 주 출근 수단',
    description: '설문 응답자가 연령대별로 선택한 출근 수단(가상 수치)',
    unit: '명',
    rows: [
      ['전체 응답자', '20대', 100, '연령대'],
      ['전체 응답자', '30대', 100, '연령대'],
      ['전체 응답자', '40대 이상', 100, '연령대'],
      ['20대', '대중교통', 60, '출근 수단'],
      ['20대', '자전거·도보', 25, '출근 수단'],
      ['20대', '자가용', 15, '출근 수단'],
      ['30대', '대중교통', 45, '출근 수단'],
      ['30대', '자가용', 55, '출근 수단'],
      ['40대 이상', '대중교통', 30, '출근 수단'],
      ['40대 이상', '자가용', 70, '출근 수단'],
    ],
  },
  {
    id: 'history',
    name: '시기별 단체 흐름',
    title: '시민사회 IT 활동가의 흐름',
    description:
      '활동가들이 시기마다 어느 모임·단체로 옮겨 갔는지(가상 수치). 시기별 배치를 켠 예시입니다.',
    unit: '명',
    rows: [
      ['진보네트워크', '정보통신활동가네트워크', 3],
      ['노동네트워크', '정보통신활동가네트워크', 2],
      ['시민단체 활동가', '정보통신활동가네트워크', 4],
      ['정보통신활동가네트워크', 'IT단체설립모임', 6],
      ['정보통신활동가네트워크', '오픈소스운동', 3],
      ['희망제작소', 'IT단체설립모임', 3, undefined, '시기를 정하지 않음(자동)'],
      ['IT단체설립모임', '비영리IT지원센터', 9],
      ['오픈소스운동', '비영리IT지원센터', 3],
      ['비영리IT지원센터', '공동체IT', 8],
      ['비영리IT지원센터', '지역 IT교실', 4],
    ],
    timeline: {
      periods: ['2000', '2005', '2010', '2015', '2020'],
      nodes: {
        진보네트워크: '2000',
        노동네트워크: '2000',
        '시민단체 활동가': '2000',
        정보통신활동가네트워크: '2005',
        IT단체설립모임: '2010',
        오픈소스운동: '2010',
        비영리IT지원센터: '2015',
        공동체IT: '2020',
        '지역 IT교실': '2020',
      },
    },
  },
];

export interface SampleInfo {
  id: string;
  name: string;
}

export const SAMPLES: readonly SampleInfo[] = DEFS.map(({ id, name }) => ({ id, name }));

export const DEFAULT_SAMPLE_ID = 'budget';

/** 예시를 편집 가능한 새 문서로 만든다. 부를 때마다 새 행 ID를 발급한다. */
export function loadSample(id: string): DiagramDoc {
  const def = DEFS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown sample: ${id}`);
  const doc = createDoc({
    meta: { title: def.title, description: def.description, unit: def.unit },
    rows: def.rows.map(([source, target, value, group, memo]) =>
      createRow({
        source,
        target,
        value: String(value),
        ...(group !== undefined && { group }),
        ...(memo !== undefined && { memo }),
      }),
    ),
  });
  if (def.timeline) {
    const periods = def.timeline.periods.map((label, i) => ({ id: `${def.id}-${i}`, label }));
    const idOf = new Map(periods.map((p) => [p.label, p.id]));
    doc.settings.timeline = {
      ...doc.settings.timeline,
      enabled: true,
      periods,
      nodePeriods: Object.fromEntries(
        Object.entries(def.timeline.nodes).map(([node, label]) => [node, idOf.get(label)!]),
      ),
      showTotals: true,
    };
  }
  return doc;
}
