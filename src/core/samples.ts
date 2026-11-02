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
  return createDoc({
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
}
