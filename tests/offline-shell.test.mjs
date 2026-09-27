import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../public/offline.js', import.meta.url),
  'utf8',
).replace("import { deviceJournal } from './journal-store.js';", '');
const html = readFileSync(
  new URL('../public/offline.html', import.meta.url),
  'utf8',
);
const fixture = () => ({
  scope: 'synthetic-runner:1',
  enabled: true,
  savedAt: '2026-09-23T12:00:00Z',
  pending: [],
  snapshot: {
    version: 4,
    plan: {
      workouts: [
        {
          date: '2026-09-24',
          title: 'Easy run',
          estimatedKm: 5,
          minutes: 30,
          status: 'planned',
          steps: [
            { label: 'Easy running', seconds: 1800, effort: 'Comfortable' },
          ],
        },
      ],
    },
  },
});
const defaults = {
  date: '2026-09-23',
  minutes: '40',
  km: '5',
  effort: '3',
  feeling: 'good',
  note: 'Synthetic notes',
};
class Element {
  children = [];
  value = '';
  textContent = '';
  hidden = false;
  disabled = false;
  constructor(tag = 'div') {
    this.tag = tag;
  }
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = [...children];
    this.textContent = '';
  }
}
async function boot(initial = fixture()) {
  const ids = Object.fromEntries(
    [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => [
      match[1],
      new Element(),
    ]),
  );
  ids.unlock.hidden = ids.journal.hidden = true;
  const fields = Object.fromEntries(
    [...html.matchAll(/\bname="([^"]+)"/g)].map((match) => [
      match[1],
      new Element('input'),
    ]),
  );
  fields.namedItem = (name) => fields[name];
  ids.log.elements = fields;
  const submit = new Element('button');
  ids.log.querySelector = (selector) => {
    assert.equal(selector, 'button[type="submit"]');
    return submit;
  };
  ids.log.reset = () =>
    Object.values(fields).forEach((field) => {
      if (field instanceof Element) field.value = '';
    });
  let state = structuredClone(initial),
    commits = 0,
    failNext = false,
    holdNext = null;
  const journalStore = async (change) => {
    if (holdNext) {
      const gate = holdNext;
      holdNext = null;
      await gate;
    }
    if (failNext) {
      failNext = false;
      throw new Error('Synthetic storage unavailable');
    }
    if (change) {
      state = structuredClone(change(structuredClone(state)));
      commits++;
    }
    return structuredClone(state);
  };
  const RealDate = Date;
  class Clock extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : ['2026-09-24T12:00:00Z']));
    }
    static now() {
      return new RealDate('2026-09-24T12:00:00Z').getTime();
    }
  }
  const context = vm.createContext({
    document: {
      getElementById: (id) => {
        assert.ok(ids[id], `Missing real element ${id}`);
        return ids[id];
      },
      createElement: (tag) => new Element(tag),
    },
    FormData: class {
      constructor(form) {
        this.values = Object.entries(form.elements)
          .filter(([, field]) => field instanceof Element)
          .map(([name, field]) => [name, field.value]);
      }
      get(name) {
        return this.values.find(([key]) => key === name)?.[1] ?? null;
      }
      entries() {
        return this.values[Symbol.iterator]();
      }
    },
    Date: Clock,
    crypto: { randomUUID: () => crypto.randomUUID() },
    confirm: () => true,
    deviceJournal: journalStore,
  });
  await vm.runInContext(`(async () => {${source}\n})()`, context);
  const populate = (patch = {}) =>
    Object.entries({ ...defaults, ...patch }).forEach(([name, value]) => {
      fields[name].value = value;
    });
  return {
    ids,
    fields,
    submit,
    populate,
    state: () => state,
    commits: () => commits,
    replace: (value) => {
      state = structuredClone(value);
    },
    fail: () => {
      failNext = true;
    },
    hold: (gate) => {
      holdNext = gate;
    },
    open: () => ids.open.onclick(),
    save: () => ids.log.onsubmit({ preventDefault() {} }),
    draft: () => ids.log.oninput(),
  };
}

test('cold offline shell hides private content until opened and renders the saved schedule', async () => {
  const app = await boot();
  assert.equal(app.ids.journal.hidden, true);
  assert.equal(app.ids.unlock.hidden, false);
  app.open();
  assert.equal(app.ids.journal.hidden, false);
  assert.equal(app.ids.runs.children.length, 1);
  assert.match(app.ids.runs.children[0].children[0].textContent, /Easy run/);
  assert.match(app.ids.runs.children[0].children[2].textContent, /30 min/);
});

