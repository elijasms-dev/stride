'use client';

import { BookOpen } from 'lucide-react';
import { references } from './references';
import type { useTrainingTools } from './use-training-tools';

export function TrainingResearch({
  section,
  family,
}: ReturnType<typeof useTrainingTools>) {
  return (
    <section className="training-section" hidden={section !== 'research'}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Coaching references</span>
          <h2>How other plans are shaped</h2>
        </div>
        <BookOpen size={22} />
      </div>
      <p>
        Useful reference points, for different runners. Stride does not average
        these plans together or reproduce their schedules.
      </p>
      <div className="table-scroll">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Published plan</th>
              <th>Weeks</th>
              <th>Runs/week</th>
              <th>Peak long outing</th>
              <th>Context</th>
            </tr>
          </thead>
          <tbody>
            {references
              .filter((r) => r.family === family || family === 'base')
              .map((r) => (
                <tr key={r.name}>
                  <th>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.name} ↗
                    </a>
                  </th>
                  <td>{r.weeks}</td>
                  <td>{r.runs}</td>
                  <td>{r.long}</td>
                  <td>{r.audience}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <details className="reason-details">
        <summary>Sources, choices and limits</summary>
        <p>
          <a
            href="https://vdoto2.com/learn-more/training-definitions"
            target="_blank"
            rel="noreferrer"
          >
            Daniels’ training definitions
          </a>{' '}
          distinguish easy endurance, sustained threshold work, aerobic-power
          intervals and relaxed economy. We store a session’s purpose separately
          from its format. The numerical recipes here are original Stride
          choices.
        </p>
        <p>
          <a
            href="https://support.runna.com/en/articles/10393191-how-to-use-training-preferences"
            target="_blank"
            rel="noreferrer"
          >
            Runna’s preferences
          </a>{' '}
          separate volume from difficulty.{' '}
          <a
            href="https://support.runna.com/en/articles/11794078-what-are-mileage-insights"
            target="_blank"
            rel="noreferrer"
          >
            Mileage Insights
          </a>{' '}
          includes off-plan running. Its exact numerical algorithm remains
          private.
        </p>
        <p>
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/37163550/"
            target="_blank"
            rel="noreferrer"
          >
            Taper research
          </a>{' '}
          supports reducing volume while retaining familiar intensity.{' '}
          <a
            href="https://bjsm.bmj.com/content/59/17/1203"
            target="_blank"
            rel="noreferrer"
          >
            Recent session-distance research
          </a>{' '}
          supports examining individual outings, while not establishing a
          universal safe percentage.
        </p>
        <p>
          Stride’s progression, entry requirements and caps are provisional
          training policies, not proof of readiness. Books and public plans
          inform the design; this app has not been independently validated as a
          coaching service.
        </p>
        <p>
          Today’s tired feedback can hold a progression review immediately.
          Increases still need repeated completed training on earlier days;
          duplicate recordings count once.{' '}
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/26423706/"
            target="_blank"
            rel="noreferrer"
          >
            Research on subjective training responses
          </a>{' '}
          supports monitoring how training feels. It does not validate Stride’s
          effort cutoffs or review windows, which remain coaching policies
          awaiting independent review.
        </p>
      </details>
    </section>
  );
}
