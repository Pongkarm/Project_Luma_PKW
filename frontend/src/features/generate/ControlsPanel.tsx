import { useState, type ReactNode } from 'react';
import { Segmented, type SegmentedOption } from '../../shared/ui/Segmented.tsx';
import { TextAreaField, SelectField } from '../../shared/ui/Field.tsx';
import { Slider } from '../../shared/ui/Slider.tsx';
import { Disclosure } from '../../shared/ui/Disclosure.tsx';
import { Button, IconButton } from '../../shared/ui/Button.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { limits } from '../../config/limits.ts';
import { samplers } from '../../config/models.ts';
import { useModels } from './useModels.ts';
import type { TaskType } from '../../contracts/generation.ts';
import { useDraft, draftBlocker, defaultDraft } from './draftStore.ts';
import { usePreferences } from '../../shared/stores/preferencesStore.ts';
import { ModeFields } from './modes/ModeFields.tsx';
import { SizeControl } from './modes/SizeControl.tsx';
import { usePresets, type PresetValues } from './presetStore.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { useToasts } from '../../shared/ui/Toast.tsx';

type Props = {
  canPaintMask: boolean;
  submitting: boolean;
  submitLabel: string;
  submitHint: ReactNode;
  blockedReason: string | null;
  onSubmit: () => void;
};

