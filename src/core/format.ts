import type { Settings } from './types';

type NumberFormat = Settings['numberFormat'];

const DEFAULT_FORMAT: NumberFormat = { decimals: 'auto', thousands: true };

/** 화면·레이블용 숫자 표기. 'auto'는 소수 둘째 자리까지 필요한 만큼만 보인다. */
export function formatValue(value: number, format: NumberFormat = DEFAULT_FORMAT): string {
  const opts: Intl.NumberFormatOptions = { useGrouping: format.thousands };
  if (format.decimals === 'auto') {
    opts.maximumFractionDigits = 2;
  } else {
    opts.minimumFractionDigits = format.decimals;
    opts.maximumFractionDigits = format.decimals;
  }
  return new Intl.NumberFormat('ko-KR', opts).format(value);
}

/** "40 백만 원"처럼 값과 단위를 붙인다. 단위가 없으면 숫자만. */
export function formatWithUnit(value: number, unit: string, format?: NumberFormat): string {
  const n = formatValue(value, format);
  return unit.trim() ? `${n} ${unit.trim()}` : n;
}
