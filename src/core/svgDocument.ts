import type { ChartModel } from './chartModel';
import { TEXT_DARK } from './palette';
import { wrapText } from './text';

export { wrapText };
import type { Settings } from './types';

export const FONT_STACK =
  "Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";
const TEXT_MUTED = '#57606A';
/** 시기 띠(미리보기 SankeyChart와 같은 값) */
const BAND_FILL = '#EEF2F7';
const BAND_LINE = '#C9D1D9';
const NOTE_COLOR = '#2F6FB3';

export interface SvgDocumentOptions {
  title: string;
  description: string;
  unit: string;
  settings: Pick<Settings, 'fontSize' | 'showValues' | 'linkColor'>;
  /** 제목·설명·단위를 그림에 넣을지 */
  includeHeader: boolean;
  /** 배경색. null이면 투명 */
  background: string | null;
  /** <style>에 넣을 @font-face 규칙(글꼴 포함 시) */
  fontCss?: string;
  padding?: number;
}

export interface SvgDocument {
  svg: string;
  width: number;
  height: number;
}

const esc = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const n = (v: number) => String(Math.round(v * 100) / 100);

/**
 * 내보내기용 독립 SVG 문서(제목·설명·차트·단위). 화면 상호작용 속성은 넣지 않는다.
 * 텍스트는 <text>로 남겨 일러스트레이터 등에서 고칠 수 있다.
 */
