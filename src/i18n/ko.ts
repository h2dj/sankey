/**
 * 화면 문자열을 한곳에 모은다. 영문 UI를 추가할 때 같은 모양의 en.ts를 만든다.
 */
export const ko = {
  app: {
    name: '생키 메이커',
    untitled: '제목 없는 다이어그램',
    privacyNotice: '이 브라우저에만 저장됩니다 · 서버로 전송하지 않습니다',
  },
  panel: {
    data: '데이터',
    preview: '미리보기',
    settings: '설정',
  },
  columns: {
    source: '출발 노드',
    target: '도착 노드',
    value: '값',
    group: '색상 그룹',
    memo: '메모',
  },
  issue: {
    required: (field: string) => `${field}을(를) 입력하세요.`,
    notNumber: (raw: string) => `"${raw}"은(는) 숫자가 아닙니다. 숫자만 입력하세요.`,
    notPositive: '값은 0보다 커야 합니다.',
    notFinite: '값이 너무 큽니다. 유한한 숫자를 입력하세요.',
    selfLoop: (name: string) =>
      `"${name}"이(가) 자기 자신으로 이어집니다. 이 행은 다이어그램에서 제외됩니다.`,
    duplicateMerged: (source: string, target: string, count: number) =>
      `"${source} → ${target}" 연결이 ${count}번 나와 하나로 합산했습니다. 설정에서 별도 흐름으로 바꿀 수 있습니다.`,
    duplicateSeparate: (source: string, target: string, count: number) =>
      `"${source} → ${target}" 연결이 ${count}번 나와 각각 따로 그렸습니다.`,
    cycle: (path: string[]) =>
      `순환 연결이 있어 다이어그램을 그릴 수 없습니다: ${path.join(' → ')}. 이 경로의 한 행을 고치세요.`,
    imbalance: (name: string, inflow: string, outflow: string) =>
      `"${name}"으로 들어오는 값(${inflow})과 나가는 값(${outflow})이 다릅니다.`,
    disconnected: (count: number) => `서로 이어지지 않은 다이어그램 묶음이 ${count}개 있습니다.`,
    rowLimit: (max: number) => `최대 ${max}행까지 입력할 수 있습니다.`,
    rowWarn: (count: number) => `행이 ${count}개입니다. 미리보기가 느려질 수 있습니다.`,
  },
} as const;
