'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import Image from 'next/image';
import { useEffect, useState, type MouseEvent } from 'react';
import { ArrowRight, Check, LoaderCircle, LockKeyhole } from 'lucide-react';
import { safeReturnTo, signInHref } from '@/lib/auth-navigation';
import { useAppearance } from './use-appearance';
import { StrideLogo } from './StrideLogo';
export default function Login({
  mode = 'login',
  signedIn = false,
  email,
  returnTo = '/',
}: {
  mode?: 'login' | 'join' | 'expired';
  signedIn?: boolean;
  email?: string | null;
  returnTo?: string;
}) {
  useAppearance();
  const [leaving, setLeaving] = useState(false);
  const joining = mode === 'join',
    expired = mode === 'expired';
  const destination = safeReturnTo(returnTo);
  const href = expired
    ? '/login'
    : signedIn
      ? destination
      : signInHref(destination);
  const title = expired
    ? 'Let’s reconnect.'
    : joining
      ? 'Make it your run.'
      : 'Welcome back.';
  const label = expired
    ? 'Review sign-in'
    : signedIn
      ? 'Open my training'
      : 'Continue with ChatGPT';
  useEffect(() => {
    const reset = () => setLeaving(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    if (leaving) event.preventDefault();
    else setLeaving(true);
  }
  return (
    <main className="access-shell">
      <section className="access-story" aria-label="Stride running">
        <Image
          unoptimized
          className="access-photo"
          src="/images/stride-coast.jpg"
          alt="Two runners following a wooded coastal trail"
          width={1024}
          height={1536}
          fetchPriority="high"
        />
        <a
          className="access-wordmark"
          href="/"
          target="_top"
          aria-label="Stride home"
        >
          <StrideLogo />
        </a>
        <div className="access-story-caption">
          <p>
            Out there.
            <br />
            In your stride.
          </p>
          <span>Your next run starts here.</span>
        </div>
      </section>
      <section className="access-panel" aria-labelledby="access-title">
        {!expired && (
          <nav className="access-tabs" aria-label="Account access">
            <a
              href={`/login?returnTo=${encodeURIComponent(destination)}`}
              aria-current={!joining ? 'page' : undefined}
              target="_top"
            >
              Sign in
            </a>
            <a
              href="/join"
              aria-current={joining ? 'page' : undefined}
              target="_top"
            >
              Get started
            </a>
          </nav>
        )}
        <div className="access-content">
          <h1 id="access-title">{title}</h1>
          <p className="access-intro">
            {expired
              ? 'Your sign-in changed or expired. Reopen your journal before making more changes.'
              : joining
                ? 'A training plan shaped around your goal, your experience and the days you want to run.'
                : 'Pick up your plan. Find your next workout. Keep moving.'}
          </p>
          {joining && (
            <ul className="access-benefits">
              <li>
                <Check aria-hidden="true" size={18} />
                Choose your race and running routine
              </li>
              <li>
                <Check aria-hidden="true" size={18} />
                Set your pace, heart rate or effort targets
              </li>
              <li>
                <Check aria-hidden="true" size={18} />
                Connect your watch through Intervals.icu
              </li>
            </ul>
          )}
          {signedIn && !expired && (
            <div className="access-identity">
              <span>Signed in{email ? ' as' : ''}</span>
              {email && <strong>{email}</strong>}
            </div>
          )}
          <a
            className="access-primary"
            href={href}
            target="_top"
            onClick={navigate}
            aria-disabled={leaving || undefined}
            aria-busy={leaving}
          >
            <span>{leaving ? 'Opening…' : label}</span>
            {leaving ? (
              <LoaderCircle
                className="access-spinner"
                size={20}
                aria-hidden="true"
              />
            ) : (
              <ArrowRight size={20} aria-hidden="true" />
            )}
          </a>
          <output className="access-note">
            {leaving
              ? 'If this page stays open, you can try the link again.'
              : expired
                ? 'Saved training stays in its original account.'
                : signedIn
                  ? 'Your training journal belongs to this account.'
                  : 'Use your ChatGPT account to sign in securely. Access to this private Stride site is required.'}
          </output>
          {leaving && (
            <button className="access-retry" onClick={() => setLeaving(false)}>
              Try again
            </button>
          )}
          {signedIn && !expired && (
            <a
              className="access-switch"
              href={`/signout-with-chatgpt?return_to=${encodeURIComponent(`/login?returnTo=${encodeURIComponent(destination)}`)}`}
              target="_top"
            >
              Use a different account
            </a>
          )}
          {!signedIn && !expired && (
            <p className="access-alternate">
              {joining ? 'Already training with Stride?' : 'New to Stride?'}{' '}
              <a href={joining ? '/login' : '/join'} target="_top">
                {joining ? 'Sign in' : 'Set up your training'}
              </a>
            </p>
          )}
        </div>
        <footer className="access-footer">
          <span>
            <LockKeyhole size={15} aria-hidden="true" />
            Your private running journal
          </span>
          <a href="/about" target="_top">
            About &amp; privacy
          </a>
        </footer>
      </section>
    </main>
  );
}
