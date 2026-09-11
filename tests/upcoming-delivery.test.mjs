// Offline tests of the actual selector and transpiled TSX component.
// The deterministic hook harness models render/effect lifecycle; all API calls are synthetic.
// Portable: node --test work/upcoming-delivery-regressions.mjs or tests/upcoming-delivery.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const site = new URL(
  existsSync(new URL('./stride/package.json', import.meta.url))
    ? './stride/'
    : '../',
  import.meta.url,
);
const requireSite = createRequire(new URL('package.json', site));
const ts = requireSite('typescript');
const engine = await import(new URL('lib/engine.ts', site));
const deliveryPolicy = await import(new URL('lib/delivery-policy.ts', site));
const upcomingPolicy = await import(new URL('lib/upcoming-delivery.ts', site));
const { upcomingWorkouts, watchSyncJobs, MAX_WATCH_SYNC_JOBS } = upcomingPolicy;
const componentCode = ts.transpileModule(
  readFileSync(new URL('components/upcoming-delivery.tsx', site), 'utf8'),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;
const today = engine.todayInZone('UTC');
const workout = (id, date = today, patch = {}) => ({
  id,
  date,
  title: `Synthetic ${id}`,
  status: 'planned',
  kind: 'easy',
  minutes: 30,
  steps: [{ seconds: 1800 }],
  ...patch,
});
const plan = (workouts, timezone = 'UTC') => ({
  id: 'synthetic-plan',
  profile: { timezone },
  workouts,
});
const three = () =>
  plan([
    workout('a'),
    workout('b', engine.addDays(today, 1)),
    workout('c', engine.addDays(today, 2)),
  ]);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
function nodes(value) {
  if (value == null || typeof value === 'boolean') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (typeof value !== 'object') return [value];
  return [value, ...nodes(value.props?.children)];
}
function componentHarness(input = {}, options = {}) {
  const fibers = new Map();
  let fiber,
    cursor = 0,
    pending = [],
    tree,
    dirty = false,
    active = 0,
    maxActive = 0,
    seen = new Set(),
    mounted = true;
  const calls = [],
    busyChanges = [];
  let refreshes = 0;
  const props = {
    plan: three(),
    version: 5,
    connectionIdentity: 'synthetic-athlete:generation1',
    deliveries: [],
    onWorkout: () => {},
    disabled: false,
    busy: false,
    ...input,
  };
  const hooks = {
    useState(initial) {
      const f = fiber,
        i = cursor++;
      if (!f.slots[i])
        f.slots[i] = {
          value: typeof initial === 'function' ? initial() : initial,
        };
      return [
        f.slots[i].value,
        (next) => {
          f.slots[i].value =
            typeof next === 'function' ? next(f.slots[i].value) : next;
          dirty = true;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      if (!fiber.slots[i]) fiber.slots[i] = { current: initial };
      return fiber.slots[i];
    },
    useEffect(fn, deps) {
      const f = fiber,
        i = cursor++,
        old = f.slots[i];
      if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) {
        f.slots[i] = { deps, cleanup: old?.cleanup };
        pending.push(() => {
          f.slots[i].cleanup?.();
          f.slots[i].cleanup = fn();
        });
      }
    },
  };
  props.onBusy = (value) => {
    busyChanges.push(value);
    props.busy = value;
    dirty = true;
  };
  props.onRefresh = async () => {
    refreshes++;
    await options.onRefresh?.();
  };
  const api = async (path, init, progressLabel) => {
    assert.equal(
      progressLabel,
      false,
      'Watch sync keeps progress inline without repeated overlay dialogs',
    );
    assert.equal(path, '/api/sync');
    assert.equal(init.method, 'POST');
    const d = deferred(),
      entry = { body: JSON.parse(init.body), ...d };
    calls.push(entry);
    active++;
    maxActive = Math.max(maxActive, active);
    try {
      return await d.promise;
    } finally {
      active--;
    }
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const componentModule = { exports: {} };
  vm.runInNewContext(
    componentCode,
    {
      module: componentModule,
      exports: componentModule.exports,
      require(name) {
        if (name === 'react') return hooks;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'lucide-react')
          return { Watch: 'watch-icon', ChevronRight: 'chevron-icon' };
        if (name === '@/lib/engine') return engine;
        if (name === '@/lib/delivery-policy') return deliveryPolicy;
        if (name === '@/lib/journal-view')
          return { runDuration: (m) => `${m} minutes` };
        if (name === '@/lib/upcoming-delivery') return upcomingPolicy;
        if (name === './garmin-handoff')
          return {
            GarminHandoff: () =>
              jsx('aside', {
                children: 'Next, sync your watch in Garmin Connect',
              }),
          };
        if (name === './stride-ui') return { api };
        if (name === './action-progress')
          return {
            BusyButton: (p) =>
              jsx('button', {
                ...p,
                disabled: p.disabled || p.busy,
                children: p.busy ? p.busyLabel : p.children,
              }),
          };
        throw new Error(`Unmocked import prohibited: ${name}`);
      },
      Error,
      JSON,
      Promise,
      console,
    },
    { filename: 'actual-upcoming-delivery.cjs' },
  );
  const Component = componentModule.exports.default;
  function expand(value, path) {
    if (Array.isArray(value))
      return value.map((v, i) => expand(v, path + '/' + i));
    if (value == null || typeof value !== 'object') return value;
    if (typeof value.type === 'function') {
      const id = path + '/' + value.type.name + ':' + (value.key ?? '');
      seen.add(id);
      if (!fibers.has(id)) fibers.set(id, { slots: [] });
      fiber = fibers.get(id);
      cursor = 0;
      return expand(value.type(value.props), id + '/child');
    }
    return {
      ...value,
      props: {
        ...value.props,
        children: expand(value.props?.children, path + '/children'),
      },
    };
  }
  function render(patch = {}, effects = true) {
    Object.assign(props, patch);
    if (!mounted) return tree;
    let limit = 0;
    do {
      dirty = false;
      seen = new Set();
      tree = expand(jsx(Component, props), 'root');
      for (const [id, f] of fibers)
        if (!seen.has(id)) {
          for (const s of f.slots) s?.cleanup?.();
          fibers.delete(id);
        }
      if (effects) {
        const list = pending;
        pending = [];
        for (const f of list) f();
      }
    } while (dirty && effects && ++limit < 5);
    return tree;
  }
  function button() {
    render();
    return nodes(tree).find(
      (n) =>
        n.type === 'button' && n.props.className?.includes('watch-sync-button'),
    );
  }
  async function flush() {
    for (let i = 0; i < 8; i++) await Promise.resolve();
    await new Promise(setImmediate);
    render();
  }
  render();
  return {
    calls,
    busyChanges,
    props,
    render,
    flush,
    click() {
      button().props.onClick();
    },
    text() {
      render();
      return nodes(tree)
        .filter((n) => typeof n === 'string' || typeof n === 'number')
        .join(' ');
    },
    rows() {
      render();
      return nodes(tree)
        .filter(
          (n) => n.type === 'div' && n.props?.className === 'changed-runs',
        )
        .flatMap((n) => nodes(n.props.children));
    },
    unmount() {
      mounted = false;
      for (const f of fibers.values()) for (const s of f.slots) s?.cleanup?.();
    },
    get refreshes() {
      return refreshes;
    },
    get maxActive() {
      return maxActive;
    },
    get button() {
      return button();
    },
  };
}

void test('selector includes only planned sessions from local today through today+6, without mutating the plan', () => {
  const p = plan([
    workout('late', '2026-09-14'),
    workout('skipped', '2026-09-09', { status: 'skipped' }),
    workout('last', '2026-09-13'),
    workout('done', '2026-09-08', { status: 'completed' }),
    workout('first', '2026-09-07'),
    workout('past', '2026-09-06'),
  ]);
  const before = structuredClone(p);
  assert.deepEqual(
    upcomingWorkouts(p, '2026-09-07').map((w) => w.id),
    ['first', 'last'],
  );
  assert.deepEqual(p, before);
});
void test('default seven-day window follows the plan timezone across the UTC date boundary', (t) => {
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-09-08T00:30:00Z'),
  });
  const ws = [
    workout('sep7', '2026-09-07'),
    workout('sep13', '2026-09-13'),
    workout('sep14', '2026-09-14'),
  ];
  assert.deepEqual(
    upcomingWorkouts(plan(ws, 'Pacific/Honolulu')).map((w) => w.id),
    ['sep7', 'sep13'],
  );
  assert.deepEqual(
    upcomingWorkouts(plan(ws, 'Pacific/Kiritimati')).map((w) => w.id),
    ['sep13', 'sep14'],
  );
});
void test('selector orders paired sessions chronologically, independently of journal storage order', () => {
  const p = plan([
    workout('pm', today, { session: 'PM', startTime: '18:00' }),
    workout('tomorrow', engine.addDays(today, 1)),
    workout('am', today, { session: 'AM', startTime: '07:00' }),
  ]);
  assert.deepEqual(
    upcomingWorkouts(p, today).map((w) => w.id),
    ['am', 'pm', 'tomorrow'],
  );
});
for (const patch of [{ disabled: true }, { busy: true }, { plan: plan([]) }])
  void test(`unavailable or empty plan makes no API calls: ${JSON.stringify(patch)}`, async () => {
    const h = componentHarness(patch);
    assert.equal(h.button.props.disabled, true);
    h.click();
    await h.flush();
    assert.equal(h.calls.length, 0);
    assert.deepEqual(h.busyChanges, []);
  });
