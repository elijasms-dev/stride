import Link from 'next/link';
export default function Privacy() {
  return (
    <main className="policy-page">
      <Link className="text-button" href="/">
        Back to Stride
      </Link>
      <h1>Your data in this private preview</h1>
      <p className="notice">
        This describes the current private product. A public privacy notice
        needs the operator’s identity, contact details, jurisdiction, processing
        basis and reviewed retention commitments before customer access.
      </p>
      <h2>What is stored</h2>
      <p>
        Your runner inputs, plan revisions, workout logs, optional notes,
        profile, account identifier and delivery receipts are stored in the
        Site’s database. Intervals.icu keys are encrypted before storage. Stride
        does not ask for your Garmin password. Avoid putting medical records or
        other people’s personal details in run notes.
      </p>
      <p>
        Connection history stores check times, date windows, aggregate activity
        counts, saved-import counts and limited failure categories. It does not
        store provider response bodies or run notes. This connection history
        resets when you reconnect, disconnect or restore a journal; it is
        excluded from recovery files.
      </p>
      <h2>What leaves Stride</h2>
      <p>
        When you connect Intervals.icu, Stride validates your key with that
        provider. Sending a workout transfers its prescription and schedule;
        importing requests recorded activities. These actions use the provider’s
        service and retention rules. FIT and calendar downloads contain
        prescriptions. Recovery files contain your profile and running journal,
        including notes; keep them private. Connection keys are excluded.
      </p>
      <h2>Access and recovery</h2>
      <p>
        The current deployment is private and uses Sites sign-in. Data requests
        are scoped to that signed-in identity. Stride does not manage a separate
        password or a Google login. Use the identity provider’s account recovery
        if sign-in is unavailable.
      </p>
      <h2>Export and deletion</h2>
      <p>
        Settings → Account data lets you download a recovery copy, page through
        revisions, review a restore, or delete the Stride journal. Deletion
        removes the current plan, logs, revisions, profile, saved connection and
        delivery records from the application database. Minimal account and
        operation metadata remain to block stale writes and recognize retries.
        Request counters contain no notes and are reused when their short window
        resets.
      </p>
      <p>
        Deletion does not remove your identity-provider account, downloaded
        files or copies already held by a watch/calendar/provider. Database
        recovery and infrastructure logs follow the hosting provider’s
        lifecycle; this preview does not promise immediate removal from
        infrastructure backups. An operator retention and backup-erasure process
        is required before public launch.
      </p>
      <h2>Diagnostics and storage limits</h2>
      <p>
        Application error logs use a random request reference and status; they
        exclude notes, credentials, provider response bodies and request URLs.
        Private daily counters record setup field failures, rejected/accepted
        previews, activations and first workout completions. They contain
        categories and counts only, reset at the next UTC day and are removed
        with account data. They do not determine training or paid access. No
        advertising analytics have been added. Theme, motion and dismissed
        training suggestions may be stored on your device. A journal has a 1.5
        MB application limit; running before a plan has a 500 KB recoverable
        budget. Current usage is visible in Account data; a refused save keeps
        existing data and asks you to keep a recovery copy.
      </p>
      <h2>Questions</h2>
      <p>
        For this owner-only preview, use the existing development conversation
        and the request reference shown with an error. A customer support
        contact and response policy have not been established.
      </p>
      <p>
        <Link href="/about">Product status and training limits</Link> ·{' '}
        <Link href="/terms">Preview terms</Link>
      </p>
    </main>
  );
}
