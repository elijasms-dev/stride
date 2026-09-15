'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { TabsContent } from '@/components/ui/tabs';
import { ProgressView } from '../plan-views';
import { useAppContext } from './app-context';

export function ProgressRoute() {
  const {
    isDemo,
    today,
    journalPlan,
    setImported,
    setExtraToCorrect,
    openModal,
    showWorkout,
  } = useAppContext();
  return (
    <TabsContent value="progress" className="main-panel">
      <ProgressView
        today={today}
        onCorrectExtra={(r) => {
          setExtraToCorrect(r);
          setImported(undefined);
          openModal('extraRun');
        }}
        plan={journalPlan}
        onWorkout={showWorkout}
        isDemo={isDemo}
        onExtra={() => {
          setImported(undefined);
          setExtraToCorrect(undefined);
          openModal('extraRun');
        }}
      />
    </TabsContent>
  );
}
