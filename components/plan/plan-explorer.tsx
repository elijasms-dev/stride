'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Download,
  Ellipsis,
  Printer,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { dateLabel, goalLabel } from '@/lib/engine';
import { nearestPlanWeek } from '@/lib/plan-explorer';
import { downloadTrainingPlan, printTrainingPlan } from '@/lib/plan-print';
import { PlanFit } from '../plan-fit';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ProgressionChart } from './progression-chart';
import { PlanWeekSchedule } from './week-schedule';
import type { Props } from './explorer-types';
export { PlanWeekSchedule } from './week-schedule';

export function FullPlan({
  plan,
  today,
  onWorkout,
  onDay,
  onAdjust,
  onNew,
  onVariety,
  selected,
  onSelect,
  isDemo,
  initialView = 'week',
}: Props) {
  const [view, setView] = useState<'week' | 'full'>(initialView);
  const [jump, setJump] = useState<number | null>(null);
  const sections = useRef(new Map<number, HTMLElement>());
  const selectedWeek =
    plan.weeks.find((week) => week.index === selected) ?? plan.weeks[0];
  const selectedPosition = plan.weeks.findIndex(
    (week) => week.index === selectedWeek?.index,
  );
  const todayWeek = nearestPlanWeek(plan, today);
  const todayInPlan =
    today >= plan.profile.startDate && today <= plan.profile.raceDate;
  const chooseWeek = (index: number, scroll = true) => {
    onSelect(index);
    if (scroll) setJump(index);
  };
  useEffect(() => {
    if (jump === null) return;
    const section = sections.current.get(jump);
    if (!section) return;
    section.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
    section.focus({ preventScroll: true });
    setJump(null);
  }, [jump, selected, view]);

  if (!selectedWeek)
    return (
      <div className="view-wrapper">
        <h1>Your plan</h1>
        <p>No weeks are available. Build a plan to see your daily schedule.</p>
        <button className="primary-button" onClick={onNew}>
          Build my plan
        </button>
      </div>
    );
  const shown = view === 'full' ? plan.weeks : [selectedWeek];
  return (
    <div className="view-wrapper plan-view plan-explorer">
      <div className="page-heading">
        <div>
          <h1>Your plan</h1>
          <p className="pe-block-label">
            {plan.profile.raceName || goalLabel(plan.profile.goal)}{' '}
            <span>
              {plan.weeks.length} weeks, {dateLabel(plan.profile.startDate)} to{' '}
              {dateLabel(plan.profile.raceDate, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </p>
        </div>
        <div className="plan-heading-actions">
          <button
            type="button"
            className="secondary-button pe-print"
            onClick={() => printTrainingPlan(plan)}
          >
            <Printer size={17} aria-hidden="true" />
            Print plan
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={isDemo ? onNew : onAdjust}
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
            {isDemo ? 'Build my plan' : 'Adjust plan'}
          </button>
          {!isDemo && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="icon-button plan-options"
                    aria-label="More plan options"
                  />
                }
              >
                <Ellipsis size={20} aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="plan-options-menu">
                <DropdownMenuItem onClick={() => downloadTrainingPlan(plan)}>
                  <Download size={16} aria-hidden="true" />
                  Download readable plan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onVariety}>
                  <RefreshCw size={16} aria-hidden="true" />
                  Refresh workouts
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onNew}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Restart plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <ProgressionChart
        plan={plan}
        selected={selectedWeek.index}
        onSelect={chooseWeek}
      />

      <nav
        className="pe-toolbar"
        aria-label="Training schedule views and weeks"
      >
        <div className="pe-view-switch" role="group" aria-label="Schedule view">
          <button
            type="button"
            aria-pressed={view === 'week'}
            onClick={() => setView('week')}
          >
            Week
          </button>
          <button
            type="button"
            aria-pressed={view === 'full'}
            onClick={() => {
              setView('full');
              setJump(selectedWeek.index);
            }}
          >
            Full plan
          </button>
        </div>
        <div className="pe-week-navigation">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous plan week"
            disabled={selectedPosition <= 0}
            onClick={() => chooseWeek(plan.weeks[selectedPosition - 1].index)}
          >
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <label className="pe-week-select">
            <span className="sr-only">Jump to plan week</span>
            <select
              value={selectedWeek.index}
              onChange={(event) => chooseWeek(Number(event.target.value))}
            >
              {plan.weeks.map((week) => (
                <option key={week.index} value={week.index}>
                  Week {week.index + 1} · {dateLabel(week.start)}
                </option>
              ))}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label="Next plan week"
            disabled={selectedPosition >= plan.weeks.length - 1}
            onClick={() => chooseWeek(plan.weeks[selectedPosition + 1].index)}
          >
            <ArrowRight size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pe-today"
            title={
              todayInPlan
                ? 'Go to the week containing today'
                : 'Today is outside this block; go to the nearest plan week'
            }
            onClick={() => chooseWeek(todayWeek)}
          >
            Today
          </button>
        </div>
      </nav>
      <div className="sr-only" aria-live="polite">
        {view === 'full'
          ? `Full plan, ${plan.weeks.length} weeks. Selected week ${selectedWeek.index + 1}.`
          : `Showing week ${selectedWeek.index + 1} of ${plan.weeks.length}.`}
      </div>

      <div className="pe-weeks" data-view={view}>
        {shown.map((week) => (
          <section
            className="pe-week"
            id={`plan-week-${week.index + 1}`}
            key={week.index}
            tabIndex={-1}
            aria-labelledby={`plan-week-heading-${week.index + 1}`}
            ref={(node) => {
              if (node) sections.current.set(week.index, node);
              else sections.current.delete(week.index);
            }}
          >
            <PlanWeekSchedule
              plan={plan}
              weekIndex={week.index}
              today={today}
              onWorkout={onWorkout}
              onDay={onDay}
            />
          </section>
        ))}
      </div>
      <div className="plan-note pe-plan-notes">
        <PlanFit plan={plan} asOf={today} />
        {isDemo ? (
          <button className="text-button" onClick={onNew}>
            Make it yours <ArrowUpRight size={17} />
          </button>
        ) : (
          <a className="text-button" href="/api/export?format=program" download>
            Download training program · JSON <ArrowUpRight size={17} />
          </a>
        )}
      </div>
    </div>
  );
}
