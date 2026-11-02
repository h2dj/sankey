import { useId, type ReactNode } from 'react';
import styles from './SettingsPanel.module.css';

/** 설정 패널의 입력 컨트롤. 모두 label과 연결되어 키보드·스크린리더로 쓸 수 있다. */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className={styles.section} open>
      <summary>{title}</summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  onChange(v: string): void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const common = {
    id,
    value: props.value,
    placeholder: props.placeholder,
    onChange: (e: { target: { value: string } }) => props.onChange(e.target.value),
  };
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{props.label}</label>
      {props.multiline ? <textarea rows={2} {...common} /> : <input type="text" {...common} />}
    </div>
  );
}

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange(v: number): void;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {props.label}{' '}
        <output htmlFor={id} className={styles.output}>
          {props.value}
          {props.unit}
        </output>
      </label>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Radio<T extends string>(props: {
  legend: string;
  value: T;
  options: readonly (readonly [NoInfer<T>, string])[];
  onChange(v: NoInfer<T>): void;
}) {
  const name = useId();
  return (
    <fieldset className={styles.radio}>
      <legend>{props.legend}</legend>
      {props.options.map(([value, label]) => (
        <label key={value}>
          <input
            type="radio"
            name={name}
            value={value}
            checked={props.value === value}
            onChange={() => props.onChange(value)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

export function Select<T extends string>(props: {
  label: string;
  value: T;
  options: readonly (readonly [NoInfer<T>, string])[];
  onChange(v: NoInfer<T>): void;
  disabled?: boolean;
  /** 아래에 보일 짧은 설명(비활성 이유 등) */
  hint?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{props.label}</label>
      <select
        id={id}
        value={props.value}
        disabled={props.disabled}
        aria-describedby={props.hint ? hintId : undefined}
        onChange={(e) => props.onChange(e.target.value as T)}
      >
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {props.hint && (
        <span id={hintId} className={styles.muted}>
          {props.hint}
        </span>
      )}
    </div>
  );
}

export function Checkbox(props: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className={styles.checkbox}>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      {props.label}
    </label>
  );
}