void test('batch is serial, ignores a second click, and reports provider verification without claiming watch confirmation', async () => {
  const h = componentHarness();
  h.click();
  h.click();
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0].body, { id: 'a', version: 5, action: 'send' });
  h.calls[0].resolve({ status: 'accepted' });
  await h.flush();
  assert.equal(h.calls.length, 2);
  h.calls[1].resolve({ status: 'confirmed' });
  await h.flush();
  assert.equal(h.calls.length, 3);
  h.calls[2].resolve({ status: 'accepted' });
  await h.flush();
  assert.equal(h.maxActive, 1);
  assert.equal(h.refreshes, 1);
  assert.deepEqual(h.busyChanges, [true, false]);
  assert.match(h.text(), /3 workouts verified.*Intervals/i);
  assert.match(h.text(), /Sync Garmin Connect/i);
  assert.doesNotMatch(
    h.text(),
    /confirmed on your watch|received on your watch/i,
  );
});

void test('weekly sync checks current deliveries and sends only new or outdated prescriptions', async () => {
  const h = componentHarness({
    deliveries: [
      { workout_id: 'a', version: 5, status: 'accepted' },
      { workout_id: 'b', version: 4, status: 'accepted' },
      { workout_id: 'c', version: 5, status: 'confirmed' },
    ],
  });
  assert.match(h.text().replace(/\s+/g, ' '), /1 to send · 2 to check/);
  h.click();
  assert.equal(h.calls[0].body.action, 'check');
  h.calls[0].resolve({ status: 'accepted' });
  await h.flush();
  assert.equal(h.calls[1].body.action, 'send');
  h.calls[1].resolve({ status: 'accepted' });
  await h.flush();
  assert.equal(h.calls[2].body.action, 'check');
  h.calls[2].resolve({ status: 'confirmed' });
  await h.flush();
  assert.equal(h.maxActive, 1);
  assert.match(h.text(), /3 workouts verified/);
});

