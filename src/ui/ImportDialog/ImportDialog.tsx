import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { LIMITS } from '../../core/config';
import {
  DELIMITER_LABEL,
  ENCODING_LABEL,
  checkMapping,
  columnNames,
  parseCsv,
  recordsToRows,
  serializeCsv,
  type CsvMapping,
  type ParsedCsv,
} from '../../core/csv';
import { loadSample } from '../../core/samples';
import { validate } from '../../core/validate';
import { downloadBlob } from '../../export/download';
import { josa } from '../../i18n/josa';
import { ko } from '../../i18n/ko';
import { announce } from '../../state/announce';
import { track } from '../../state/observe';
import { editorStore } from '../../state/store';
import { Dialog } from '../Dialog/Dialog';
import { Radio } from '../SettingsPanel/controls';
import styles from './ImportDialog.module.css';

interface Props {
  /** 끌어다 놓기로 받은 파일(있으면 바로 읽는다) */
  initialFile: File | null;
  onClose(): void;
}

type State =
  | { step: 'pick' }
  | { step: 'error'; fileName: string; error: string }
  | {
      step: 'map';
      fileName: string;
      csv: ParsedCsv;
      hasHeader: boolean;
      mapping: CsvMapping;
    };

const FIELDS = ['source', 'target', 'value', 'group', 'memo'] as const;

async function readCsvFile(file: File): Promise<State> {
  const res = parseCsv(new Uint8Array(await file.arrayBuffer()));
  return res.ok
    ? {
        step: 'map',
        fileName: file.name,
        csv: res.csv,
        hasHeader: res.csv.hasHeader,
        mapping: res.csv.mapping,
      }
    : { step: 'error', fileName: file.name, error: res.error };
}

