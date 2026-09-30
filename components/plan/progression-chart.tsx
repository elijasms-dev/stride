'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import { kmDisplay, type Plan } from '@/lib/engine';
import { planWeekPhase, planWeekSummary } from '@/lib/plan-explorer';
import { progressChartWeeks } from '@/lib/progress-chart';
import { DrawnUnderline } from '../drawn-ui';
import { phaseCaption } from './phase-caption';

export function ProgressionChart({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const scrollRef = useRef<HTMLFieldSetElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const summaries = useMemo(() => {
    const availability = progressChartWeeks(plan, plan.profile.startDate);
    return plan.weeks.map((week) => {
      const summary = planWeekSummary(plan, week.index);
      const planned = availability.find(
        (item) => item.index === week.index,
      )?.planned;
      return {
        week,
        phase: planWeekPhase(plan, week.index) ?? week.phase,
        ...summary,
        trainingKm: planned?.km === null ? null : summary.trainingKm,
        longKm: planned?.longKm === null ? null : summary.longKm,
      };
    });
  }, [plan]);
  const peak = Math.max(
    1,
    ...summaries.flatMap((week) => [week.trainingKm ?? 0, week.longKm ?? 0]),
  );
  const selectedSummary =
    summaries.find((item) => item.week.index === selected) ?? summaries[0];
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const revealSelection = () => {
      const hasOverflow = container.scrollWidth > container.clientWidth + 1;
      setScrollable(hasOverflow);
      const button = selectedRef.current;
      if (!hasOverflow || !button) return;
      const viewport = container.getBoundingClientRect();
      const item = button.getBoundingClientRect();
      if (item.left >= viewport.left + 3 && item.right <= viewport.right - 3)
        return;
      // Pan only this timeline; never move the page vertically when a week changes.
      container.scrollTo({
        left:
          container.scrollLeft +
          item.left -
          viewport.left -
          (container.clientWidth - item.width) / 2,
        behavior:
          window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
          container.closest('.no-motion')
            ? 'instant'
            : 'smooth',
      });
    };
    revealSelection();
    const observer = new ResizeObserver(revealSelection);
    observer.observe(container);
    return () => observer.disconnect();
  }, [selected, summaries.length]);
  return (
    <section className="pe-progression" aria-labelledby="pe-progression-title">
      <div className="pe-chart-heading">
        <div>
          <h2 id="pe-progression-title" className="ink-heading">
            Your training progression
            <DrawnUnderline />
          </h2>
          <p>
            Planned weekly volume and long runs. Select a week for its totals.
          </p>
        </div>
        <div
          className="pe-chart-legend"
          aria-label={`Chart key, distances in ${plan.profile.units}`}
        >
          <span>
            <i className="pe-week-swatch" aria-hidden="true" />
            Planned volume ({plan.profile.units})
          </span>
          <span>
            <i className="pe-long-swatch" aria-hidden="true" />
            Long run ({plan.profile.units})
          </span>
        </div>
      </div>
      <fieldset
        className="pe-chart-scroll"
        ref={scrollRef}
        aria-label="Weekly training and long-run distances"
        aria-describedby={scrollable ? 'pe-chart-scroll-hint' : undefined}
      >
        <div
          className="pe-chart"
          style={{ minWidth: `${Math.max(280, plan.weeks.length * 48)}px` }}
        >
          {summaries.map((item) => {
            const reduced = ['Recovery', 'Taper', 'Race week'].includes(
              item.phase,
            );
            const trainingLabel =
              item.trainingKm === null
                ? 'training distance not estimated'
                : `${kmDisplay(item.trainingKm, plan.profile.units)} ${plan.profile.units} training`;
            const longLabel =
              item.longKm === null
                ? 'long-run distance not estimated'
                : `${kmDisplay(item.longKm, plan.profile.units)} ${plan.profile.units} long run`;
            const label = `Week ${item.week.index + 1}, ${item.phase}, ${trainingLabel}, ${longLabel}${item.raceKm ? `, plus ${kmDisplay(item.raceKm, plan.profile.units)} ${plan.profile.units} race` : ''}`;
            return (
              <button
                type="button"
                key={item.week.index}
                ref={selected === item.week.index ? selectedRef : undefined}
                className={`pe-chart-week ${selected === item.week.index ? 'is-selected' : ''} ${reduced ? 'is-reduced' : ''}`}
                aria-label={label}
                aria-pressed={selected === item.week.index}
                title={label}
                onClick={() => onSelect(item.week.index)}
              >
                <span className="pe-chart-value" aria-hidden="true">
                  {item.trainingKm === null
                    ? '—'
                    : kmDisplay(item.trainingKm, plan.profile.units)}
                </span>
                <span className="pe-chart-pair" aria-hidden="true">
                  <i
                    className="pe-chart-total"
                    style={{
                      height: `${((item.trainingKm ?? 0) / peak) * 100}%`,
                      visibility: !item.trainingKm ? 'hidden' : undefined,
                    }}
                  />
                  <i
                    className="pe-chart-long"
                    style={{
                      height: `${((item.longKm ?? 0) / peak) * 100}%`,
                      visibility: !item.longKm ? 'hidden' : undefined,
                    }}
                  />
                </span>
                <span className="pe-chart-week-number" aria-hidden="true">
                  {item.week.index + 1}
                  {item.raceKm > 0 && <Flag size={10} />}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {scrollable && (
        <p className="pe-chart-scroll-hint" id="pe-chart-scroll-hint">
          Swipe or scroll for more weeks. Use Tab to reach each week.
        </p>
      )}
      {selectedSummary && (
        <div
          className="chart-week-summary"
          aria-live="polite"
          aria-atomic="true"
        >
          <strong>
            Week {selectedSummary.week.index + 1} · {selectedSummary.phase}
          </strong>
          <p className="pe-phase-caption">
            {phaseCaption[selectedSummary.phase]}
          </p>
          <dl>
            <div>
              <dt>Planned training</dt>
              <dd>
                {selectedSummary.trainingKm === null
                  ? 'Not estimated'
                  : `${kmDisplay(selectedSummary.trainingKm, plan.profile.units)} ${plan.profile.units}`}
              </dd>
            </div>
            <div>
              <dt>Planned long run</dt>
              <dd>
                {selectedSummary.longKm === null
                  ? 'Not estimated'
                  : selectedSummary.longKm > 0
                    ? `${kmDisplay(selectedSummary.longKm, plan.profile.units)} ${plan.profile.units}`
                    : 'None scheduled'}
              </dd>
            </div>
            {selectedSummary.raceKm > 0 && (
              <div>
                <dt>Race, separate</dt>
                <dd>
                  {kmDisplay(selectedSummary.raceKm, plan.profile.units)}{' '}
                  {plan.profile.units}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
      <p className="pe-chart-note">
        Planned estimates, not recorded runs. Hatching marks recovery or taper;
        race distance is separate. Missing estimates are left blank.
      </p>
    </section>
  );
}
