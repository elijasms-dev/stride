import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_HOME_PREFERENCES } from '../lib/home-preferences.ts';

// Match the application's Vinext alias while retaining the real Link renderer.
registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === 'next/link'
        ? new URL('../node_modules/vinext/dist/shims/link.js', import.meta.url)
            .href
        : specifier,
      context,
    );
  },
});

const { Settings } = await import('../components/settings.tsx');
const noop = () => {};
const props = {
  homePreferences: DEFAULT_HOME_PREFERENCES,
  onHomePreferences: noop,
  homePreferencesTemporary: false,
  connection: null,
  onProfile: noop,
  onData: noop,
  onEvent: noop,
  onTargets: noop,
  onRunMeasure: noop,
  runMeasure: 'time',
  targetMode: 'automatic',
  onTools: noop,
  onVariety: noop,
  theme: 'system',
  onTheme: noop,
  motion: false,
  onMotion: noop,
  onInputs: noop,
  onConnection: noop,
  isDemo: false,
  history: [],
  currentVersion: 1,
  onUndo: noop,
  busy: false,
};
const render = (patch = {}) =>
  renderToStaticMarkup(createElement(Settings, { ...props, ...patch }));

test('Settings leads with the saved runner identity and keeps profile editing connected', () => {
  const html = render({ profileName: 'Ava O’Neill' });
  assert.match(html, /aria-label="Edit your profile, Ava O’Neill"/);
  assert.match(html, /<strong>Ava O’Neill<\/strong>/);
  assert.ok(html.indexOf('Your profile') < html.indexOf('Watch &amp; sync'));
  assert.match(html, /Edit profile/);
  let opened = 0;
  const tree = Settings({ ...props, onProfile: () => opened++ });
  const profile = tree.props.children.find(
    (child) => child?.props?.['aria-label'] === 'Edit your profile',
  );
  assert.ok(profile, 'profile editing remains an accessible button');
  assert.equal(profile.type, 'button');
  profile.props.onClick();
  assert.equal(opened, 1);
});

test('a missing profile uses an honest setup label without inventing a runner name', () => {
  const html = render();
  assert.match(html, /<strong>Your running identity<\/strong>/);
  assert.match(html, /aria-label="Edit your profile"/);
  assert.doesNotMatch(html, /Edit your profile,|>undefined<|>null</);
});

test('normal automatic-saving copy is removed while a real storage failure remains announced', () => {
  assert.doesNotMatch(
    render(),
    /Saved automatically in this browser|Your browser is not allowing/,
  );
  const temporary = render({ homePreferencesTemporary: true });
  assert.match(temporary, /<output class="settings-hint">/);
  assert.match(temporary, /These choices apply for this visit/);
  assert.match(temporary, /Your browser is not allowing them to be saved/);
});

function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return undefined;
  }
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
}

test('Settings switches expose one checked state each and visible matching On/Off labels', () => {
  for (const checked of [false, true]) {
    const html = render({
      motion: checked,
      homePreferences: { ...DEFAULT_HOME_PREFERENCES, showEstimates: checked },
    });
    const switches = [...html.matchAll(/<[^>]+role="switch"[^>]*>/g)].map(
      (match) => match[0],
    );
    assert.equal(
      switches.length,
      2,
      'the wrapper must not duplicate switch roles',
    );
    for (const control of switches)
      assert.ok(control.includes(`aria-checked="${checked}"`));
    assert.ok(
      switches.some((control) =>
        control.includes('aria-label="Enable motion"'),
      ),
    );
    assert.ok(
      switches.some((control) =>
        control.includes('aria-label="Show distance estimates on Today"'),
      ),
    );
    assert.equal(
      (
        html.match(
          new RegExp(
            `class="settings-switch-state" aria-hidden="true">${checked ? 'On' : 'Off'}<`,
            'g',
          ),
        ) ?? []
      ).length,
      2,
    );
  }
});

test('Settings switch interactions preserve their existing preference callbacks', () => {
  const changes = [];
  const tree = Settings({
    ...props,
    onMotion: (checked) => changes.push({ motion: checked }),
    onHomePreferences: (patch) => changes.push(patch),
  });
  const motion = findElement(
    tree,
    (node) => node.props?.['aria-label'] === 'Enable motion',
  );
  const estimates = findElement(
    tree,
    (node) => node.props?.['aria-label'] === 'Show distance estimates on Today',
  );
  assert.equal(motion.props.checked, false);
  assert.equal(estimates.props.checked, DEFAULT_HOME_PREFERENCES.showEstimates);
  motion.props.onCheckedChange(true);
  estimates.props.onCheckedChange(false);
  assert.deepEqual(changes, [{ motion: true }, { showEstimates: false }]);
});

test('the whole watch row remains one labelled connection button in either connection state', () => {
  for (const connection of [null, { athlete_name: 'Saved runner' }]) {
    let opened = 0;
    const tree = Settings({
      ...props,
      connection,
      onConnection: () => opened++,
    });
    const button = findElement(
      tree,
      (node) => node.props?.className === 'settings-watch-card',
    );
    assert.equal(button.type, 'button');
    assert.equal(button.props.type, 'button');
    assert.match(
      button.props['aria-label'],
      connection ? /manage connection/ : /connect Garmin with Intervals\.icu/,
    );
    assert.equal(button.props.disabled, undefined);
    assert.equal(
      findElement(
        button.props.children,
        (node) => node.type === 'button' || node.type === 'a',
      ),
      undefined,
    );
    button.props.onClick();
    assert.equal(opened, 1);
    const html = render({ connection });
    assert.match(
      html,
      connection ? /Intervals connected/ : /Connect Garmin with Intervals\.icu/,
    );
  }
});
