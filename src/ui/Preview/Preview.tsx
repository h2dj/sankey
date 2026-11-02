import type { BuildResult, DiagramMeta, Settings } from '../../core/types';
import { SankeyChart } from './SankeyChart';
import styles from './Preview.module.css';

interface Props {
  graph: BuildResult;
  meta: DiagramMeta;
  settings: Settings;
}

export function Preview({ graph, meta, settings }: Props) {
  if (!graph.drawable) {
    const blocking = graph.issues.find((i) => i.code === 'CYCLE');
    return (
      <div className={styles.empty} role="note">
        {blocking ? (
          <>
            <strong>다이어그램을 그릴 수 없습니다.</strong>
            <p>{blocking.message}</p>
          </>
        ) : (
          <p>출발 노드, 도착 노드, 값을 입력하면 다이어그램이 나타납니다.</p>
        )}
      </div>
    );
  }

  return (
    <figure className={styles.figure}>
      <SankeyChart graph={graph} meta={meta} settings={settings} />
      {(meta.description || meta.unit) && (
        <figcaption className={styles.caption}>
          {meta.description}
          {meta.unit && <span className={styles.unit}>단위: {meta.unit}</span>}
        </figcaption>
      )}
    </figure>
  );
}
