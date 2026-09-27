import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const { DeferredDialog, deferredScreenTitle } =
  await import('../components/app/deferred-dialog.tsx');
const noop = () => {};

test('deferred dialogs use the requested screen context and no generic opening flash', () => {
  assert.equal(deferredScreenTitle('preferences'), 'Training preferences');
  assert.equal(deferredScreenTitle('workout'), 'Workout details');
  assert.equal(deferredScreenTitle('connections'), 'Watch connections');
  assert.equal(deferredScreenTitle(null), 'Your journal');
  const html = renderToStaticMarkup(
    createElement(
      DeferredDialog,
      { screen: 'preferences', onClose: noop },
      createElement('div', null, 'Loaded settings'),
    ),
  );
  assert.match(html, /Loaded settings/);
  assert.doesNotMatch(html, /Opening your screen|Loading your screen/);
});
test('failed chunks provide a real reload retry and a non-destructive return to the journal', () => {
  const dialog = new DeferredDialog({
    screen: 'preferences',
    onClose: noop,
    children: null,
  });
  dialog.state = { failed: true };
  const html = renderToStaticMarkup(dialog.render());
  assert.match(html, /Training preferences could not open/);
  assert.match(html, /Reload and retry/);
  assert.match(html, /Back to journal/);
  assert.match(html, /saved plan and device drafts are kept/);
});
