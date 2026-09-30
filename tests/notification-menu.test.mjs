import './ui-render-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { NotificationBar } = await import('../components/notification-bar.tsx');
const { AppStatus } = await import('../components/app/app-status.tsx');
const { AppNotices } = await import('../components/app/app-notices.tsx');
const { AppProvider } = await import('../components/app/app-context.tsx');

const noop = () => {};
const value = {
  busy: false,
  syncingPending: false,
  isDemo: false,
  draftScope: 'test-account',
  today: '2026-09-30',
  data: { accountStatus: 'closed' },
  plan: {
    id: 'old-plan',
    policyVersion: -1,
    profile: { raceDate: '2026-09-29' },
  },
  openModal: noop,
};
const render = (component, props) =>
  renderToStaticMarkup(createElement(component, props));
const renderWithContext = (component, patch = {}) =>
  renderToStaticMarkup(
    createElement(
      AppProvider,
      { value: { ...value, ...patch } },
      createElement(component),
    ),
  );

test('notifications remain discoverable when the menu has no updates', () => {
  const html = render(NotificationBar, { notifications: [] });
  assert.match(html, /aria-label="Notifications, no new updates"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /training-notification-indicator/);
});

test('notification bell announces its update count without displaying an in-page banner', () => {
  const html = render(NotificationBar, {
    notifications: [
      {
        id: 'one',
        title: 'First update',
        description: 'Saved history stays protected.',
        actionLabel: 'Review',
        onAction: noop,
      },
      {
        id: 'two',
        title: 'Second update',
        description: 'Review your next block.',
        actionLabel: 'Review next block',
        onAction: noop,
      },
    ],
  });
  assert.match(html, /aria-label="Notifications, 2 training updates"/);
  assert.match(html, /training-notification-indicator/);
  assert.doesNotMatch(html, /training-notification-bar/);
  assert.doesNotMatch(html, /Saved history stays protected/);
});

test('moving updates into the header preserves save and pending-sync announcements', () => {
  const saving = renderWithContext(AppStatus, { busy: true });
  assert.match(saving, /Notifications, 3 training updates/);
  assert.match(saving, /<output class="sr-only" aria-live="polite">Saving…/);
  const syncing = renderWithContext(AppStatus, {
    busy: true,
    syncingPending: true,
  });
  assert.match(syncing, /Syncing pending saves…/);
  assert.doesNotMatch(syncing, />Saving…/);
});

test('actionable offline and save-error notices stay in the page, separate from the bell', () => {
  const html = renderWithContext(AppNotices, {
    view: 'today',
    offline: true,
    loading: false,
    deviceError: 'This run could not be stored on the device.',
    loadError: 'Your journal could not be loaded.',
    refresh: async () => {},
  });
  assert.match(html, /You are offline/);
  assert.match(html, /This run could not be stored on the device/);
  assert.match(html, /Your journal could not be loaded/);
  assert.match(html, /role="alert"/);
  assert.match(html, /> Retry<\/button>/);
  assert.doesNotMatch(html, /training-notification-(?:bell|bar)/);
});
