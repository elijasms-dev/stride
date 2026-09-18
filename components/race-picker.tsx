'use client';
import { useState } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';
import { searchRaces, type RaceRecord, type RaceOption } from '@/lib/races';
import { trainingDayIfValid } from '@/lib/form-values';
import {
  dateLabel,
  eventDistanceDisplay,
  dayDiff,
  preparationRequirements,
  MAX_EVENT_KM,
  type Profile,
} from '@/lib/engine';
export default function RacePicker({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  const [query, setQuery] = useState(''),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<{
      label: string;
      name: string;
      date: string;
      goal: string;
    } | null>(null);
  const today = trainingDayIfValid(profile.timezone);
  function choose(r: RaceRecord, o: RaceOption) {
    const km = o.distanceKm;
    const goal =
      km === 42.195
        ? 'marathon'
        : km === 21.0975
          ? 'half'
          : km === 10
            ? '10k'
            : km === 5
              ? '5k'
              : km !== null && km > 42.2
                ? 'ultra'
                : 'custom';
    onChange({
      ...profile,
      goal,
      raceName: r.name,
      raceDate: o.date ?? r.date ?? '',
      raceDistanceKm: km ?? undefined,
      raceTerrain: r.terrain === 'trail' ? 'mountain' : 'road',
    });
    setSelected({
      label: `${r.name} · ${o.label}`,
      name: r.name,
      date: o.date ?? r.date ?? '',
      goal,
    });
    setOpen(false);
  }
  return (
    <section className="race-picker">
      <button
        type="button"
        className="text-button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Search size={16} />
        {selected &&
        selected.name === profile.raceName &&
        selected.date === profile.raceDate &&
        selected.goal === profile.goal
          ? selected.label
          : 'Find a major race'}
      </button>
      {open && !today && (
        <output className="notice">
          Enter a valid training timezone below to see race dates and
          preparation guidance. Your race search is kept.
        </output>
      )}
      {open && today && (
        <div className="race-search-panel">
          <label className="race-search">
            <Search size={17} />
            <input
              aria-label="Search races by name or city"
              placeholder="Race, city or country"
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
          </label>
          <p className="subtle">
            Curated organizer information, with a verification date on each
            race. Entry availability is separate. Always confirm changes with
            the organizer.
          </p>
          <div className="race-results">
            {searchRaces(query).map((r) => (
              <article key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {r.city}, {r.country} ·{' '}
                    {r.dateStatus === 'confirmed' && r.date
                      ? dateLabel(r.date, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Next date unannounced'}
                  </small>
                </div>
                <small>
                  Verified {dateLabel(r.verifiedAt)} ·{' '}
                  {dayDiff(r.verifiedAt, today) > 30
                    ? 'Recheck organizer information'
                    : 'Curated record'}
                </small>
                {r.requiresDateSelection && (
                  <p className="subtle">
                    Choose the day assigned by the organizer.
                  </p>
                )}
                {r.distanceOptions
                  .filter(
                    (o) =>
                      o.distanceKm !== null &&
                      o.distanceKm <= MAX_EVENT_KM &&
                      r.terrain !== 'trail',
                  )
                  .map((o, i) => (
                    <button
                      type="button"
                      className="secondary-button small-button"
                      key={i}
                      onClick={() => choose(r, o)}
                    >
                      {o.label}
                      {o.distanceKm != null
                        ? ` · ${eventDistanceDisplay(o.distanceKm, profile.units)} ${profile.units}`
                        : ' · distance to confirm'}
                      {(o.date ?? r.date) && (o.date ?? r.date)! < today
                        ? ' · Past edition; next date unverified'
                        : !(o.date ?? r.date)
                          ? ' · Date unannounced'
                          : dayDiff(
                                profile.startDate || today,
                                (o.date ?? r.date)!,
                              ) <
                              preparationRequirements({
                                ...profile,
                                goal: 'custom',
                                raceDistanceKm: o.distanceKm ?? 10,
                              }).recommendedDays
                            ? ' · Short preparation window'
                            : ' · Upcoming'}
                      {o.date && o.date !== r.date
                        ? ` · ${dateLabel(o.date)}`
                        : ''}
                    </button>
                  ))}
                {(r.dateNote || r.distanceNote) && (
                  <p className="subtle">
                    {[r.dateNote, r.distanceNote].filter(Boolean).join(' ')}
                  </p>
                )}
                {(!r.distanceOptions.length || r.terrain === 'trail') && (
                  <p className="subtle">
                    Available for reference. This race does not yet have a
                    supported, verified distance and course for plan creation.
                  </p>
                )}
                <a
                  className="text-button"
                  href={r.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Organizer details <ArrowUpRight size={14} />
                </a>
              </article>
            ))}
            {searchRaces(query).length === 0 && (
              <p>
                No match. Enter a custom race name, distance and date below.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
