'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { TabsContent } from '@/components/ui/tabs';
import { Settings } from '../settings';
import { useAppContext } from './app-context';

export function SettingsRoute() {
  const {
    data,
    busy,
    theme,
    setTheme,
    motion,
    setMotion,
    homePreferences,
    homePreferencesTemporary,
    updateHomePreferences,
    plan,
    isDemo,
    openModal,
    act,
    setToast,
  } = useAppContext();
  return (
    <TabsContent value="settings" className="main-panel">
      <Settings
        homePreferences={homePreferences}
        onHomePreferences={updateHomePreferences}
        homePreferencesTemporary={homePreferencesTemporary}
        connection={data.connection}
        onTargets={() => openModal(isDemo ? 'onboarding' : 'targets')}
        onRunMeasure={() => openModal(isDemo ? 'onboarding' : 'run-measure')}
        runMeasure={plan.profile.runMeasure ?? 'time'}
        targetMode={plan.profile.workoutTargets?.mode ?? 'effort'}
        onTools={() => openModal('plan-tools')}
        onVariety={() => openModal(isDemo ? 'onboarding' : 'variety-review')}
        onProfile={() => openModal('profile')}
        theme={theme}
        onTheme={setTheme}
        motion={motion}
        onMotion={setMotion}
        onInputs={() => openModal(isDemo ? 'onboarding' : 'preferences')}
        onConnection={() => openModal('connections')}
        onData={() => openModal('accountData')}
        onEvent={() => openModal(isDemo ? 'onboarding' : 'event')}
        isDemo={isDemo}
        history={data.history}
        onUndo={() =>
          void act('undo').catch((e) => setToast((e as Error).message))
        }
        busy={busy}
      />
    </TabsContent>
  );
}