void test('all-sent batch offers a delivery check and stops at a provider mismatch without resending', async () => {
  const h = componentHarness({
    deliveries: ['a', 'b', 'c'].map((id) => ({
      workout_id: id,
      version: 5,
      status: 'accepted',
    })),
  });
  assert.match(h.text(), /Check synced workouts/);
  assert.match(h.text(), /ready in Intervals/);
  h.click();
  assert.equal(h.calls[0].body.action, 'check');
  h.calls[0].resolve({
    status: 'review',
    message: 'The saved workout differs.',
  });
  h.props.deliveries[0].status = 'review';
  await h.flush();
  assert.equal(h.calls.length, 1);
  assert.match(h.text(), /The saved workout differs/);
  assert.match(h.text(), /Needs attention/);
  assert.equal(h.button.props.disabled, false);
});
void test('provider review stops the batch and retains prior verified results plus the attempted review row', async () => {
  const h = componentHarness(
    {},
    {
      onRefresh: async () => {
        h.props.deliveries = [
          { workout_id: 'a', version: 5, status: 'accepted' },
          { workout_id: 'b', version: 5, status: 'review' },
        ];
      },
    },
  );
  h.click();
  h.calls[0].resolve({ status: 'accepted' });
  await h.flush();
  h.calls[1].resolve({ status: 'review-required' });
  await h.flush();
  assert.equal(h.calls.length, 2);
  assert.equal(h.refreshes, 1);
  assert.match(h.text(), /1 of 3 workouts verified/i);
  assert.match(h.text(), /In Intervals/);
  assert.match(h.text(), /Needs attention/);
  assert.equal(h.button.props.disabled, false);
});
void test('lost response stops later sends and labels the attempted outcome unknown instead of claiming it was not sent', async () => {
  const h = componentHarness();
  h.click();
  h.calls[0].resolve({ status: 'accepted' });
  await h.flush();
  h.calls[1].reject(
    new Error('Synthetic response lost after possible provider commit'),
  );
  await h.flush();
  assert.equal(h.calls.length, 2);
  assert.equal(h.refreshes, 1);
  assert.match(h.text(), /1 of 3 workouts verified/i);
  assert.match(
    h.text(),
    /unknown|needs review|review.*status|check delivery status/i,
    'Attempted row needs an explicit uncertain result',
  );
  assert.doesNotMatch(
    h.text(),
    /Remaining workouts were not sent/i,
    'The current attempt may already exist in the provider',
  );
});
for (const patch of [
  { version: 6 },
  { connectionIdentity: 'synthetic-athlete:generation2' },
  { plan: plan([workout('new')]) },
])
  void test(`generation change ignores a late success and prevents later sends: ${JSON.stringify(patch)}`, async () => {
    if (patch.plan) patch.plan.id = 'different-plan';
    const h = componentHarness();
    h.click();
    h.render(patch);
    h.calls[0].resolve({ status: 'accepted' });
    await h.flush();
    assert.equal(h.calls.length, 1);
    assert.equal(h.refreshes, 0);
    assert.doesNotMatch(
      h.text(),
      /Verified in Intervals|1 of 3|workouts verified/i,
    );
  });