export function ControlsPanel({
  canPaintMask,
  submitting,
  submitLabel,
  submitHint,
  blockedReason,
  onSubmit,
}: Props) {
  const draft = useDraft();
  const t = useT();
  const showToast = useToasts((state) => state.show);
  const { checkpoints, loras } = useModels();
  const presets = usePresets((state) => state.presets);
  const savePreset = usePresets((state) => state.save);
  const removePreset = usePresets((state) => state.remove);
  const [presetName, setPresetName] = useState('');
  const advancedOpen = usePreferences((state) => state.advancedOpen);
  const avoidOpen = usePreferences((state) => state.avoidOpen);
  const setAvoidOpen = usePreferences((state) => state.setAvoidOpen);
  const setAdvancedOpen = usePreferences((state) => state.setAdvancedOpen);
  const setLastMode = usePreferences((state) => state.setLastMode);
  const setPreferredModel = usePreferences((state) => state.setPreferredModel);

  const promptLength = draft.prompt.length;
  const overLength = promptLength > limits.prompt.max;
  const rawBlocker = blockedReason ?? draftBlocker(draft);
  const blocker =
    rawBlocker === 'BLOCK_PROMPT' ? t('gen.describeFirst')
    : rawBlocker === 'BLOCK_LONG' ? t('gen.promptTooLong')
    : rawBlocker === 'BLOCK_IMAGE' ? t('gen.addImage')
    : rawBlocker;

  // Which advanced values the person has moved away from the default. Without
  // this, Advanced is a wall of numbers with no sign of what you already changed.
  const advancedFields = [
    { key: 'steps', current: draft.steps, base: defaultDraft.steps },
    { key: 'cfgScale', current: draft.cfgScale, base: defaultDraft.cfgScale },
    { key: 'samplerName', current: draft.samplerName, base: defaultDraft.samplerName },
    { key: 'loraId', current: draft.loraId, base: defaultDraft.loraId },
    { key: 'seed', current: draft.seed, base: defaultDraft.seed },
  ];
  const changed = new Set(advancedFields.filter((f) => f.current !== f.base).map((f) => f.key));

  const changedMark = (key: string, base: string | number) =>
    changed.has(key) ? (
      <span
        className="dot-changed"
        title={t('gen.isChanged', { value: String(base) === '' ? '—' : String(base) })}
      />
    ) : null;

  function resetAdvanced() {
    draft.patch({
      steps: defaultDraft.steps,
      cfgScale: defaultDraft.cfgScale,
      samplerName: defaultDraft.samplerName,
      loraId: defaultDraft.loraId,
      seed: defaultDraft.seed,
    });
  }

  const modeOptions: SegmentedOption<TaskType>[] = [
    { value: 'txt2img', label: t('gen.modeText'), icon: 'generate' },
    { value: 'img2img', label: t('gen.modeImage'), icon: 'image' },
    {
      value: 'inpaint',
      label: t('gen.modeInpaint'),
      icon: 'layers',
      disabled: !canPaintMask,
      title: canPaintMask ? undefined : t('gen.inpaintTooSmall'),
    },
  ];

  return (
    <aside className="controls" aria-label={t('gen.settings')}>
      <div className="controls__scroll">
        <Segmented
          ariaLabel={t('gen.mode')}
          options={modeOptions}
          value={draft.mode}
          onChange={(mode) => {
            draft.setMode(mode);
            setLastMode(mode);
          }}
        />

        {presets.length > 0 ? (
          <div className="field">
            <span className="eyebrow">{t('preset.saved')}</span>
            <div style={{ display: 'flex', gap: 'var(--sp-6)', flexWrap: 'wrap' }}>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="btn btn--sm btn--ghost"
                  style={{ border: '1px solid var(--line)' }}
                  title={`${preset.width} × ${preset.height} · ${preset.steps} steps · cfg ${preset.cfgScale}`}
                  onClick={() =>
                    draft.patch({
                      width: preset.width,
                      height: preset.height,
                      steps: preset.steps,
                      cfgScale: preset.cfgScale,
                      samplerName: preset.samplerName,
                      modelName: preset.modelName,
                      loraId: preset.loraId,
                      negativePrompt: preset.negativePrompt,
                    })
                  }
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <TextAreaField
          label={draft.mode === 'txt2img' ? t('gen.describe') : t('gen.whatChanges')}
          meta={
            <span style={{ color: overLength ? 'var(--fail)' : undefined }}>
              {promptLength} / {limits.prompt.max}
            </span>
          }
          rows={4}
          value={draft.prompt}
          placeholder="a glass workshop at dusk, warm lantern light through tall windows"
          error={
            overLength
              ? t('gen.promptLimit', { max: limits.prompt.max })
              : null
          }
          onChange={(event) => draft.patch({ prompt: event.target.value })}
        />

        <Disclosure
          open={avoidOpen}
          onToggle={() => setAvoidOpen(!avoidOpen)}
          label={
            <>
              {t('gen.avoidToggle')}
              <span className="modedot" title={t('gen.modeDot')} />
            </>
          }
          summary={draft.negativePrompt ? t('gen.avoidSet') : t('gen.avoidNone')}
        >
          <TextAreaField
            label={t('gen.avoid')}
            meta={`${draft.negativePrompt.length} / ${limits.negativePrompt.max}`}
            rows={2}
            value={draft.negativePrompt}
            placeholder="blurry, low quality, distorted hands"
            onChange={(event) => draft.patch({ negativePrompt: event.target.value })}
          />
        </Disclosure>

        <div className="hairline" />

        <span className="eyebrow">
          {draft.mode === 'txt2img' ? t('gen.step2') : t('gen.step1')}
        </span>

        <SelectField
          label={t('gen.model')}
          value={draft.modelName}
          onChange={(event) => {
            draft.patch({ modelName: event.target.value });
            setPreferredModel(event.target.value);
          }}
        >
          {checkpoints.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} — {model.description}
            </option>
          ))}
        </SelectField>

        <ModeFields
          mode={draft.mode}
          source={draft.source}
          onSource={draft.setSource}
          denoisingStrength={draft.denoisingStrength}
          onDenoising={(denoisingStrength) => draft.patch({ denoisingStrength })}
          width={draft.width}
          height={draft.height}
          onSize={(size) => draft.patch(size)}
          sizeOverride={draft.sizeOverride}
        />

        <div className="hairline" />

        <Disclosure
          open={advancedOpen}
          onToggle={() => setAdvancedOpen(!advancedOpen)}
          label={
            <>
              {t('gen.step3')} · {t('gen.advanced')}
              <span className="modedot" title={t('gen.modeDotSome')} />
            </>
          }
          summary={
            changed.size === 0
              ? `steps ${draft.steps} · cfg ${draft.cfgScale}`
              : changed.size === 1
                ? t('gen.changedOne')
                : t('gen.changedMany', { count: changed.size })
          }
        >
          {changed.size > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4 }}>
              <Button size="sm" icon="refresh" onClick={resetAdvanced}>
                {t('gen.resetAll')}
              </Button>
            </div>
          ) : null}

          <div className="field">
            <div className="label">
              <label htmlFor="seed-field" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)' }}>
                {t('gen.seed')}
                <span className="modedot" title={t('gen.modeDot')} />
                {changedMark('seed', defaultDraft.seed)}
              </label>
              <span className="label__meta">{t('gen.seedBlank')}</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-8)' }}>
              <input
                id="seed-field"
                className="input mono"
                inputMode="numeric"
                placeholder="284119075"
                value={draft.seed}
                onChange={(event) =>
                  draft.patch({ seed: event.target.value.replace(/[^\d-]/g, '') })
                }
              />
              <IconButton
                icon="refresh"
                label={t('gen.seedRandom')}
                onClick={() => draft.patch({ seed: '' })}
              />
            </div>
            <span className="field__hint">{t('gen.seedHelp')}</span>
          </div>
          {draft.mode !== 'txt2img' ? (
            <div className="field" style={{ gap: 'var(--sp-8)' }}>
              <label
                className="label"
                style={{ cursor: 'pointer' }}
                htmlFor="size-override"
              >
                <span>{t('size.byHand')}</span>
                <input
                  id="size-override"
                  type="checkbox"
                  checked={draft.sizeOverride}
                  onChange={(event) => draft.patch({ sizeOverride: event.target.checked })}
                />
              </label>
              {draft.sizeOverride ? (
                <SizeControl
                  label={t('size.output')}
                  width={draft.width}
                  height={draft.height}
                  onChange={(size) => draft.patch(size)}
                />
              ) : (
                <span className="field__hint">{t('size.byHandOff')}</span>
              )}
            </div>
          ) : null}
          <Slider
            label={
              <>
                {t('gen.steps')}
                {changedMark('steps', defaultDraft.steps)}
              </>
            }
            value={draft.steps}
            min={limits.steps.min}
            max={limits.steps.max}
            step={limits.steps.step}
            ends={[t('gen.stepsFast'), t('gen.stepsRefined')]}
            onChange={(steps) => draft.patch({ steps })}
          />
          <span className="field__hint" style={{ marginTop: -10 }}>
            {t('gen.stepsHelp')}
          </span>
          <Slider
            label={
              <>
                {t('gen.cfg')} <span className="label__meta">(CFG)</span>
                {changedMark('cfgScale', defaultDraft.cfgScale)}
              </>
            }
            value={draft.cfgScale}
            min={limits.cfgScale.min}
            max={limits.cfgScale.max}
            step={limits.cfgScale.step}
            decimals={1}
            ends={[t('gen.cfgLoose'), t('gen.cfgLiteral')]}
            onChange={(cfgScale) => draft.patch({ cfgScale })}
          />
          <span className="field__hint" style={{ marginTop: -10 }}>
            {t('gen.cfgHelp')}
          </span>
          <SelectField
            label={
              <>
                {t('gen.sampler')}
                <span className="modedot" title={t('gen.modeDot')} />
                {changedMark('samplerName', defaultDraft.samplerName)}
              </>
            }
            value={draft.samplerName}
            hint={t('gen.samplerHelp')}
            onChange={(event) => draft.patch({ samplerName: event.target.value })}
          >
            {samplers.map((sampler) => (
              <option key={sampler} value={sampler}>
                {sampler}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={
              <>
                {t('gen.style')}
                <span className="modedot" title={t('gen.modeDot')} />
                {changedMark('loraId', defaultDraft.loraId)}
              </>
            }
            value={draft.loraId}
            hint={t('gen.styleHint')}
            onChange={(event) => draft.patch({ loraId: event.target.value })}
          >
            {loras.map((lora) => (
              <option key={lora.id || 'none'} value={lora.id}>
                {lora.name}
              </option>
            ))}
          </SelectField>
          <div className="hairline" />

          <div className="field">
            <span className="label">{t('preset.saveThese')}</span>
            <div style={{ display: 'flex', gap: 'var(--sp-8)' }}>
              <input
                className="input"
                placeholder={t('preset.namePlaceholder')}
                value={presetName}
                aria-label={t('preset.name')}
                onChange={(event) => setPresetName(event.target.value)}
              />
              <Button
                disabled={!presetName.trim()}
                onClick={() => {
                  const values: PresetValues = {
                    width: draft.width,
                    height: draft.height,
                    steps: draft.steps,
                    cfgScale: draft.cfgScale,
                    samplerName: draft.samplerName,
                    modelName: draft.modelName,
                    loraId: draft.loraId,
                    negativePrompt: draft.negativePrompt,
                  };
                  savePreset(presetName, values);
                  showToast(t('preset.saved1', { name: presetName.trim() }));
                  setPresetName('');
                }}
              >
                {t('preset.save')}
              </Button>
            </div>
            <span className="field__hint">
              {t('preset.hint')}
            </span>
            {presets.length > 0 ? (
              <div style={{ display: 'flex', gap: 'var(--sp-6)', flexWrap: 'wrap', marginTop: 'var(--sp-2)' }}>
                {presets.map((preset) => (
                  <span
                    key={preset.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--sp-4)',
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--ink-3)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r-sm)',
                      padding: '2px 4px 2px 8px',
                    }}
                  >
                    {preset.name}
                    <IconButton
                      icon="close"
                      label={t('preset.delete', { name: preset.name })}
                      style={{ width: 18, height: 18, border: 'none', background: 'none' }}
                      iconSize={11}
                      onClick={() => removePreset(preset.id)}
                    />
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </Disclosure>

        <Alert tone="note">
          {t('gen.runNote')}
        </Alert>
      </div>

      <div className="controls__foot">
        <Button
          variant="primary"
          size="lg"
          block
          icon="generate"
          busy={submitting}
          disabled={Boolean(blocker)}
          onClick={onSubmit}
          title={blocker ?? undefined}
        >
          {blocker ?? submitLabel}
        </Button>
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--ink-3)',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--sp-6)',
          }}
        >
          {submitHint}
          <span className="mono" style={{ opacity: 0.75 }}>
            <Icon name="info" size={11} /> ⌘↵
          </span>
        </span>
      </div>
    </aside>
  );
}
