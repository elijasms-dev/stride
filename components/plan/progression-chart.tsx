'use client';

import { useMemo } from 'react';
import { Flag } from 'lucide-react';
import { kmDisplay, type Plan } from '@/lib/engine';
import { planWeekSummary } from '@/lib/plan-explorer';

export function ProgressionChart({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const summaries = useMemo(
    () =>
      plan.weeks.map((week) => ({
        week,
        ...planWeekSummary(plan, week.index),
      })),
    [plan],
  );
  const peak = Math.max(1, ...summaries.map((week) => week.trainingKm));
  return (
    <section className="pe-progression" aria-labelledby="pe-progression-title">
      <div className="pe-chart-heading">
        <div>
          <h2 id="pe-progression-title">The shape of your training</h2>
          <p>Select a week to explore its daily runs.</p>
        </div>
        <div className="pe-chart-legend">
          <span>
            <i className="pe-week-swatch" />
            Weekly distance
          </span>
          <span>
            <i className="pe-long-swatch" />
            Long run
          </span>
        </div>
      </div>
      <div
        className="pe-chart-scroll"
        role="group"
        aria-label="Weekly training and long-run distances"
      >
        <div
          className="pe-chart"
          style={{ minWidth: `${Math.max(280, plan.weeks.length * 38)}px` }}
        >
          {summaries.map((item) => {
            const reduced = ['Recovery', 'Taper', 'Race week'].includes(
              item.week.phase,
            );
            const label = `Week ${item.week.index + 1}, ${item.week.phase}, ${kmDisplay(item.trainingKm, plan.profile.units)} ${plan.profile.units} training, ${kmDisplay(item.longKm, plan.profile.units)} ${plan.profile.units} long run${item.raceKm ? `, plus ${kmDisplay(item.raceKm, plan.profile.units)} ${plan.profile.units} race` : ''}`;
            return (
              <button
                type="button"
                key={item.week.index}
                className={`pe-chart-week ${selected === item.week.index ? 'is-selected' : ''} ${reduced ? 'is-reduced' : ''}`}
                aria-label={label}
                aria-pressed={selected === item.week.index}
                title={label}
                onClick={() => onSelect(item.week.index)}
              >
                <span className="pe-chart-value" aria-hidden="true">
                  {kmDisplay(item.trainingKm, plan.profile.units)}
                </span>
                <span className="pe-chart-pair" aria-hidden="true">
                  <i
                    className="pe-chart-total"
                    style={{ height: `${(item.trainingKm / peak) * 100}%` }}
                  />
                  <i
                    className="pe-chart-long"
                    style={{ height: `${(item.longKm / peak) * 100}%` }}
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
      </div>
      <p className="pe-chart-note">
        Week number below each bar. Hatched bars mark recovery or taper.
        Distances are planned training estimates; race distance is separate.
      </p>
    </section>
  );
}
