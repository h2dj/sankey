import { describe, expect, it } from 'vitest';
import { buildGraph } from './buildGraph';
import { buildChartModel } from './chartModel';
import { DEFAULT_SETTINGS } from './config';
import { safeFilename } from './filename';
import { loadSample } from './samples';
import { documentText, renderSvgDocument, wrapText, type SvgDocumentOptions } from './svgDocument';

function setup(patch: Partial<SvgDocumentOptions> = {}) {
  const doc = loadSample('budget');
  const graph = buildGraph(doc.rows, doc.settings);
  const model = buildChartModel(graph, doc.rows, doc.meta, doc.settings, 800);
  const opts: SvgDocumentOptions = {
    title: doc.meta.title,
    description: doc.meta.description,
    unit: doc.meta.unit,
    settings: doc.settings,
    includeHeader: true,
    background: '#ffffff',
    ...patch,
  };
  return { model, opts, out: renderSvgDocument(model, opts) };
}

describe('renderSvgDocument', () => {
  it('제목·설명·단위·레이블을 담은 독립 SVG', () => {
    const { out, model } = setup();
    expect(out.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(out.width).toBe(800 + 48);
    expect(out.height).toBeGreaterThan(model.height + 48);
    expect(out.svg).toContain('>2026년 사업 예산 배분</text>');
    expect(out.svg).toContain('단위: 백만 원');
    expect(out.svg).toContain('전체 예산<tspan fill-opacity="0.7"> 100 백만 원</tspan>');
    expect(out.svg.match(/<path /g)).toHaveLength(10);
    expect(out.svg.match(/<rect x=/g)).toHaveLength(11);
    expect(out.svg).toContain('<rect width="100%" height="100%" fill="#ffffff"/>');
  });

  it('화면 상호작용 속성이 없다', () => {
    const { out } = setup();
    expect(out.svg).not.toMatch(/tabindex|role="button"|data-|aria-label=/);
  });

  it('XML 특수 문자를 이스케이프한다', () => {
    const { out } = setup({ title: 'A & B <테스트> "따옴표"' });
    expect(out.svg).toContain('A &amp; B &lt;테스트&gt; &quot;따옴표&quot;');
    // 파서로 읽을 수 있어야 한다(간단 검사: 태그 바깥의 < 없음)
    expect(out.svg).not.toContain('<테스트>');
  });

  it('머리글을 빼면 차트만, 투명 배경이면 배경 사각형 없음', () => {
    const { out, model } = setup({ includeHeader: false, background: null });
    expect(out.svg).not.toContain('2026년 사업 예산 배분</text>');
    expect(out.svg).not.toContain('단위:');
    expect(out.svg).not.toContain('height="100%"');
    expect(out.height).toBe(model.height + 48);
  });

  it('그라데이션 흐름은 defs를 포함한다', () => {
    const { out } = setup({ settings: { ...DEFAULT_SETTINGS, linkColor: 'gradient' } });
    expect(out.svg.match(/<linearGradient /g)).toHaveLength(10);
    expect(out.svg).toContain('stroke="url(#g0)"');
  });

  it('글꼴 CSS를 style에 넣는다', () => {
    const { out } = setup({ fontCss: '@font-face{font-family:Pretendard}' });
    expect(out.svg).toContain('<style>@font-face{font-family:Pretendard}</style>');
  });

  it('documentText: 굵기별 글자', () => {
    const { model, opts } = setup();
    const t = documentText(model, opts);
    expect(t.bold).toBe('2026년 사업 예산 배분');
    expect(t.regular).toContain('강사비');
    expect(t.regular).toContain('단위: 백만 원');
  });
});

describe('wrapText', () => {
  it('폭에 맞춰 단어 단위로 나눈다', () => {
    expect(wrapText('가나 다라 마바', 50, 10)).toEqual(['가나 다라', '마바']);
    expect(wrapText('한 줄', 1000, 10)).toEqual(['한 줄']);
  });

  it('긴 단어는 글자 단위로 자른다', () => {
    expect(wrapText('가나다라마바', 30, 10)).toEqual(['가나다', '라마바']);
  });

  it('줄바꿈을 지킨다', () => {
    expect(wrapText('첫째\n둘째', 1000, 10)).toEqual(['첫째', '둘째']);
  });
});

describe('safeFilename', () => {
  it.each([
    ['2026년 사업 예산 배분', 'png', '2026년 사업 예산 배분.png'],
    ['  a/b:c*?"<>|d  ', 'svg', 'a b c d.svg'],
    ['report.csv', 'csv', 'report.csv'],
    ['', 'png', 'sankey-diagram.png'],
    ['///', 'png', 'sankey-diagram.png'],
    ['con', 'csv', 'sankey-diagram.csv'],
    ['...숨김', 'png', '숨김.png'],
  ])('%j → %s', (name, ext, expected) => {
    expect(safeFilename(name, ext)).toBe(expected);
  });

  it('100자로 자른다', () => {
    expect(safeFilename('가'.repeat(150), 'png')).toBe(`${'가'.repeat(100)}.png`);
  });
});