void test('becoming unavailable during an active request prevents all later sends', async () => {
  const h = componentHarness();
  h.click();
  h.render({ disabled: true });
  h.calls[0].resolve({ status: 'accepted' });
  await h.flush();
  assert.equal(h.calls.length, 1);
  assert.equal(h.button.props.disabled, true);
});
void test('late error from an old account generation cannot replace the new account status', async () => {
  const h = componentHarness();
  h.click();
  h.render({ connectionIdentity: 'different-account:generation1' });
  h.calls[0].reject(new Error('Old account failure'));
  await h.flush();
  assert.equal(h.calls.length, 1);
  assert.doesNotMatch(h.text(), /Old account failure/);
  assert.equal(h.refreshes, 0);
});
void test('unmount invalidates an active batch before its next send', async () => {
  const h = componentHarness();
  h.click();
  h.unmount();
  h.calls[0].resolve({ status: 'accepted' });
  await h.flush();
  assert.equal(h.calls.length, 1);
  assert.equal(h.refreshes, 0);
});
void test('refresh failure is explicit after successful sends and does not silently clear provider verification', async () => {
  const h = componentHarness(
    { plan: plan([workout('a')]) },
    {
      onRefresh: async () => {
        throw new Error('Synthetic refresh failure');
      },
    },
  );
  h.click();
  h.calls[0].resolve({ status: 'accepted' });
  await h.flush();
  assert.equal(h.calls.length, 1);
  assert.match(h.text(), /Verified in Intervals/);
  assert.match(
    h.text(),
    /could not refresh.*Refresh status before sending again/i,
  );
  assert.equal(h.button.props.disabled, true);
  h.click();
  await h.flush();
  assert.equal(h.calls.length, 1, 'No send after failed status refresh');
});

