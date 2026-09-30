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
  PencilLine,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Choice } from './stride-ui';
import { PlanChangeHistory } from './plan-change-history';
export function Settings({
  profileName = '',
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
  profileName?: string;
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
  const name = profileName.trim();
  const monogram = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toUpperCase();
  return (
    <div className="settings-page">
      <div className="page-heading">
        <h1>Settings</h1>
      </div>
      <button
        type="button"
        className="settings-profile settings-profile-primary"
        aria-label={name ? `Edit your profile, ${name}` : 'Edit your profile'}
        onClick={onProfile}
      >
        <span className="settings-profile-avatar" aria-hidden="true">
          <svg viewBox="0 0 80 80" fill="none" focusable="false">
            <path d="M40 4C60 3 76 20 75 41S58 77 38 75 4 58 5 38 20 3 40 4Z" />
            <path d="M58 8C70 15 78 29 76 43M22 72C10 66 3 53 4 39" />
          </svg>
          {monogram || <UserRound size={28} />}
        </span>
        <span className="settings-profile-copy">
          <span className="settings-profile-label">Your profile</span>
          <strong>{name || 'Your running identity'}</strong>
          <small>Name, units and time zone.</small>
        </span>
        <span className="settings-profile-edit" aria-hidden="true">
          Edit profile <PencilLine size={17} />
        </span>
      </button>
      <button
        type="button"
        className="settings-watch-card"
        aria-label={
          connection
            ? 'Watch & sync: manage connection'
            : 'Watch & sync: connect Garmin with Intervals.icu'
        }
        onClick={onConnection}
      >
        <span className="settings-watch-icon">
          <Watch size={30} aria-hidden="true" />
        </span>
        <span className="settings-watch-copy">
          <strong>Watch & sync</strong>
          <span>Your upcoming workouts and recorded runs.</span>
          <small
            className={
              connection ? 'settings-watch-status' : 'settings-watch-action'
            }
          >
            <i
              aria-hidden="true"
              className={`status-dot ${connection ? 'connected' : ''}`}
            />
            {connection
              ? 'Intervals connected'
              : 'Connect Garmin with Intervals.icu'}
          </small>
        </span>
        <ChevronRight size={22} aria-hidden="true" />
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
          <span className="settings-switch-control">
            <Switch
              className="settings-toggle"
              aria-label="Enable motion"
              checked={motion}
              onCheckedChange={onMotion}
            />
            <span className="settings-switch-state" aria-hidden="true">
              {motion ? 'On' : 'Off'}
            </span>
          </span>
        </div>
      </section>
      <section
        className="settings-section"
        aria-labelledby="home-preferences-heading"
      >
        <h2 id="home-preferences-heading">Your home screen</h2>
        {homePreferencesTemporary && (
          <output className="settings-hint">
            These choices apply for this visit. Your browser is not allowing
            them to be saved.
          </output>
        )}
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
          <span className="settings-switch-control">
            <Switch
              className="settings-toggle"
              aria-label="Show distance estimates on Today"
              checked={homePreferences.showEstimates}
              onCheckedChange={(value) =>
                onHomePreferences({ showEstimates: value })
              }
            />
            <span className="settings-switch-state" aria-hidden="true">
              {homePreferences.showEstimates ? 'On' : 'Off'}
            </span>
          </span>
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
            <strong>Your training paces</strong>
            <small>
              {targetMode === 'automatic'
                ? 'Programme guidance and personal choices'
                : targetMode === 'automatic-benchmark'
                  ? 'Programme guidance · reference result saved'
                  : targetMode === 'automatic-effort'
                    ? 'Automatic · effort'
                    : targetMode === 'pace'
                      ? 'Manual pace'
                      : targetMode === 'heart-rate'
                        ? 'Heart rate'
                        : 'Effort'}{' '}
              · Review your reference and each target.
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
