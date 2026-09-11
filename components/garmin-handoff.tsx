import { Smartphone, ArrowUpRight } from 'lucide-react';
import { GARMIN_CALENDAR_URL } from '@/lib/upcoming-delivery';

export function GarminHandoff() {
  return (
    <aside className="garmin-handoff" aria-label="Next step in Garmin Connect">
      <Smartphone size={24} aria-hidden="true" />
      <div>
        <h4>Next, sync your watch</h4>
        <p>
          Your workouts are in Intervals.icu. Open Garmin Connect on your phone
          and sync your watch.
        </p>
        <a
          className="primary-button"
          href={GARMIN_CALENDAR_URL}
          target="_blank"
          rel="noreferrer"
        >
          Open Garmin Connect <ArrowUpRight size={17} aria-hidden="true" />
        </a>
        <small>
          Opens your Garmin calendar. Device sync happens in the Garmin Connect
          phone app.
        </small>
      </div>
    </aside>
  );
}
