import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

interface Props {
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * 네이티브 <dialog> 모달. 열 때만 마운트한다(닫으면 내용 상태가 사라진다).
 * 초점 가두기·Esc 닫기는 브라우저가 맡고, 닫은 뒤에는 열기 전 초점 위치로 되돌린다.
 */
export function Dialog({ title, onClose, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    el?.showModal();
    // showModal은 첫 초점 대상(머리글의 닫기 버튼)에 초점을 준다. 본문에서 시작하도록 옮긴다:
    // data-autofocus가 있으면 그것, 없으면 본문의 첫 입력 요소.
    const first = el?.querySelector<HTMLElement>(
      `[data-autofocus], .${styles.body} :is(input:not([type=hidden]):not([tabindex="-1"]), select, textarea, button:not([hidden]))`,
    );
    first?.focus();
    return () => {
      if (el?.open) el.close();
      opener?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Esc: 브라우저가 닫기 전에 부모에게 알린다(부모가 마운트를 해제한다).
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // 바깥(배경)을 누르면 닫는다.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </dialog>
  );
}
