/** 브라우저에서 파일을 내려받게 한다. 서버로 아무것도 보내지 않는다. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 일부 브라우저는 click 직후 URL을 해제하면 내려받기가 취소된다.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
