'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import { BusyButton } from './action-progress';
/* oxlint-disable react/react-compiler -- Device defaults are read once when the profile opens; this app does not use the React Compiler. */
import { useState, useRef } from 'react';
import { ArrowUpRight, ShieldCheck, UserRound } from 'lucide-react';
import { Modal, Field, Choice, api } from './stride-ui';
export type AccountProfile = {
  display_name: string;
  city: string;
  units: 'km' | 'mi';
  timezone: string;
  accent: 'evergreen' | 'slate' | 'clay';
};
export type AccountData = {
  accountId?: string;
  accountEpoch?: number;
  profile: AccountProfile | null;
  email: string | null;
};
export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0])
      .join('')
      .toUpperCase() || 'S'
  );
}
export default function ProfileSettings({
  account,
  onClose,
  onSaved,
}: {
  account: AccountData;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const flight = useRef(false);
  const [p, setP] = useState<AccountProfile>(
    account.profile ?? {
      display_name: '',
      city: '',
      units: 'km',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      accent: 'evergreen',
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title="Your running identity"
      description="Your display preferences and private identity."
      locked={busy}
    >
      <div className="profile-intro">
        <span className="profile-monogram">{initials(p.display_name)}</span>
        <div>
          <span className="eyebrow">YOUR PRIVATE PROFILE</span>
          <h3>{p.display_name || 'Make it yours.'}</h3>
          <p>{p.city || 'One run at a time.'}</p>
        </div>
      </div>
      <form
        className="form-section"
        onChange={() => setSaved(false)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (flight.current) return;
          flight.current = true;
          setBusy(true);
          setError('');
          setSaved(false);
          try {
            await api('/api/profile', {
              method: 'POST',
              body: JSON.stringify({
                displayName: p.display_name,
                city: p.city,
                units: p.units,
                timezone: p.timezone,
                accent: p.accent,
              }),
            });
            setSaved(true);
            await onSaved().catch(() =>
              setError(
                'Your profile was saved. Reload to refresh the display.',
              ),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            flight.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset className="form-section form-content" disabled={busy}>
          <div className="form-grid">
            <Field label="Display name">
              <input
                value={p.display_name}
                maxLength={60}
                autoComplete="name"
                onChange={(e) => setP({ ...p, display_name: e.target.value })}
              />
            </Field>
            <Field label="Home city">
              <input
                value={p.city}
                maxLength={80}
                autoComplete="address-level2"
                placeholder="Where you run"
                onChange={(e) => setP({ ...p, city: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Timezone">
            <input
              value={p.timezone}
              list="profile-timezones"
              required
              onChange={(e) => setP({ ...p, timezone: e.target.value })}
            />
            <datalist id="profile-timezones">
              {Intl.supportedValuesOf('timeZone').map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </datalist>
          </Field>
          <Choice
            label="Distance units"
            value={p.units}
            onChange={(v) => setP({ ...p, units: v as 'km' | 'mi' })}
            options={[
              { value: 'km', label: 'Kilometres' },
              { value: 'mi', label: 'Miles' },
            ]}
          />
          <p className="subtle">
            Units update all displays. The training timezone stays fixed when
            you travel unless you change it here. Calendar dates and prescribed
            training stay the same; relative day labels use the selected
            timezone.
          </p>
          <div className="form-actions">
            <BusyButton
              busy={busy}
              busyLabel="Saving your profile…"
              className="primary-button"
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Save profile'} <UserRound size={16} />
            </BusyButton>
            {saved && <output className="subtle">Profile saved.</output>}
          </div>
        </fieldset>
      </form>
      <section className="profile-account">
        <div className="section-heading">
          <h3>Account & access</h3>
          <ShieldCheck size={20} />
        </div>
        <p>Your journal is private to your Sites account.</p>
        <a className="secondary-button" href="/login" target="_top">
          Manage private access <ArrowUpRight size={16} />
        </a>
      </section>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
    </Modal>
  );
}