void test('saved delivery labels survive a new component mount and open the selected workout', () => {
  const opened = [];
  const input = {
    deliveries: [
      { workout_id: 'a', version: 5, status: 'accepted' },
      { workout_id: 'b', version: 5, status: 'stale' },
      { workout_id: 'c', version: 5, status: 'review' },
    ],
    onWorkout: (w) => opened.push(w.id),
  };
  const a = componentHarness(input);
  assert.match(a.text(), /In Intervals/);
  assert.match(a.text(), /Update needed/);
  assert.match(a.text(), /Needs attention/);
  const b = componentHarness(input);
  assert.match(b.text(), /In Intervals/);
  const row = nodes(b.render()).find(
    (n) => n.type === 'button' && n.props.type === 'button',
  );
  row.props.onClick();
  assert.deepEqual(opened, ['a']);
  assert.equal(b.calls.length, 0);
});

void test('a fresh saved receipt replaces a previous batch review at the same version', async () => {
  const h = componentHarness({ plan: plan([workout('a')]) });
  h.click();
  h.calls[0].resolve({ status: 'review', message: 'Garmin needs attention' });
  await h.flush();
  h.render({
    deliveries: [{ workout_id: 'a', version: 5, status: 'accepted' }],
  });
  assert.match(h.text(), /In Intervals/);
  assert.doesNotMatch(h.text(), /Needs review/);
  assert.equal(h.calls.length, 1);
});

