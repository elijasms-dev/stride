'use client';

import { type Plan, type PreferencePatch } from '@/lib/engine';
import { ArrowRight } from 'lucide-react';
import { BusyButton } from '../action-progress';
import { Modal } from '../stride-ui';
import { PlanCustomizationFields } from '../training-controls';
import { PreferencePreview } from './preference-preview';
import { usePlanPreferences } from './use-plan-preferences';

export function PlanPreferences({
  initialPatch = {},
  plan,
  today,
  version,
  onClose,
  onAction,
  busy,
}: {
  initialPatch?: Partial<PreferencePatch>;
  plan: Plan;
  today: string;
  version: number;
  onClose: () => void;
  onAction: (action: string, payload: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const state = usePlanPreferences({
    initialPatch,
    plan,
    today,
    version,
    onClose,
    onAction,
    busy,
  });
  const { p, setP, preview, error, checking } = state;
  return (
    <Modal
      open
      onClose={onClose}
      title={preview ? 'Review your next runs' : 'Plan preferences'}
      description={
        preview
          ? 'Only upcoming prescriptions change. Completed running stays in your journal.'
          : 'Choose your week. Preview the changes before saving.'
      }
      wide
      locked={checking || busy}
    >
      {!preview ? (
        <form onSubmit={state.previewPreferences}>
          <fieldset
            disabled={checking || busy}
            className="form-section form-content"
          >
            <PlanCustomizationFields profile={p} onChange={setP} />
            <BusyButton
              busy={checking}
              busyLabel="Reviewing your plan…"
              className="primary-button"
              disabled={checking}
            >
              {checking ? 'Checking your plan…' : 'Preview future changes'}
              <ArrowRight size={17} />
            </BusyButton>
          </fieldset>
        </form>
      ) : (
        <PreferencePreview {...state} preview={preview} />
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