test('cold shell validates actual values without relying on browser form validation', async () => {
  for (const patch of [
    { feeling: '' },
    { feeling: 'excellent' },
    { date: '2026-02-30' },
    { date: 'not-a-date' },
    { date: '2026-09-25' },
    { minutes: '0' },
    { minutes: 'NaN' },
    { minutes: '4321' },
    { minutes: '2', km: '100' },
    { effort: '0' },
    { effort: '11' },
    { effort: '2.5' },
  ]) {
    const app = await boot();
    app.open();
    app.populate(patch);
    await app.save();
    assert.equal(app.state().pending.length, 0, JSON.stringify(patch));
    assert.match(app.ids.result.textContent, /not been saved/);
    assert.equal(app.submit.disabled, false);
  }
});

test('unsaved draft survives a cold reopen and only clears when the local transaction succeeds', async () => {
  const first = await boot();
  first.open();
  first.populate({ note: 'Keep this draft', minutes: '55' });
  await first.draft();
  const second = await boot(first.state());
  second.open();
  assert.equal(second.fields.note.value, 'Keep this draft');
  assert.equal(second.fields.minutes.value, '55');
  second.fail();
  await second.save();
  assert.equal(second.state().pending.length, 0);
  assert.equal(second.fields.note.value, 'Keep this draft');
  assert.equal(second.state().offlineDraft.note, 'Keep this draft');
  assert.match(second.ids.result.textContent, /storage unavailable/);
  await second.save();
  assert.equal(second.state().pending.length, 1);
  assert.equal(second.state().offlineDraft, undefined);
  assert.equal(second.fields.note.value, '');
  assert.equal(second.state().pending[0].body.run.minutes, 55);
  assert.match(second.ids.result.textContent, /saved on this device/);
});

test('rapid repeated submit shares one durable save and quota failures leave the form intact', async () => {
  const app = await boot();
  app.open();
  app.populate();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  app.hold(gate);
  const first = app.save();
  assert.equal(app.submit.disabled, true);
  await app.save();
  release();
  await first;
  assert.equal(app.state().pending.length, 1);
  assert.equal(app.submit.disabled, false);
  const full = fixture();
  full.pending = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    createdAt: '2026-09-23T12:00:00Z',
    body: { run: {} },
  }));
  const blocked = await boot(full);
  blocked.open();
  blocked.populate();
  await blocked.save();
  assert.equal(blocked.state().pending.length, 100);
  assert.equal(blocked.fields.note.value, defaults.note);
  assert.match(blocked.ids.result.textContent, /Sync your pending/);
});

test('a different account appearing in another tab cannot receive stale form saves or drafts', async () => {
  const app = await boot();
  app.open();
  app.populate();
  const other = { ...fixture(), scope: 'another-runner:2' };
  app.replace(other);
  await app.save();
  assert.equal(app.state().pending.length, 0);
  assert.equal(app.state().scope, 'another-runner:2');
  assert.match(app.ids.result.textContent, /account changed/);
  await app.draft();
  assert.equal(app.state().offlineDraft, undefined);
});

test('stale offline-page erase cannot delete a different account’s device journal', async () => {
  const app = await boot();
  const other = {
    ...fixture(),
    scope: 'another-runner:2',
    pending: [{ id: 'B-pending' }],
  };
  app.replace(other);
  await app.ids.erase.onclick();
  assert.equal(app.state().scope, 'another-runner:2');
  assert.equal(app.state().pending.length, 1);
  assert.match(app.ids.status.textContent, /account changed/);
  const current = await boot();
  await current.ids.erase.onclick();
  assert.equal(current.state(), null);
  assert.match(current.ids.status.textContent, /erased/);
});
test('offline logging keeps the training calendar date across a date-line flight', async () => {
  const data = fixture();
  data.snapshot.plan.profile = { timezone: 'Pacific/Kiritimati' };
  const app = await boot(data);
  app.open();
  assert.equal(app.fields.date.value, '2026-09-25');
  app.populate({ date: '2026-09-25' });
  await app.save();
  assert.equal(app.state().pending[0].body.run.date, '2026-09-25');
  assert.equal(app.fields.date.value, '2026-09-25');
});
test('offline workout instructions preserve short interval duration exactly', async () => {
  const data = fixture();
  data.snapshot.plan.workouts[0].steps = [
    { label: 'Stride', seconds: 15, effort: 'Quick and relaxed' },
    { label: 'Recovery', seconds: 45, effort: 'Easy' },
  ];
  const app = await boot(data);
  app.open();
  const instructions = app.ids.runs.children[0].children[2].textContent;
  assert.match(instructions, /0m 15s/);
  assert.match(instructions, /0m 45s/);
  assert.doesNotMatch(instructions, /0 min/);
});
