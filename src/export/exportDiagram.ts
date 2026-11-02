import { buildGraph } from '../core/buildGraph';
import { buildChartModel } from '../core/chartModel';
import { serializeCsv } from '../core/csv';
import { safeFilename } from '../core/filename';
import { documentText, renderSvgDocument } from '../core/svgDocument';
import type { DiagramDoc } from '../core/types';
import { embeddedFontCss } from './fonts';
import { svgToPng } from './png';

export type ExportFormat = 'png' | 'svg' | 'csv';

export interface ExportOptions {
  format: ExportFormat;
  filename: string;
  /** 차트 폭(px) */
  width: number;
  includeHeader: boolean;
  /** PNG 배율 */
  scale: 1 | 2 | 3;
  /** PNG 배경. false면 투명. SVG는 항상 흰 배경을 넣지 않고 transparent 옵션을 따른다 */
  transparent: boolean;
  /** SVG에 글꼴을 넣을지(PNG는 항상 넣는다) */
  embedFont: boolean;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  /** PNG·SVG의 픽셀 크기 */
  size?: { width: number; height: number };
}

const BACKGROUND = '#ffffff';

export async function exportDiagram(doc: DiagramDoc, opts: ExportOptions): Promise<ExportResult> {
  if (opts.format === 'csv') {
    return {
      blob: new Blob([serializeCsv(doc.rows, doc.meta.unit, doc.settings.timeline)], {
        type: 'text/csv;charset=utf-8',
      }),
      filename: safeFilename(opts.filename, 'csv'),
    };
  }

  const graph = buildGraph(doc.rows, doc.settings);
  if (!graph.drawable)
    throw new Error('다이어그램을 그릴 수 없는 상태입니다. 입력 오류를 먼저 고치세요.');
  const model = buildChartModel(graph, doc.rows, doc.meta, doc.settings, opts.width);
  const base = {
    title: doc.meta.title,
    description: doc.meta.description,
    unit: doc.meta.unit,
    settings: doc.settings,
    includeHeader: opts.includeHeader,
    background: opts.transparent ? null : BACKGROUND,
  };
  const needFont = opts.format === 'png' || opts.embedFont;
  const fontCss = needFont ? await embeddedFontCss(documentText(model, base)) : undefined;
  const { svg, width, height } = renderSvgDocument(model, { ...base, ...(fontCss && { fontCss }) });

  if (opts.format === 'svg') {
    return {
      blob: new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
      filename: safeFilename(opts.filename, 'svg'),
      size: { width, height },
    };
  }

  const blob = await svgToPng(svg, { width, height }, opts.scale, base.background);
  return {
    blob,
    filename: safeFilename(opts.filename, 'png'),
    size: { width: width * opts.scale, height: height * opts.scale },
  };
}
