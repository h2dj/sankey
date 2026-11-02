import type { Issue, IssueLevel, Row } from '../../core/types';
import { ko } from '../../i18n/ko';
import { focusCell } from '../focus';
import { LEVEL_LABEL, LEVEL_ORDER } from '../issues';
import styles from './IssueSummary.module.css';

interface Props {
  issues: readonly Issue[];
  rows: readonly Row[];
}

const LEVELS: IssueLevel[] = ['error', 'warning', 'info'];

/** 입력 문제 요약. 항목을 누르면 해당 셀로 이동한다. */
export function IssueSummary({ issues, rows }: Props) {
  const rowIndex = new Map(rows.map((r, i) => [r.id, i]));
  const counts = Object.fromEntries(
    LEVELS.map((l) => [l, issues.filter((i) => i.level === l).length]),
  );
  const sorted = [...issues].sort(
    (a, b) =>
      LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
      (rowIndex.get(a.rowId ?? '') ?? Infinity) - (rowIndex.get(b.rowId ?? '') ?? Infinity),
  );

  const summary =
    issues.length === 0
      ? '입력 문제 없음'
      : LEVELS.filter((l) => counts[l]! > 0)
          .map((l) => `${LEVEL_LABEL[l]} ${counts[l]}건`)
          .join(' · ');

  return (
    <section className={styles.box} aria-labelledby="issues-heading">
      <h3 id="issues-heading" className={styles.heading}>
        입력 확인{' '}
        <span className={styles.summary} role="status" aria-live="polite">
          {summary}
        </span>
      </h3>
      {sorted.length > 0 && (
        <ul className={styles.list}>
          {sorted.map((issue, i) => {
            const idx = issue.rowId !== undefined ? rowIndex.get(issue.rowId) : undefined;
            const where =
              idx !== undefined
                ? `${idx + 1}행${issue.field ? ` · ${ko.columns[issue.field]}` : ''}`
                : null;
            return (
              <li
                key={`${issue.code}-${issue.rowId ?? issue.nodeName ?? ''}-${issue.field ?? ''}-${i}`}
                className={styles[issue.level]}
              >
                <span className={styles.badge}>{LEVEL_LABEL[issue.level]}</span>
                {where && issue.rowId ? (
                  <button
                    type="button"
                    className={styles.where}
                    onClick={() => focusCell(issue.rowId!, issue.field ?? 'source')}
                  >
                    {where}
                  </button>
                ) : null}
                <span className={styles.message}>{issue.message}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
