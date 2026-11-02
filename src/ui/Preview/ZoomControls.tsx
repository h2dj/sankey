import { useEffect, useState, type RefObject } from 'react';
import { ZOOM_STEPS } from './items';
import styles from './Preview.module.css';

interface Props {
  zoomIndex: number;
  onZoom(index: number): void;
  fullscreenTarget: RefObject<HTMLElement | null>;
  hasSelection: boolean;
  onClearSelection(): void;
}

export function ZoomControls({
  zoomIndex,
  onZoom,
  fullscreenTarget,
  hasSelection,
  onClearSelection,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void fullscreenTarget.current?.requestFullscreen();
  };

  const pct = Math.round(ZOOM_STEPS[zoomIndex]! * 100);

  return (
    <div className={styles.controls} role="toolbar" aria-label="미리보기 보기 설정">
      <button
        type="button"
        onClick={() => onZoom(Math.max(0, zoomIndex - 1))}
        disabled={zoomIndex === 0}
        aria-label="축소"
        title="축소"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => onZoom(ZOOM_STEPS.indexOf(1))}
        aria-label={`확대 비율 ${pct}%, 누르면 화면에 맞춤`}
        title="화면에 맞춤"
        className={styles.zoomLevel}
      >
        {pct}%
      </button>
      <button
        type="button"
        onClick={() => onZoom(Math.min(ZOOM_STEPS.length - 1, zoomIndex + 1))}
        disabled={zoomIndex === ZOOM_STEPS.length - 1}
        aria-label="확대"
        title="확대"
      >
        +
      </button>
      {canFullscreen && (
        <button type="button" onClick={toggleFullscreen}>
          {isFullscreen ? '전체 화면 끝내기' : '전체 화면'}
        </button>
      )}
      {hasSelection && (
        <button type="button" onClick={onClearSelection}>
          선택 해제
        </button>
      )}
    </div>
  );
}
