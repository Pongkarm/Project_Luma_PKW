import type { ReactNode } from 'react';
import { Segmented, type SegmentedOption } from '../../shared/ui/Segmented.tsx';
import { TextAreaField, SelectField } from '../../shared/ui/Field.tsx';
import { Slider } from '../../shared/ui/Slider.tsx';
import { Disclosure } from '../../shared/ui/Disclosure.tsx';
import { Button, IconButton } from '../../shared/ui/Button.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { limits } from '../../config/limits.ts';
import { checkpoints, loraOptions, samplers } from '../../config/models.ts';
import type { TaskType } from '../../contracts/generation.ts';
import { useDraft, draftBlocker } from './draftStore.ts';
import { usePreferences } from '../../shared/stores/preferencesStore.ts';
import { ModeFields } from './modes/ModeFields.tsx';

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
  const advancedOpen = usePreferences((state) => state.advancedOpen);
  const avoidOpen = usePreferences((state) => state.avoidOpen);
  const setAvoidOpen = usePreferences((state) => state.setAvoidOpen);
  const setAdvancedOpen = usePreferences((state) => state.setAdvancedOpen);
  const setLastMode = usePreferences((state) => state.setLastMode);
  const setPreferredModel = usePreferences((state) => state.setPreferredModel);

  const promptLength = draft.prompt.length;
  const overLength = promptLength > limits.prompt.max;
  const blocker = blockedReason ?? draftBlocker(draft);

  const modeOptions: SegmentedOption<TaskType>[] = [
    { value: 'txt2img', label: 'Text', icon: 'generate' },
    { value: 'img2img', label: 'Image', icon: 'image' },
    {
      value: 'inpaint',
      label: 'Inpaint',
      icon: 'layers',
      disabled: !canPaintMask,
      title: canPaintMask ? undefined : 'Painting a mask needs a larger screen',
    },
  ];

  return (
    <aside className="controls" aria-label="Generation settings">
      <div className="controls__scroll">
        <Segmented
          ariaLabel="Generation mode"
          options={modeOptions}
          value={draft.mode}
          onChange={(mode) => {
            draft.setMode(mode);
            setLastMode(mode);
          }}
        />

        <TextAreaField
          label={draft.mode === 'txt2img' ? 'Describe the image' : 'What should change?'}
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
              ? `The engine reads the first ${limits.prompt.max} characters of a prompt.`
              : null
          }
          onChange={(event) => draft.patch({ prompt: event.target.value })}
        />

        <Disclosure
          open={avoidOpen}
          onToggle={() => setAvoidOpen(!avoidOpen)}
          label={
            <>
              Things to avoid
              <span className="modedot" title="Reaches the engine in direct mode only" />
            </>
          }
          summary={draft.negativePrompt ? 'set' : 'none'}
        >
          <TextAreaField
            label="Avoid"
            meta={`${draft.negativePrompt.length} / ${limits.negativePrompt.max}`}
            rows={2}
            value={draft.negativePrompt}
            placeholder="blurry, low quality, distorted hands"
            onChange={(event) => draft.patch({ negativePrompt: event.target.value })}
          />
        </Disclosure>

        <div className="hairline" />

        <span className="eyebrow">Basics</span>

        <SelectField
          label="Model"
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
        />

        <div className="field">
          <div className="label">
            <label htmlFor="seed-field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Seed
              <span className="modedot" title="Reaches the engine in direct mode only" />
            </label>
            <span className="label__meta">blank = random</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="seed-field"
              className="input mono"
              inputMode="numeric"
              placeholder="284119075"
              value={draft.seed}
              onChange={(event) => draft.patch({ seed: event.target.value.replace(/[^\d-]/g, '') })}
            />
            <IconButton
              icon="refresh"
              label="Use a random seed"
              onClick={() => draft.patch({ seed: '' })}
            />
          </div>
        </div>

        <div className="hairline" />

        <Disclosure
          open={advancedOpen}
          onToggle={() => setAdvancedOpen(!advancedOpen)}
          label={
            <>
              Advanced
              <span className="modedot" title="Some of these reach the engine in direct mode only" />
            </>
          }
          summary={`steps ${draft.steps} · cfg ${draft.cfgScale} · ${draft.samplerName.toLowerCase()}`}
        >
          <Slider
            label="Steps"
            value={draft.steps}
            min={limits.steps.min}
            max={limits.steps.max}
            step={limits.steps.step}
            ends={['Faster', 'More refined']}
            onChange={(steps) => draft.patch({ steps })}
          />
          <Slider
            label={
              <>
                Prompt strength <span className="label__meta">(CFG)</span>
              </>
            }
            value={draft.cfgScale}
            min={limits.cfgScale.min}
            max={limits.cfgScale.max}
            step={limits.cfgScale.step}
            decimals={1}
            ends={['Loose', 'Literal']}
            onChange={(cfgScale) => draft.patch({ cfgScale })}
          />
          <SelectField
            label={
              <>
                Sampler
                <span className="modedot" title="Reaches the engine in direct mode only" />
              </>
            }
            value={draft.samplerName}
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
                Style adapter
                <span className="modedot" title="Reaches the engine in direct mode only" />
              </>
            }
            value={draft.loraId}
            hint="The engine adds this style's trigger words itself. One adapter at a time."
            onChange={(event) => draft.patch({ loraId: event.target.value })}
          >
            {loraOptions.map((lora) => (
              <option key={lora.id || 'none'} value={lora.id}>
                {lora.name}
              </option>
            ))}
          </SelectField>
        </Disclosure>

        <Alert tone="note">
          A run takes roughly 30–40 seconds on the studio GPU, and one job runs at a time.
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
            fontSize: 11,
            color: 'var(--ink-3)',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
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
