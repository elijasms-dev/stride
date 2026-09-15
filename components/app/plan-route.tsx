'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { TabsContent } from '@/components/ui/tabs';
import { FullPlan } from '../plan-views';
import { useAppContext } from './app-context';

export function PlanRoute() {
  const {
    plan,
    isDemo,
    today,
    week,
    selectWeek,
    openModal,
    showWorkout,
    showDay,
  } = useAppContext();
  return (
    <TabsContent value="plan" className="main-panel">
      <FullPlan
        plan={plan}
        today={today}
        onWorkout={showWorkout}
        onDay={showDay}
        onAdjust={() => openModal('adjustments')}
        onVariety={() => openModal('variety-review')}
        selected={week.index}
        onSelect={selectWeek}
        onNew={() => openModal(isDemo ? 'onboarding' : 'runner-inputs')}
        isDemo={isDemo}
      />
    </TabsContent>
  );
}
