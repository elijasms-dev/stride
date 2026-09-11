import Link from 'next/link';
export default function Terms() {
  return (
    <main className="policy-page">
      <Link href="/" className="text-button">
        Back to Stride
      </Link>
      <h1>Private preview terms</h1>
      <p className="notice">
        This is an owner-only development preview. There is no paid
        subscription, working checkout or public customer offer. Commercial
        terms need the operator’s business details and legal review before
        launch.
      </p>
      <h2>Training decisions</h2>
      <p>
        Stride provides independently authored running schedules using declared
        inputs and recorded training. Numerical progression and eligibility
        rules are provisional product policies. Software tests establish
        consistency; they do not establish medical safety, coaching approval or
        a guaranteed race outcome. Adjust rest around illness, pain or
        persistent fatigue, and seek qualified guidance when appropriate.
      </p>
      <h2>Connected services</h2>
      <p>
        A downloaded workout or provider acceptance is different from a workout
        appearing on a watch. Check the actual prescription on your device
        before use. Personal Intervals.icu access does not establish commercial
        Garmin or Intervals.icu approval.
      </p>
      <h2>Changes and your journal</h2>
      <p>
        The preview may change as it is tested. Keep a recovery export,
        particularly before a restore. Completed run facts are retained during
        ordinary plan revisions; explicit journal deletion and recovery
        replacement have separate review steps. External provider copies need
        separate management.
      </p>
      <h2>Before customer access</h2>
      <p>
        Business identity, customer support, applicable consumer rights,
        cancellation/refund rules, final privacy terms, independent training
        review, authentication verification and payment operations remain
        release requirements. These notes are not a substitute for those
        agreements.
      </p>
      <p>
        <Link href="/privacy">Data in this preview</Link> ·{' '}
        <Link href="/about">Product status</Link>
      </p>
    </main>
  );
}
