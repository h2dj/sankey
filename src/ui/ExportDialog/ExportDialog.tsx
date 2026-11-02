import { useId, useState } from 'react';
import { safeFilename } from '../../core/filename';
import { downloadBlob } from '../../export/download';
import { exportDiagram, type ExportFormat, type ExportOptions } from '../../export/exportDiagram';
import { announce } from '../../state/announce';
import { track } from '../../state/observe';
import { editorStore } from '../../state/store';
import { Dialog } from '../Dialog/Dialog';
import { Radio } from '../SettingsPanel/controls';
import styles from './ExportDialog.module.css';

interface Props {
  onClose(): void;
  /** 그릴 수 있는 상태인지(아니면 PNG·SVG를 막는다) */
  drawable: boolean;
  /** 지금 미리보기의 차트 폭 */
  previewWidth: number;
}

const WIDTHS = [960, 1280, 1600] as const;

/** 같은 세션에서 다시 열면 지난번 선택을 유지한다(파일 이름은 매번 지금 제목으로). */
let lastPrefs: Omit<ExportOptions, 'filename' | 'width'> & {
  width: 'preview' | (typeof WIDTHS)[number];
} = {
  format: 'png',
  width: 'preview',
  includeHeader: true,
  scale: 2,
  transparent: false,
  embedFont: false,
};

export function ExportDialog({ onClose, drawable, previewWidth }: Props) {
  const nameId = useId();
  const [format, setFormat] = useState<ExportFormat>(lastPrefs.format);
  const [filename, setFilename] = useState(() => editorStore.getState().doc.meta.title);
  const [width, setWidth] = useState(lastPrefs.width);
  const [includeHeader, setIncludeHeader] = useState(lastPrefs.includeHeader);
  const [scale, setScale] = useState<ExportOptions['scale']>(lastPrefs.scale);
  const [transparent, setTransparent] = useState(lastPrefs.transparent);
  const [embedFont, setEmbedFont] = useState(lastPrefs.embedFont);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const image = format !== 'csv';
  const effectiveFormat = !drawable && image ? 'csv' : format;
  const chartWidth = width === 'preview' ? previewWidth : width;
  const finalName = safeFilename(filename, effectiveFormat);

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await exportDiagram(editorStore.getState().doc, {
        format: effectiveFormat,
        filename,
        width: chartWidth,
        includeHeader,
        scale,
        transparent,
        embedFont,
      });
      downloadBlob(result.blob, result.filename);
      track('export', {
        format: effectiveFormat,
        scale: effectiveFormat === 'png' ? scale : 0,
        width: chartWidth,
        header: includeHeader,
      });
      lastPrefs = { format, width, includeHeader, scale, transparent, embedFont };
      const size = result.size ? ` (${result.size.width}×${result.size.height}px)` : '';
      announce(`${result.filename}${size} 파일을 내려받았습니다.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      track('export_fail', { format: effectiveFormat });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="내려받기"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="button" className="primary" onClick={run} disabled={busy}>
            {busy ? '만드는 중…' : `${effectiveFormat.toUpperCase()} 내려받기`}
          </button>
        </>
      }
    >
      <Radio
        legend="형식"
        value={effectiveFormat}
        options={[
          ['png', 'PNG 이미지 — 문서·메신저·발표 자료에 바로 넣기'],
          ['svg', 'SVG 벡터 — 크기를 바꿔도 선명, 편집 프로그램에서 수정'],
          ['csv', 'CSV 데이터 — 입력 데이터 보관·다시 불러오기'],
        ]}
        onChange={setFormat}
      />
      {!drawable && (
        <p className={styles.note}>
          지금은 다이어그램을 그릴 수 없어 CSV만 내려받을 수 있습니다. 입력 오류를 고치면 이미지도
          내려받을 수 있습니다.
        </p>
      )}

      <div className={styles.field}>
        <label htmlFor={nameId}>파일 이름</label>
        <input
          id={nameId}
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="sankey-diagram"
        />
        <span className={styles.hint} data-testid="export-filename">
          저장될 이름: {finalName}
        </span>
      </div>

      {image && drawable && (
        <>
          <div className={styles.row}>
            <label className={styles.inline}>
              차트 폭
              <select
                value={String(width)}
                onChange={(e) =>
                  setWidth(
                    e.target.value === 'preview'
                      ? 'preview'
                      : (Number(e.target.value) as (typeof WIDTHS)[number]),
                  )
                }
              >
                <option value="preview">지금 미리보기와 같게 ({previewWidth}px)</option>
                {WIDTHS.map((w) => (
                  <option key={w} value={w}>
                    {w}px
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.inline}>
              <input
                type="checkbox"
                checked={includeHeader}
                onChange={(e) => setIncludeHeader(e.target.checked)}
              />
              제목·설명·단위 포함
            </label>
          </div>

          {format === 'png' && (
            <div className={styles.row}>
              <Radio
                legend="해상도"
                value={String(scale) as '1' | '2' | '3'}
                options={[
                  ['1', '1배(기본)'],
                  ['2', '2배(선명, 권장)'],
                  ['3', '3배(인쇄용)'],
                ]}
                onChange={(v) => setScale(Number(v) as ExportOptions['scale'])}
              />
              <Radio
                legend="배경"
                value={transparent ? 'transparent' : 'white'}
                options={[
                  ['white', '흰색'],
                  ['transparent', '투명'],
                ]}
                onChange={(v) => setTransparent(v === 'transparent')}
              />
            </div>
          )}

          {format === 'svg' && (
            <div className={styles.row}>
              <label className={styles.inline}>
                <input
                  type="checkbox"
                  checked={transparent}
                  onChange={(e) => setTransparent(e.target.checked)}
                />
                투명 배경
              </label>
              <label className={styles.inline}>
                <input
                  type="checkbox"
                  checked={embedFont}
                  onChange={(e) => setEmbedFont(e.target.checked)}
                />
                글꼴 포함(다른 컴퓨터에서도 같은 모양, 파일이 커짐)
              </label>
            </div>
          )}
        </>
      )}

      {format === 'csv' && (
        <p className={styles.note}>
          UTF-8 CSV로 저장합니다(엑셀에서 한글이 깨지지 않도록 BOM 포함). 다시 불러오면 같은 표가
          됩니다. 제목·설명·색상 설정은 CSV에 들어가지 않고, 단위는 값 열 이름에 붙습니다.
        </p>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
