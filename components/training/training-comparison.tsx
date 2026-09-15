'use client';

import { dateLabel } from '@/lib/engine';
import { ArrowRight } from 'lucide-react';
import { Choice } from '../stride-ui';
import { weeklyTraining } from './comparison-metrics';
import type { useTrainingTools } from './use-training-tools';

export function TrainingComparison({
  plan,
  today,
  isDemo,
  onPreferences,
  onNew,
  option,
  setOption,
  section,
  selectedWeek,
  setSelectedWeek,
  compare,
  current,
  candidate,
  unit,
  scale,
  trainingDisplay,
}: ReturnType<typeof useTrainingTools>) {
  return (
    <section className="training-section" hidden={section !== 'compare'}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Compare approaches</span>
          <h2>Compare your options</h2>
        </div>
      </div>
      <div className="comparison-controls">
        <Choice
          label="Training option to compare"
          value={option}
          onChange={setOption}
          options={[
            { value: 'gentle', label: 'Gentler quality sessions' },
            { value: 'maintain', label: 'Maintain starting volume' },
            { value: 'recover', label: 'Recovery every third week' },
            { value: 'finish', label: 'Easy endurance, finish focus' },
          ]}
        />
        <p className="subtle">
          Compare remaining prescriptions from today. Completed runs and manual
          changes stay in place.
        </p>
      </div>
      {compare.error && <p className="notice">{compare.error}</p>}
      {candidate && compare.plan && (
        <>
          <div
            className="comparison-chart"
            aria-label="Current and alternative weekly training duration; values in the table below"
          >
            <div style={{ minWidth: plan.weeks.length * 40 }}>
              {plan.weeks.map((w, i) => (
                <button
                  type="button"
                  key={i}
                  aria-pressed={selectedWeek === i}
                  onClick={() => setSelectedWeek(i)}
                  aria-label={`Week ${i + 1}: current ${trainingDisplay(weeklyTraining(plan, i, today), unit)}, alternative ${trainingDisplay(weeklyTraining(compare.plan!, i, today), unit)} min`}
                >
                  <i
                    className="saved"
                    style={{
                      height: `${(weeklyTraining(plan, i, today) / Math.max(1, scale)) * 100}%`,
                    }}
                  />
                  <b
                    className="candidate"
                    style={{
                      height: `${(weeklyTraining(compare.plan!, i, today) / Math.max(1, scale)) * 100}%`,
                    }}
                  />
                  <small>{i + 1}</small>
                </button>
              ))}
            </div>
          </div>
          {selectedWeek !== null && (
            <output className="subtle">
              Week {selectedWeek + 1}:{' '}
              {trainingDisplay(weeklyTraining(plan, selectedWeek, today), unit)}{' '}
              min saved ·{' '}
              {trainingDisplay(
                weeklyTraining(compare.plan!, selectedWeek, today),
                unit,
              )}{' '}
              min alternative.
            </output>
          )}
          <div className="chart-legend">
            <span>Saved plan</span>
            <span>Alternative</span>
          </div>
          <details className="reason-details">
            <summary>Weekly training minutes</summary>
            <div className="table-scroll">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Saved</th>
                    <th>Alternative</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.weeks.map((w, i) => (
                    <tr key={i}>
                      <th>
                        {i + 1} · {dateLabel(w.start)}
                      </th>
                      <td>
                        {trainingDisplay(weeklyTraining(plan, i, today), unit)}{' '}
                        min
                      </td>
                      <td>
                        {trainingDisplay(
                          weeklyTraining(compare.plan!, i, today),
                          unit,
                        )}{' '}
                        min
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className="table-scroll">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>From today</th>
                  <th>Saved plan</th>
                  <th>Alternative</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Peak remaining training week</th>
                  <td>{trainingDisplay(current.peak, unit)} min</td>
                  <td>{trainingDisplay(candidate.peak, unit)} min</td>
                </tr>
                <tr>
                  <th>Longest training run</th>
                  <td>{trainingDisplay(current.long, unit)} min</td>
                  <td>{trainingDisplay(candidate.long, unit)} min</td>
                </tr>
                <tr>
                  <th>Quality sessions</th>
                  <td>{current.quality}</td>
                  <td>{candidate.quality}</td>
                </tr>
                <tr>
                  <th>Total training time</th>
                  <td>
                    {Math.floor(current.minutes / 60)} h {current.minutes % 60}{' '}
                    min
                  </td>
                  <td>
                    {Math.floor(candidate.minutes / 60)} h{' '}
                    {candidate.minutes % 60} min
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
      <button
        className="text-button"
        onClick={() => (isDemo ? onNew() : onPreferences(compare.patch))}
      >
        Review this option <ArrowRight size={16} />
      </button>
    </section>
  );
}
