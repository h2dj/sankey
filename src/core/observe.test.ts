import { describe, expect, it } from 'vitest';
import { appendEvent, sanitizeProps, summarizeTasks, type ObserveEvent } from './observe';

describe('sanitizeProps', () => {
  it('숫자·참거짓·짧은 영문 식별자만 남긴다', () => {
    expect(
      sanitizeProps({
        format: 'png',
        rows: 12,
        ok: true,
        nan: NaN,
        title: '2026년 사업 예산', // 한글 내용
        node: 'Power Plant A', // 공백이 있는 문장
        long: 'a'.repeat(40),
        이름: 'x',
        nested: { a: 1 },
      }),
    ).toEqual({ format: 'png', rows: 12, ok: true });
  });

  it('남는 것이 없으면 undefined', () => {
    expect(sanitizeProps({ title: '제목' })).toBeUndefined();
    expect(sanitizeProps(undefined)).toBeUndefined();
  });
});

describe('appendEvent', () => {
  it('연속 편집은 count로 합친다', () => {
    let ev: ObserveEvent[] = [];
    ev = appendEvent(ev, { t: 0, name: 'edit' });
    ev = appendEvent(ev, { t: 1000, name: 'edit' });
    ev = appendEvent(ev, { t: 2500, name: 'edit' });
    expect(ev).toEqual([{ t: 2500, name: 'edit', props: { count: 3 } }]);
    ev = appendEvent(ev, { t: 9000, name: 'edit' });
    expect(ev).toHaveLength(2);
  });

  it('다른 설정 항목은 따로 기록한다', () => {
    let ev: ObserveEvent[] = [];
    ev = appendEvent(ev, { t: 0, name: 'settings_change', props: { key: 'fontSize' } });
    ev = appendEvent(ev, { t: 100, name: 'settings_change', props: { key: 'fontSize' } });
    ev = appendEvent(ev, { t: 200, name: 'settings_change', props: { key: 'direction' } });
    expect(ev.map((e) => e.props)).toEqual([{ key: 'fontSize', count: 2 }, { key: 'direction' }]);
  });
});

describe('summarizeTasks', () => {
  it('과제별 시간·첫 차트·오류·내려받기를 센다', () => {
    const events: ObserveEvent[] = [
      { t: 0, name: 'session_start' },
      { t: 100, name: 'edit' }, // 과제 밖: 무시
      { t: 1000, name: 'task_start', props: { task: 1 } },
      { t: 1500, name: 'edit', props: { count: 4 } },
      { t: 2000, name: 'error_shown', props: { code: 'NOT_NUMBER' } },
      { t: 3000, name: 'chart_rendered' },
      { t: 4000, name: 'error_resolved', props: { code: 'NOT_NUMBER' } },
      { t: 4200, name: 'chart_rendered' },
      { t: 5000, name: 'export', props: { format: 'png' } },
      { t: 6000, name: 'task_end', props: { result: 'success' } },
      { t: 7000, name: 'task_start', props: { task: 2 } },
      { t: 7500, name: 'import_fail' },
      { t: 8000, name: 'undo' },
    ];
    expect(summarizeTasks(events, 10_000)).toEqual([
      {
        task: 1,
        result: 'success',
        durationMs: 5000,
        firstChartMs: 2000,
        edits: 4,
        errorsShown: 1,
        errorsResolved: 1,
        undos: 0,
        imports: 0,
        importFails: 0,
        exports: ['png'],
      },
      {
        task: 2,
        result: 'open',
        durationMs: 3000,
        firstChartMs: null,
        edits: 0,
        errorsShown: 0,
        errorsResolved: 0,
        undos: 1,
        imports: 0,
        importFails: 1,
        exports: [],
      },
    ]);
  });

  it('끝내지 않고 다음 과제를 시작하면 앞 과제는 open으로 닫는다', () => {
    const s = summarizeTasks(
      [
        { t: 0, name: 'task_start', props: { task: 1 } },
        { t: 50, name: 'task_start', props: { task: 2 } },
      ],
      80,
    );
    expect(s.map((x) => [x.task, x.result, x.durationMs])).toEqual([
      [1, 'open', 50],
      [2, 'open', 30],
    ]);
  });
});