export function renderSvgDocument(model: ChartModel, opts: SvgDocumentOptions): SvgDocument {
  const pad = opts.padding ?? 24;
  const fs = opts.settings.fontSize;
  const titleSize = Math.round(fs * 1.6);
  const width = model.width + pad * 2;
  const parts: string[] = [];
  let y = pad;

  const header: string[] = [];
  if (opts.includeHeader && opts.title.trim()) {
    for (const line of wrapText(opts.title.trim(), model.width, titleSize)) {
      y += titleSize;
      header.push(
        `<text x="${pad}" y="${n(y)}" font-size="${titleSize}" font-weight="600" fill="${TEXT_DARK}">${esc(line)}</text>`,
      );
      y += titleSize * 0.35;
    }
    y += 4;
  }
  if (opts.includeHeader && opts.description.trim()) {
    for (const line of wrapText(opts.description.trim(), model.width, fs)) {
      y += fs * 1.2;
      header.push(`<text x="${pad}" y="${n(y)}" fill="${TEXT_MUTED}">${esc(line)}</text>`);
      y += fs * 0.25;
    }
  }
  if (header.length > 0) y += fs;

  const chartTop = y;
  y += model.height;

  // 각주 모드: 차트 아래에 "[1] 노드 — 메모" 목록
  const notesBlock: string[] = [];
  if (model.footnotes.length > 0) {
    const noteFs = fs * 0.9;
    y += fs * 0.6;
    for (const f of model.footnotes) {
      const lines = wrapText(`${f.mark} ${f.label} — ${f.text}`, model.width, noteFs);
      for (const line of lines) {
        y += noteFs * 1.35;
        notesBlock.push(
          `<text x="${pad}" y="${n(y)}" font-size="${n(noteFs)}" fill="${TEXT_DARK}">${esc(line)}</text>`,
        );
      }
    }
  }

  let footer = '';
  if (opts.includeHeader && opts.unit.trim()) {
    y += fs * 1.4;
    footer = `<text x="${pad + model.width}" y="${n(y)}" font-size="${n(fs * 0.9)}" text-anchor="end" fill="${TEXT_MUTED}">${esc(`단위: ${opts.unit.trim()}`)}</text>`;
  }
  const height = Math.ceil(y + pad);

  const gradient = opts.settings.linkColor === 'gradient';
  const title = opts.title.trim() || '생키 다이어그램';
  const desc =
    `노드 ${model.nodes.length}개, 흐름 ${model.links.length}개. ` +
    model.links.map((l) => `${l.sourceLabel} → ${l.targetLabel} ${l.valueText}`).join(', ');

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="sankey-title sankey-desc" font-family="${esc(FONT_STACK)}" font-size="${fs}">`,
    `<title id="sankey-title">${esc(title)}</title>`,
    `<desc id="sankey-desc">${esc(desc)}</desc>`,
  );
  if (opts.fontCss) parts.push(`<style>${opts.fontCss}</style>`);
  if (gradient) {
    parts.push('<defs>');
    model.links.forEach((l, i) => {
      parts.push(
        `<linearGradient id="g${i}" gradientUnits="userSpaceOnUse" x1="${n(l.sx)}" x2="${n(l.tx)}" y1="0" y2="0"><stop offset="0%" stop-color="${l.sourceColor}"/><stop offset="100%" stop-color="${l.targetColor}"/></linearGradient>`,
      );
    });
    parts.push('</defs>');
  }
  if (opts.background) {
    parts.push(`<rect width="100%" height="100%" fill="${esc(opts.background)}"/>`);
  }
  parts.push(...header);

  parts.push(`<g transform="translate(${pad},${n(chartTop)})">`);
  if (model.showBands) {
    for (const p of model.periods) {
      if (p.shaded) {
        parts.push(
          `<rect x="${n(p.x0)}" y="0" width="${n(p.x1 - p.x0)}" height="${model.height}" fill="${BAND_FILL}"/>`,
        );
      }
      if (p.x0 > 0.5) {
        parts.push(
          `<line x1="${n(p.x0)}" x2="${n(p.x0)}" y1="0" y2="${model.height}" stroke="${BAND_LINE}" stroke-dasharray="4 4"/>`,
        );
      }
    }
  }
  parts.push('<g fill="none" stroke-opacity="0.45">');
  model.links.forEach((l, i) => {
    parts.push(
      `<path d="${l.path}" stroke="${gradient ? `url(#g${i})` : l.color}" stroke-width="${n(l.width)}"><title>${esc(`${l.sourceLabel} → ${l.targetLabel}: ${l.valueText}`)}</title></path>`,
    );
  });
  parts.push('</g>', '<g>');
  for (const node of model.nodes) {
    parts.push(
      `<rect x="${n(node.x0)}" y="${n(node.y0)}" width="${n(node.x1 - node.x0)}" height="${n(Math.max(1, node.y1 - node.y0))}" fill="${node.color}"><title>${esc(`${node.label}: ${node.valueText}`)}</title></rect>`,
    );
  }
  parts.push('</g>');
  parts.push(
    `<g fill="${TEXT_DARK}" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke">`,
  );
  for (const node of model.nodes) {
    const value = opts.settings.showValues
      ? `<tspan fill-opacity="0.7"> ${esc(node.valueText)}</tspan>`
      : '';
    const mark = node.noteMark
      ? `<tspan fill="${NOTE_COLOR}" font-weight="600"> ${esc(node.noteMark)}</tspan>`
      : '';
    parts.push(
      `<text x="${n(node.labelX)}" y="${n(node.labelY)}" dy="0.35em" text-anchor="${node.labelAnchor}">${esc(node.label)}${value}${mark}</text>`,
    );
    node.noteLines?.forEach((line, i) => {
      parts.push(
        `<text x="${n(node.labelX)}" y="${n(node.labelY + fs * (0.35 + 1.15 * (i + 1)))}" text-anchor="${node.labelAnchor}" font-size="${n(fs * 0.85)}" fill="${TEXT_MUTED}">${esc(line)}</text>`,
      );
    });
  }
  parts.push('</g>');
  for (const p of model.periods) {
    parts.push(
      `<text x="${n(p.cx)}" y="${n(p.labelY)}" text-anchor="middle" font-weight="600" fill="${TEXT_DARK}">${esc(p.label)}</text>`,
    );
    if (p.totalsText) {
      parts.push(
        `<text x="${n(p.cx)}" y="${n(p.totalsY)}" text-anchor="middle" font-size="${n(fs * 0.85)}" fill="${TEXT_MUTED}">${esc(p.totalsText)}</text>`,
      );
    }
  }
  parts.push('</g>', ...notesBlock, footer, '</svg>');

  return { svg: parts.filter(Boolean).join('\n'), width, height };
}

/** 글꼴 분할을 고르기 위한, 문서에 쓰이는 모든 글자(굵기별) */
export function documentText(model: ChartModel, opts: SvgDocumentOptions) {
  const regular = [
    opts.includeHeader ? opts.description : '',
    opts.includeHeader && opts.unit ? `단위: ${opts.unit}` : '',
    ...model.nodes.map((nd) => `${nd.label} ${opts.settings.showValues ? nd.valueText : ''}`),
    ...model.periods.map((p) => p.totalsText),
    ...model.nodes.flatMap((nd) => [nd.noteMark ?? '', ...(nd.noteLines ?? [])]),
    ...model.footnotes.map((f) => `${f.mark} ${f.label} — ${f.text}`),
  ].join('\n');
  const bold = [opts.includeHeader ? opts.title : '', ...model.periods.map((p) => p.label)].join(
    '\n',
  );
  return { regular, bold };
}
