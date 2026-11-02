import type { ChartModel } from '../../core/chartModel';
import type { Settings } from '../../core/types';
import { editorStore, useEditor } from '../../state/store';
import { ColorSection } from './ColorSection';
import { NotesSection } from './NotesSection';
import { TimelineSection } from './TimelineSection';
import { timelineActive } from '../../core/timeline';
import { Checkbox, Radio, Section, Select, Slider, TextField } from './controls';
import styles from './SettingsPanel.module.css';

interface Props {
  /** 노드별 색 지정 목록에 쓴다. 그릴 수 없으면 null */
  model: ChartModel | null;
}

const set = (patch: Partial<Settings>, opts?: { coalesce?: boolean }) =>
  editorStore.getState().setSettings(patch, opts);

export function SettingsPanel({ model }: Props) {
  const meta = useEditor((s) => s.doc.meta);
  const settings = useEditor((s) => s.doc.settings);
  const setMeta = editorStore.getState().setMeta;
  const timelineOn = timelineActive(settings.timeline);

  return (
    <div className={styles.panel}>
      <Section title="기본 정보">
        <TextField label="제목" value={meta.title} onChange={(title) => setMeta({ title })} />
        <TextField
          label="설명"
          value={meta.description}
          onChange={(description) => setMeta({ description })}
          multiline
        />
        <TextField
          label="값의 단위"
          value={meta.unit}
          onChange={(unit) => setMeta({ unit })}
          placeholder="예: 원, 명, kWh"
        />
      </Section>

      <Section title="레이아웃">
        <Radio
          legend="흐름 방향"
          value={settings.direction}
          options={[
            ['ltr', '왼쪽 → 오른쪽'],
            ['rtl', '오른쪽 → 왼쪽'],
          ]}
          onChange={(direction) => set({ direction })}
        />
        <Select
          label="노드 정렬"
          disabled={timelineOn}
          hint={timelineOn ? '시기별로 배치하는 동안은 시기가 열을 정합니다.' : undefined}
          value={settings.nodeAlign}
          options={[
            ['justify', '양끝 맞춤(끝 노드를 마지막 열로)'],
            ['left', '시작 쪽으로'],
            ['right', '끝 쪽으로'],
            ['center', '가운데로'],
          ]}
          onChange={(nodeAlign) => set({ nodeAlign })}
        />
        <Slider
          label="노드 폭"
          value={settings.nodeWidth}
          min={4}
          max={40}
          unit="px"
          onChange={(nodeWidth) => set({ nodeWidth })}
        />
        <Slider
          label="노드 간격"
          value={settings.nodePadding}
          min={0}
          max={60}
          unit="px"
          onChange={(nodePadding) => set({ nodePadding })}
        />
        <Slider
          label="흐름 최소 두께"
          value={settings.minLinkWidth}
          min={1}
          max={10}
          unit="px"
          onChange={(minLinkWidth) => set({ minLinkWidth })}
        />
      </Section>

      <Section title="시기">
        <TimelineSection timeline={settings.timeline} model={model} onChange={set} />
      </Section>

      <Section title="노드 메모">
        <NotesSection noteDisplay={settings.noteDisplay} model={model} onChange={set} />
      </Section>

      <Section title="레이블">
        <Slider
          label="글자 크기"
          value={settings.fontSize}
          min={9}
          max={24}
          unit="px"
          onChange={(fontSize) => set({ fontSize })}
        />
        <Radio
          legend="레이블 위치"
          value={settings.labelPosition}
          options={[
            ['inside', '안쪽(차트 가운데 쪽)'],
            ['outside', '바깥쪽(양끝 열은 차트 밖)'],
          ]}
          onChange={(labelPosition) => set({ labelPosition })}
        />
        <Checkbox
          label="레이블에 값 표시"
          checked={settings.showValues}
          onChange={(showValues) => set({ showValues })}
        />
        <Select
          label="소수 자리"
          value={String(settings.numberFormat.decimals)}
          options={[
            ['auto', '자동(최대 2자리)'],
            ['0', '0자리'],
            ['1', '1자리'],
            ['2', '2자리'],
            ['3', '3자리'],
          ]}
          onChange={(v) =>
            set({
              numberFormat: {
                ...settings.numberFormat,
                decimals: v === 'auto' ? 'auto' : Number(v),
              },
            })
          }
        />
        <Checkbox
          label="천 단위 쉼표"
          checked={settings.numberFormat.thousands}
          onChange={(thousands) => set({ numberFormat: { ...settings.numberFormat, thousands } })}
        />
      </Section>

      <Section title="색상">
        <ColorSection settings={settings} model={model} onChange={set} />
      </Section>

      <Section title="데이터 처리">
        <Radio
          legend="같은 출발·도착 연결이 반복될 때"
          value={settings.duplicateMode}
          options={[
            ['merge', '하나로 합산'],
            ['separate', '별도 흐름으로 표시'],
          ]}
          onChange={(duplicateMode) => set({ duplicateMode })}
        />
      </Section>
    </div>
  );
}
