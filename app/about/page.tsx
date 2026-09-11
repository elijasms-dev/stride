import Link from 'next/link';
export default function About() {
  return (
    <main className="policy-page">
      <Link className="text-button" href="/">
        Back to Stride
      </Link>
      <h1>Training, with a reason</h1>
      <p>
        Stride builds deterministic plans from your recent running, available
        days, time limits and event. Workouts progress through related purposes.
        A cap limits a session; it is not a target every workout must fill.
      </p>
      <h2>Supported training</h2>
      <p>
        Base and return-to-running blocks, 5K, 10K, half marathon, marathon,
        runnable ultras up to 100 miles and custom distances have different
        preparation requirements. Technical mountain races are not supported.
        Advanced methods require an established baseline and are reviewed
        conservatively; an advanced label does not override recovery
        constraints.
      </p>
      <p>
        Prescribed time and event distance are distinct from estimated training
        distance and recorded activity. Without an easy-pace input, distance
        estimates stay unknown. Quality-work minutes count the demanding
        portions of structured steps, not an entire warm-up and cool-down.
      </p>
      <h2>How changes work</h2>
      <p>
        Unknown sessions remain unknown. Rest does not create catch-up mileage.
        Returning after a break holds easy training until enough recent
        comfortable runs support a review. Event changes and preference
        revisions show their effects before saving. Your original completed
        prescription and corrected actuals remain auditable.
      </p>
      <h2>Connections</h2>
      <p>
        FIT downloads include structured steps and supported effort, pace or
        heart-rate targets. Direct Intervals.icu sending supports effort and
        pace; absolute heart-rate targets currently require a FIT download.
        Provider read-back confirms acceptance in Intervals.icu. Check your
        watch separately to confirm delivery to the device. Calendar export is
        an all-day snapshot, not a live subscription.
      </p>
      <h2>Private release status</h2>
      <p>
        Sign-in uses private Sites access. Journal export, recovery and deletion
        are implemented. Payments are disabled; sandbox billing code is prepared
        for configuration and integration testing. Public registration,
        commercial provider approval and a hosted webhook path are not
        established.
      </p>
      <h2>Support</h2>
      <p>
        If an action fails, keep the visible request reference and describe the
        last action in the existing development conversation. Do not include
        connection keys or a full recovery file in a public report. A dedicated
        customer support service is a launch dependency.
      </p>
      <p>
        <Link href="/privacy">Privacy</Link> ·{' '}
        <Link href="/terms">Preview terms</Link>
      </p>
    </main>
  );
}
