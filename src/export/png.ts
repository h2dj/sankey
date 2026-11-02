/**
 * SVG 문자열 → PNG Blob. 글꼴은 SVG 안에 data URI로 들어 있어야 한다(embeddedFontCss).
 */
export async function svgToPng(
  svg: string,
  size: { width: number; height: number },
  scale: number,
  background: string | null,
): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    img.src = url;
    await img.decode();
    // SVG 안의 data URI 글꼴은 이미지 디코딩 뒤에 적용되는 브라우저가 있어 한 프레임 기다린다.
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(size.width * scale);
    canvas.height = Math.round(size.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이 브라우저에서는 PNG를 만들 수 없습니다.');
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('PNG를 만들지 못했습니다.'))),
        'image/png',
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
