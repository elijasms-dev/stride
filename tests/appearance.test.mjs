import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  parseTheme,
  readAppearance,
  APPEARANCE_BOOTSTRAP,
} from '../lib/appearance.ts';

void test('appearance accepts only supported themes and survives unavailable storage', () => {
  assert.equal(parseTheme('dark'), 'dark');
  for (const value of [null, '', 'monochrome', 'evil'])
    assert.equal(parseTheme(value), 'system');
  assert.deepEqual(
    readAppearance({
      getItem: (key) => (key === 'stride-theme' ? 'light' : 'off'),
    }),
    { theme: 'light', motion: false },
  );
  assert.deepEqual(
    readAppearance({
      getItem() {
        throw new Error('blocked');
      },
    }),
    { theme: 'system', motion: true },
  );
});
void test('first-paint bootstrap uses the saved choice without writing or resetting storage', () => {
  for (const choice of ['dark', 'light', 'system', 'invalid']) {
    const classes = new Set(),
      root = {
        dataset: {},
        classList: {
          remove: (...c) => c.forEach((x) => classes.delete(x)),
          add: (c) => classes.add(c),
          toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
        },
      };
    runInNewContext(APPEARANCE_BOOTSTRAP, {
      document: { documentElement: root },
      localStorage: {
        getItem: (key) => (key === 'stride-theme' ? choice : 'off'),
      },
    });
    assert.equal(root.dataset.theme, parseTheme(choice));
    assert.equal(classes.has('dark'), choice === 'dark');
    assert.equal(classes.has('light'), choice === 'light');
    assert.ok(classes.has('no-motion'));
  }
});
const css = readFileSync(
  new URL('../app/athletic-tokens.css', import.meta.url),
  'utf8',
);
const blocks = [...css.matchAll(/\{([^{}]+)\}/g)].map((m) =>
  Object.fromEntries(
    [...m[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((v) => [
      v[1],
      v[2].trim(),
    ]),
  ),
);
function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
for (const [i, name] of ['light', 'dark', 'system-dark'].entries())
  void test(`${name} actual semantic text tokens exceed 7:1 on every base surface`, () => {
    const palette = { ...blocks[0], ...blocks[i] };
    for (const text of [
      'text-main',
      'text-label',
      'link',
      'success',
      'warning',
      'destructive',
    ])
      for (const surface of ['canvas', 'surface', 'surface-raised'])
        assert.ok(
          contrast(palette[text], palette[surface]) >= 7,
          `${text} on ${surface}: ${contrast(palette[text], palette[surface]).toFixed(2)}`,
        );
  });
void test('CTA, dock and sidebar states meet enhanced text contrast in both themes', () => {
  for (const block of blocks) {
    const p = { ...blocks[0], ...block };
    assert.ok(contrast(p['primary-foreground'], p['ath-volt']) >= 7);
    assert.ok(contrast(p['dock-muted'], p['dock-surface']) >= 7);
    assert.ok(contrast(p['dock-ink'], p['dock-active']) >= 7);
    assert.ok(contrast(p['selection-ink'], p['selection-surface']) >= 7);
  }
});
void test('workout colours preserve enhanced label and metric contrast in every theme', () => {
  for (const block of blocks) {
    const p = { ...blocks[0], ...block };
    for (const surface of [
      'run-easy-surface',
      'run-quality-surface',
      'run-long-surface',
    ])
      for (const text of ['text-main', 'text-label'])
        assert.ok(
          contrast(p[text], p[surface]) >= 7,
          `${text} on ${surface}: ${contrast(p[text], p[surface]).toFixed(2)}`,
        );
  }
});
