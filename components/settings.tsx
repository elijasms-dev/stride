'use client';
import type { ConnectionSummary } from '@/lib/connection-status';
export type { Activity } from '@/lib/import-review';
import Link from 'next/link';
import {
  DEFAULT_HOME_PREFERENCES,
  type HomePreferences,
} from '@/lib/home-preferences';
import {
  Watch,
  ArrowUpRight,
  Download,
  CalendarDays,
  ShieldCheck,
  ChevronRight,
  UserRound,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Choice } from './stride-ui';
import { PlanChangeHistory } from './plan-change-history';
export function Settings({
  homePreferences,
  onHomePreferences,
  homePreferencesTemporary,
  connection,
  onProfile,
  onData,
  onEvent,
  onTargets,
  onRunMeasure,
  runMeasure,
  targetMode,
  onTools,
  onVariety,
  theme,
  onTheme,
  motion,
  onMotion,
  onInputs,
  onConnection,
  isDemo,
  history,
  currentVersion,
  onUndo,
  busy,
}: {
  homePreferences: HomePreferences;
  onHomePreferences: (patch: Partial<HomePreferences>) => void;
  homePreferencesTemporary: boolean;
  connection: ConnectionSummary | null;
  onProfile: () => void;
  onData: () => void;
  onEvent: () => void;
  onTargets: () => void;
  onRunMeasure: () => void;
  runMeasure: 'distance' | 'time';
  targetMode: string;
  onTools: () => void;
  onVariety: () => void;
  theme: string;
  onTheme: (s: string) => void;
  motion: boolean;
  onMotion: (b: boolean) => void;
  onInputs: () => void;
  onConnection: () => void;
  isDemo: boolean;
  history: { version: number; label: string; created_at: string }[];
  currentVersion: number;
  onUndo: () => void;
  busy: boolean;
}) {
  return (
    <div className="settings-page">
      <div className="page-heading">
        <h1>Settings</h1>
      </div>
      <button className="settings-watch-card" onClick={onConnection}>
        <span className="settings-watch-icon">
          <Watch size={30} aria-hidden="true" />
        </span>
        <span className="settings-watch-copy">
          <strong>Watch & sync</strong>
          <span>Your upcoming workouts and recorded runs.</span>
          <small>
            <i className={`status-dot ${connection ? 'connected' : ''}`} />
            {connection
              ? 'Intervals connected'
              : 'Connect Garmin with Intervals.icu'}
          </small>
        </span>
        <ChevronRight size={22} aria-hidden="true" />
      </button>
      <button className="settings-link settings-profile" onClick={onProfile}>
        <UserRound size={22} aria-hidden="true" />
        <span>
          <strong>Your profile</strong>
          <small>Name, units and time zone.</small>
        </span>
        <ChevronRight size={20} aria-hidden="true" />
      </button>
      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="setting-row">
          <div>
            <strong>Theme</strong>
            <small>Light, dark, or in step with your device.</small>
          </div>
          <Choice
            label="Theme"
            value={theme}
            onChange={onTheme}
            options={[
              { value: 'system', label: 'Follow device' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Motion</strong>
            <small>Gentle transitions between days and weeks.</small>
          </div>
          <Switch
            aria-label="Enable motion"
            checked={motion}
            onCheckedChange={onMotion}
          />
        </div>
      </section>
      <section
        className="settings-section"
        aria-labelledby="home-preferences-heading"
      >
        <h2 id="home-preferences-heading">Your home screen</h2>
        <p
          className="settings-hint"
          role={homePreferencesTemporary ? 'status' : undefined}
        >
          {homePreferencesTemporary
            ? 'These choices apply for this visit. Your browser is not allowing them to be saved.'
            : 'Saved automatically in this browser.'}
        </p>
        <div className="setting-row">
          <div>
            <strong>Open Stride on</strong>
            <small>
              Choose where a fresh visit begins. Direct links still open their
              own page.
            </small>
          </div>
          <Choice
            label="Open Stride on"
            value={homePreferences.openingView}
            onChange={(value) =>
              onHomePreferences({
                openingView: value as HomePreferences['openingView'],
              })
            }
            options={[
              { value: 'today', label: 'Today' },
              { value: 'plan', label: 'Your plan' },
              { value: 'progress', label: 'Progress' },
            ]}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Upcoming runs on Today</strong>
            <small>Choose how far ahead to look below your workout.</small>
          </div>
          <Choice
            label="Upcoming runs on Today"
            value={String(homePreferences.upcomingCount)}
            onChange={(value) =>
              onHomePreferences({
                upcomingCount: Number(
                  value,
                ) as HomePreferences['upcomingCount'],
              })
            }
            options={[
              { value: '0', label: 'Hide upcoming runs' },
              { value: '1', label: 'Next run' },
              { value: '3', label: 'Next three runs' },
            ]}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Distance estimates on Today</strong>
            <small>
              Hide estimated ranges. Prescribed distances and recorded results
              stay visible.
            </small>
          </div>
          <Switch
            aria-label="Show distance estimates on Today"
            checked={homePreferences.showEstimates}
            onCheckedChange={(value) =>
              onHomePreferences({ showEstimates: value })
            }
          />
        </div>
        <button
          className="text-button settings-reset"
          disabled={Object.keys(DEFAULT_HOME_PREFERENCES).every(
            (key) =>
              homePreferences[key as keyof HomePreferences] ===
              DEFAULT_HOME_PREFERENCES[key as keyof HomePreferences],
          )}
          onClick={() => onHomePreferences(DEFAULT_HOME_PREFERENCES)}
        >
          Reset home preferences
        </button>
      </section>
      <section className="settings-section">
        <h2>Your training</h2>
        <button className="settings-link" onClick={onRunMeasure}>
          <div>
            <strong>Run distance</strong>
            <small>
              {runMeasure === 'distance'
                ? 'Distance targets'
                : 'Switch to distance targets'}{' '}
              · Easy and long runs in kilometres or miles.
            </small>
          </div>
          <ChevronRight size={17} />
        </button>
        <button className="settings-link" onClick={onTargets}>
          <span>
            <strong>Workout targets</strong>
            <small>
              {targetMode === 'automatic-benchmark'
                ? 'Automatic · benchmark paces'
                : targetMode === 'automatic-effort'
                  ? 'Automatic · effort'
                  : targetMode === 'pace'
                    ? 'Manual pace'
                : targetMode === 'heart-rate'
                  ? 'Heart rate'
                  : 'Effort'}{' '}
              · Review automatic, effort, pace or heart rate.
            </small>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        <button className="settings-link" onClick={onVariety}>
          <span>
            <strong>Refresh your workout mix</strong>
            <small>Preview new session structures within your routine.</small>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        <button className="settings-link" onClick={onInputs}>
          <span>
            <strong>Plan preferences</strong>
            <small>
              Running days, harder workouts and your weekly schedule.
            </small>
          </span>
          <ArrowUpRight size={18} />
        </button>
        <button className="settings-link" onClick={onEvent}>
          <span>
            <strong>Change event or start a new block</strong>
            <small>Review the full schedule from your recent running.</small>
          </span>
          <CalendarDays size={20} />
        </button>
      </section>
      <section className="settings-section">
        <h2>Explore your plan</h2>
        <button className="settings-link" onClick={onTools}>
          <span>
            <strong>Plan tools & coaching references</strong>
            <small>
              Your starting inputs, alternative approaches and the reasoning
              behind them.
            </small>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </section>
      <section className="settings-section">
        <h2>Your journal</h2>
        <button className="settings-link" onClick={onData}>
          <span>
            <strong>Backups & account data</strong>
            <small>
              Save a recovery copy, restore your journal or manage deletion.
            </small>
          </span>
          <ShieldCheck size={20} aria-hidden="true" />
        </button>
        <a
          className={`settings-link ${isDemo ? 'disabled-link' : ''}`}
          href={isDemo ? undefined : '/api/export'}
          download
        >
          <span>
            <strong>Download your data</strong>
            <small>
              Runner inputs, workouts, feedback, and plan revisions.
            </small>
          </span>
          <Download size={18} />
        </a>
        {!isDemo && (
          <a
            className="settings-link"
            href="/api/export?format=calendar"
            download
          >
            <span>
              <strong>Download training calendar</strong>
              <small>
                All-day snapshot. Later changes need a fresh export; check for
                duplicate calendar entries.
              </small>
            </span>
            <CalendarDays size={20} />
          </a>
        )}
        <PlanChangeHistory
          history={history}
          currentVersion={currentVersion}
          onUndo={onUndo}
          busy={busy}
        />
        <p className="subtle section-space">
          Completed runs are preserved when restoring a plan. Your data belongs
          to your private account.
        </p>
      </section>
      <details className="reason-details">
        <summary>About the training approach</summary>
        <p>
          Stride uses an independent, versioned rules engine. Current plans
          cover base building, 5K through marathon, runnable ultras up to 100
          miles, and custom distances with preparation requirements. Technical
          mountain plans and precise pace predictions are not enabled. Forecasts
          use provisional policies and require review after interrupted
          training.
        </p>
        <p>
          <a
            href="https://support.runna.com/en/articles/11794078-what-are-mileage-insights"
            target="_blank"
            rel="noreferrer"
          >
            Runna’s published adaptation approach
          </a>{' '}
          informed our research. The exact Runna algorithm is private; Stride’s
          numerical policies still need coaching review.
        </p>
      </details>
      <section className="settings-section">
        <h2>Help & privacy</h2>
        <Link className="settings-link" href="/about" prefetch={false}>
          <span>
            <strong>About Stride</strong>
            <small>How training, watch delivery and your journal work.</small>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
        <Link className="settings-link" href="/login" prefetch={false}>
          <span>
            <strong>Private account access</strong>
            <small>Review how you sign in to your journal.</small>
          </span>
          <ShieldCheck size={20} aria-hidden="true" />
        </Link>
        <div className="settings-policy-links">
          <Link href="/privacy" prefetch={false}>
            Privacy policy
          </Link>
          <Link href="/terms" prefetch={false}>
            Preview terms
          </Link>
        </div>
      </section>
    </div>
  );
}
