import { useState } from 'react';
import { DEFAULT_SAMPLE_ID, loadSample } from './core/samples';
import { ko } from './i18n/ko';

/**
 * S0 앱 껍데기. 화면 영역(상단 바·입력·미리보기)만 잡아 둔다.
 * 편집 가능한 표는 T1.4, 미리보기는 T1.5에서 채운다.
 */
export function App() {
  const [doc] = useState(() => loadSample(DEFAULT_SAMPLE_ID));
  const cols = ko.columns;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="topbar__title">{doc.meta.title || ko.app.untitled}</h1>
        <p className="topbar__notice">{ko.app.privacyNotice}</p>
      </header>
      <main className="workspace">
        <section className="panel" aria-labelledby="panel-data">
          <h2 id="panel-data">{ko.panel.data}</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{cols.source}</th>
                <th scope="col">{cols.target}</th>
                <th scope="col">
                  {cols.value}
                  {doc.meta.unit && ` (${doc.meta.unit})`}
                </th>
                <th scope="col">{cols.group}</th>
              </tr>
            </thead>
            <tbody>
              {doc.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.source}</td>
                  <td>{row.target}</td>
                  <td className="num">{row.value}</td>
                  <td>{row.group}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel" aria-labelledby="panel-preview">
          <h2 id="panel-preview">{ko.panel.preview}</h2>
          <p className="placeholder">다이어그램 미리보기는 다음 단계(S1)에서 표시됩니다.</p>
        </section>
      </main>
    </div>
  );
}