export function ImportDialog({ initialFile, onClose }: Props) {
  const [state, setState] = useState<State>({ step: 'pick' });
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const show = (next: State) => {
    if (next.step === 'error') track('import_fail');
    setState(next);
  };
  const readFile = (file: File) => void readCsvFile(file).then(show);

  // 끌어다 놓은 파일이 있으면 바로 읽는다(처음 열 때 한 번).
  useEffect(() => {
    if (initialFile)
      void readCsvFile(initialFile).then((next) => {
        if (next.step === 'error') track('import_fail');
        setState(next);
      });
  }, [initialFile]);

  const close = onClose;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const mapped = useMemo(() => {
    if (state.step !== 'map') return null;
    const problem = checkMapping(state.mapping, state.csv.columnCount);
    const { rows, dropped } = recordsToRows(state.csv, state.mapping, state.hasHeader, Infinity);
    const { issues } = validate(rows.slice(0, LIMITS.maxRows));
    return {
      problem,
      rows,
      dropped,
      errors: issues.filter((i) => i.level === 'error').length,
    };
  }, [state]);

  const confirm = () => {
    if (state.step !== 'map' || !mapped || mapped.problem) return;
    const { dropped } = editorStore.getState().importRows(mapped.rows, mode, state.csv.unit);
    const imported = mapped.rows.length - dropped;
    track('import_ok', {
      rows: imported,
      encoding: state.csv.encoding,
      mode,
      header: state.hasHeader,
      remapped: JSON.stringify(state.mapping) !== JSON.stringify(state.csv.mapping),
    });
    announce(
      `${state.fileName}에서 ${imported}행을 ${mode === 'replace' ? '가져왔습니다' : '추가했습니다'}.` +
        (dropped > 0 ? ` 최대 ${LIMITS.maxRows}행을 넘는 ${dropped}행은 제외했습니다.` : '') +
        ' Ctrl+Z로 되돌릴 수 있습니다.',
    );
    close();
  };

  const downloadSample = () => {
    const doc = loadSample('budget');
    downloadBlob(
      new Blob([serializeCsv(doc.rows, doc.meta.unit)], { type: 'text/csv;charset=utf-8' }),
      '예시-사업예산.csv',
    );
  };

  const filePicker = (
    <div
      className={dragging ? `${styles.drop} ${styles.dragging}` : styles.drop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <p>CSV 파일을 여기에 끌어다 놓거나</p>
      <button type="button" onClick={() => inputRef.current?.click()}>
        파일 선택…
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
        className="sr-only"
        aria-label="CSV 파일 선택"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) readFile(file);
        }}
      />
      <p className={styles.help}>
        첫 줄에 <b>출발 노드, 도착 노드, 값</b>(선택: 색상 그룹, 메모) 열 이름을 두면 자동으로
        맞춰집니다. 엑셀에서는 "CSV UTF-8(쉼표로 분리)"로 저장하세요. 한글 윈도 기본 CSV(EUC-KR)도
        읽을 수 있습니다.{' '}
        <button type="button" className={styles.link} onClick={downloadSample}>
          예시 CSV 내려받기
        </button>
      </p>
      <p className={styles.help}>파일은 이 브라우저 안에서만 읽고, 서버로 보내지 않습니다.</p>
    </div>
  );

  return (
    <Dialog
      title="CSV 가져오기"
      onClose={close}
      footer={
        <>
          <button type="button" onClick={close}>
            취소
          </button>
          {state.step === 'map' && (
            <button
              type="button"
              className="primary"
              onClick={confirm}
              disabled={!!mapped?.problem || mapped?.rows.length === 0}
            >
              {mode === 'replace' ? '가져오기' : '뒤에 추가'}
            </button>
          )}
        </>
      }
    >
      {state.step === 'pick' && filePicker}

      {state.step === 'error' && (
        <>
          <div className={styles.error} role="alert">
            <strong>{josa(state.fileName, '을/를')} 읽지 못했습니다.</strong>
            <p>{state.error}</p>
            <p>지금 표의 데이터는 그대로 있습니다.</p>
          </div>
          {filePicker}
        </>
      )}

      {state.step === 'map' && mapped && (
        <>
          <p className={styles.summary}>
            <b>{state.fileName}</b> · {ENCODING_LABEL[state.csv.encoding]} ·{' '}
            {DELIMITER_LABEL[state.csv.delimiter] ?? state.csv.delimiter} 구분 ·{' '}
            {state.csv.records.length - (state.hasHeader ? 1 : 0)}줄
            {state.csv.unit && ` · 단위 "${state.csv.unit}"`}
          </p>

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={state.hasHeader}
              onChange={(e) => setState({ ...state, hasHeader: e.target.checked })}
            />
            첫 줄은 열 이름입니다
          </label>

          <fieldset className={styles.mapping}>
            <legend>열 맞추기</legend>
            {FIELDS.map((field) => {
              const optional = field === 'group' || field === 'memo';
              const value = state.mapping[field];
              return (
                <label key={field}>
                  <span>
                    {ko.columns[field]}
                    {!optional && <span className={styles.required}> *</span>}
                  </span>
                  <select
                    value={value === null ? '' : String(value)}
                    onChange={(e) =>
                      setState({
                        ...state,
                        mapping: {
                          ...state.mapping,
                          [field]: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  >
                    {optional && <option value="">사용 안 함</option>}
                    {columnNames(state.csv, state.hasHeader).map((name, i) => (
                      <option key={i} value={i}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </fieldset>

          {mapped.problem ? (
            <p className={styles.error} role="alert">
              {mapped.problem}
            </p>
          ) : (
            <>
              <div className={styles.previewWrap}>
                <table className={styles.preview}>
                  <caption>미리보기(처음 5행)</caption>
                  <thead>
                    <tr>
                      {FIELDS.map((f) => (
                        <th key={f} scope="col">
                          {ko.columns[f]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mapped.rows.slice(0, 5).map((r) => (
                      <tr key={r.id}>
                        <td>{r.source}</td>
                        <td>{r.target}</td>
                        <td className={styles.num}>{r.value}</td>
                        <td>{r.group}</td>
                        <td>{r.memo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.summary} data-testid="import-summary">
                {mapped.rows.length}행을 읽었습니다.
                {mapped.rows.length > LIMITS.maxRows &&
                  ` 최대 ${LIMITS.maxRows}행까지만 가져옵니다.`}
                {mapped.errors > 0 &&
                  ` 가져온 뒤 고칠 입력 오류가 ${mapped.errors}건 있습니다(표에 표시됩니다).`}
              </p>
            </>
          )}

          <Radio
            legend="지금 표의 데이터는"
            value={mode}
            options={[
              ['replace', '새 데이터로 바꾸기'],
              ['append', '유지하고 뒤에 추가하기'],
            ]}
            onChange={setMode}
          />
          <button type="button" className={styles.link} onClick={() => setState({ step: 'pick' })}>
            다른 파일 고르기
          </button>
        </>
      )}
    </Dialog>
  );
}