void test('one sync includes moved and cancelled sent entries before new workouts', async () => {
  const p = three();
  p.workouts.push(workout('moved', engine.addDays(today, 10)));
  const h = componentHarness({
    plan: p,
    deliveries: [
      { workout_id: 'removed', version: 4, status: 'accepted' },
      { workout_id: 'moved', version: 4, status: 'accepted' },
    ],
  });
  h.click();
  assert.deepEqual(h.calls[0].body, {
    id: 'removed',
    version: 5,
    action: 'send',
  });
  h.calls[0].resolve({ status: 'removed' });
  await h.flush();
  assert.equal(h.calls[1].body.id, 'moved');
  h.calls[1].resolve({ status: 'accepted' });
  await h.flush();
  for (let i = 2; i < 5; i++) {
    assert.equal(h.calls[i].body.action, 'send');
    h.calls[i].resolve({ status: 'accepted' });
    await h.flush();
  }
  assert.equal(h.maxActive, 1);
  assert.equal(h.refreshes, 1);
  assert.match(h.text(), /2 calendar updates finished/);
});
void test('a calendar ambiguity stops new sends and retains a reviewable error', async () => {
  const h = componentHarness({
    deliveries: [{ workout_id: 'cancelled', version: 4, status: 'accepted' }],
  });
  h.click();
  h.calls[0].resolve({
    status: 'review',
    message: 'Review today’s calendar entry',
  });
  await h.flush();
  assert.equal(h.calls.length, 1);
  assert.match(h.text(), /Review today/);
});
void test('refresh-only recovery unlocks sending without uploading', async () => {
  let fail = true;
  const h = componentHarness(
    { plan: plan([workout('a')]) },
    {
      onRefresh: async () => {
        if (fail) throw new Error('Offline');
      },
    },
  );
  h.click();
  h.calls[0].resolve({ status: 'accepted' });
  await h.flush();
  assert.equal(h.button.props.disabled, true);
  fail = false;
  const refresh = nodes(h.render()).find(
    (n) =>
      n.type === 'button' && nodes(n.props.children).includes('Refresh status'),
  );
  await refresh.props.onClick();
  await h.flush();
  assert.equal(h.calls.length, 1);
  assert.equal(h.button.props.disabled, false);
  assert.equal(h.refreshes, 2);
});
void test('job selection excludes completed, historical, duplicate and FIT-only prescriptions', () => {
  const p = plan([
    workout('past', engine.addDays(today, -1)),
    workout('done', today, { status: 'completed' }),
    workout('bpm', today, {
      steps: [{ seconds: 1800, target: { mode: 'heart-rate' } }],
    }),
    workout('a'),
  ]);
  const jobs = watchSyncJobs(
    p,
    5,
    [
      { workout_id: 'past', version: 4, status: 'accepted' },
      { workout_id: 'done', version: 4, status: 'accepted' },
      { workout_id: 'cancelled', version: 4, status: 'accepted' },
      { workout_id: 'cancelled', version: 4, status: 'accepted' },
    ],
    today,
  );
  assert.deepEqual(jobs, [
    { id: 'cancelled', kind: 'calendar', action: 'send' },
    { id: 'a', kind: 'workout', action: 'send' },
  ]);
});
void test('large calendar cleanups stay bounded and ask to continue', async () => {
  const h = componentHarness({
    plan: plan([]),
    deliveries: Array.from({ length: MAX_WATCH_SYNC_JOBS + 2 }, (_, i) => ({
      workout_id: 'old-' + i,
      version: 4,
      status: 'accepted',
    })),
  });
  h.click();
  for (let i = 0; i < MAX_WATCH_SYNC_JOBS; i++) {
    h.calls[i].resolve({ status: 'removed' });
    await h.flush();
  }
  assert.equal(h.calls.length, MAX_WATCH_SYNC_JOBS);
  assert.match(h.text(), /More calendar work remains/);
});

void test('mixed heart-rate week identifies FIT work and keeps its list expanded', () => {
  const h = componentHarness({
    plan: plan([
      workout('a'),
      workout('hr', today, {
        steps: [{ seconds: 600, target: { mode: 'heart-rate' } }],
      }),
    ]),
    deliveries: [{ workout_id: 'a', version: 5, status: 'accepted' }],
  });
  assert.match(h.text(), /1 workout ready.*1 needs a FIT file/);
  assert.doesNotMatch(h.text(), /Your week is ready/);
  const list = nodes(h.render()).find((n) => n.type === 'details');
  assert.equal(list.props.open, true);
});
void test('fully confirmed week has no redundant Garmin handoff', () => {
  const h = componentHarness({
    deliveries: ['a', 'b', 'c'].map((id) => ({
      workout_id: id,
      version: 5,
      status: 'confirmed',
    })),
  });
  assert.match(h.text(), /confirmed these workouts on your watch/);
  assert.doesNotMatch(h.text(), /Next, sync your watch/);
});
void test('removed calendar entry review has an actionable Intervals destination', async () => {
  const h = componentHarness({
    deliveries: [{ workout_id: 'gone', version: 4, status: 'accepted' }],
  });
  h.click();
  h.calls[0].resolve({ status: 'review' });
  await h.flush();
  assert.match(h.text(), /Previously sent Stride workout/);
  assert.equal(
    nodes(h.render()).find(
      (n) => n.type === 'a' && n.props.href === 'https://intervals.icu/',
    ).props.target,
    '_blank',
  );
});
