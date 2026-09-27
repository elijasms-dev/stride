/** Read-only observers of the actual generator. No production sources are edited. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const tagIndex = process.argv.indexOf('--tag');
const tag = tagIndex >= 0 ? process.argv[tagIndex + 1] : undefined;
if (tagIndex >= 0 && (!tag || !/^[a-z0-9-]+$/.test(tag))) throw new Error('Use a nonempty lowercase audit tag.');
const folder = new URL(`docs/verification/2026-09-25/plan-derivation-audit/${tag ? tag + '/' : ''}`, root);
const saved = JSON.parse(readFileSync(new URL('docs/verification/2026-09-25/plan-quality-review/example-plans.json', root), 'utf8'));
const round = (n) => Number.isFinite(n) ? Number(n.toFixed(3)) : String(n);
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const training = (w) => w.kind !== 'race';
const quality = (w) => training(w) && w.kind !== 'long' && w.hard && w.steps.some((s) => s.kind === 'work' && s.intensity >= 4 && s.movement !== 'walk');
function weeks(plan) {
  return plan.weeks.map((week) => {
    const runs = plan.workouts.filter((w) => w.week === week.index && training(w));
    return {
      week: week.index + 1, phase: week.phase,
      km: round(runs.reduce((n, w) => n + w.estimatedKm, 0)),
      longKm: runs.find((w) => w.kind === 'long')?.estimatedKm ?? null,
      weekdayWorkouts: runs.filter(quality).length,
      hardSessions: runs.filter((w) => w.hard).length,
      runs: runs.map((w) => ({date: w.date, kind: w.kind, role: w.role, km: round(w.estimatedKm), minutes: round(w.minutes), hard: w.hard, template: w.templateId, targetWorkMinutes: w.targetWorkMinutes, qualityMinutes: round(w.steps.filter((s) => s.kind === 'work' && s.intensity >= 4 && s.movement !== 'walk').reduce((n,s) => n + s.seconds / 60,0)), title: w.title})),
    };
  });
}
let active;
globalThis.__strideDerivationStage = (label, plan) => {
  if (active?.trace) active.stages.push({label, openingWeekKm: plan.openingWeekKm, weeks: weeks(plan)});
};
globalThis.__strideDerivationContext = (c) => {
  if (!active) return;
  active.context = Object.fromEntries(Object.entries(c).filter(([k]) => !['recordedQuality','p'].includes(k)));
  active.normalizedProfile = c.p;
};
globalThis.__strideDerivationWeek = (w) => {
  if (active?.trace) active.allocations.push(w);
};
globalThis.__strideDerivationCapacity = (value) => {
  if (active?.trace) active.openingCapacityPasses.push(value);
};
const observed = new Set();
function replaceOnce(source, token, addition) {
  assert.equal(source.split(token).length, 2, `Observer anchor must occur once: ${token}`);
  return source.replace(token, token + '\n' + addition);
}
registerHooks({
  load(url, context, next) {
    const targets = ['lib/plan/generate.ts','lib/plan/generation-weeks.ts','lib/plan/generation-baseline.ts'];
    const target = targets.find((path) => url === new URL(path, root).href);
    if (!target) return next(url, context);
    let source = readFileSync(fileURLToPath(url), 'utf8');
    if (target.endsWith('/generate.ts')) {
      source = replaceOnce(source, 'const context = resolveGenerationPolicy(profile, replan);', 'globalThis.__strideDerivationContext(context);');
      source = replaceOnce(source, 'const { weeks, workouts } = generatePlanWeeks(context, replan);', 'globalThis.__strideDerivationStage("01 initial recipe allocation", {weeks,workouts});');
      const calls = [
        'reconcileOpeningBaseline(plan, allowDeclaredOpening);',
        'applyActualTrainingEnvelope(plan, undefined, replan?.retainedPrefix);',
        'rebalanceFutureQuality(plan, replan?.from ?? p.startDate);',
        'normalizeGeneratedLongRuns(plan, replan?.from ?? p.startDate);',
        'reconcileOrdinaryWeeklyProgression(plan, allowDeclaredOpening);',
        'ensureGeneratedMarathonRhythm(plan, replan?.from ?? p.startDate);',
        'const varied = refreshWorkoutVariety(plan, replan?.from ?? p.startDate);',
        'normalizeGeneratedLongRuns(varied, replan?.from ?? p.startDate);',
        'reconcileOpeningBaseline(varied, allowDeclaredOpening);',
        'reconcileOrdinaryWeeklyProgression(varied, allowDeclaredOpening);',
        'applyActualTrainingEnvelope(varied, undefined, replan?.retainedPrefix);',
        'rebalanceFutureQuality(varied, replan?.from ?? p.startDate);',
        'ensureGeneratedMarathonRhythm(varied, replan?.from ?? p.startDate);',
        'refreshWeekTotals(varied);',
      ];
      for (const call of calls) {
        assert.ok(source.includes(call));
        const plan = call.includes('varied') ? 'varied' : 'plan';
        const label = call.startsWith('const varied') ? 'refreshWorkoutVariety' : call.slice(0, call.indexOf('('));
        source = source.replaceAll(call, call + `\nglobalThis.__strideDerivationStage(${JSON.stringify(label)}, ${plan});`);
      }
    } else if (target.endsWith('/generation-weeks.ts')) {
      source = replaceOnce(source, '} = allocateGenerationWeek(context, weekLoad, w, workouts, weeks, replan);', `globalThis.__strideDerivationWeek({week:w+1, ...weekLoad, desired, longDistance, wholeWeekAllocation, weekQualityDays, mediumDay, dates, allocation:[...allocation], weights:[...weights]});`);
    } else {
      source = replaceOnce(source, 'const capacity = Math.min(declared, ...capacities);', 'globalThis.__strideDerivationCapacity({declared, capacities, capacity});');
    }
    observed.add(target);
    return {format:'module', source:stripTypeScriptTypes(source), shortCircuit:true};
  },
});
const {makePlan, validatePlan, addDays, weekday} = await import('../lib/engine.ts');
async function fingerprint() {
  const hash = createHash('sha256');
  async function walk(dir) {
    const entries = await readdir(dir, {withFileTypes:true});
    for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name))) {
      const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) await walk(child);
      else if (entry.name.endsWith('.ts')) {hash.update(child.href.slice(root.href.length)); hash.update(await readFile(child));}
    }
  }
  await walk(new URL('lib/',root));
  return hash.digest('hex');
}
const before = await fingerprint();
const records=[];
function run(id, input, group, original) {
  active={id,group,input,trace:group==='original',stages:[],allocations:[],openingCapacityPasses:[]};
  try {
    const plan=makePlan(input,input.startDate,false);
    const errors=validatePlan(plan);
    active.result={status:errors.length?'validation-failure':'generated',errors,notes:plan.notes,profile:plan.profile,beginner:plan.beginner,firstRace:plan.firstRace,feasibility:plan.feasibility,weeks:weeks(plan)};
    if (original) {assert.deepEqual(weeks(plan),weeks(original),'Observed generator differs from saved reviewed examples'); active.matchesSaved=true;}
  } catch(error) {active.result={status:'rejected',message:error.message}; if(original) throw error;}
  records.push(active); active=undefined;
}
for(const e of saved) run(e.id,e.input,'original',e.plan);
const bands={
  '5k':[[12,4,3,12,5,35],[30,8,4,12,5,25],[55,13,6,12,5,25]],
  '10k':[[18,6,3,12,10,70],[36,11,4,12,10,50],[60,16,6,12,10,50]],
  half:[[25,8,4,16,21.0975,150],[45,16,4,16,21.0975,110],[65,18,6,16,21.0975,110]],
  marathon:[[30,10,4,20,10,70],[60,23,5,20,10,45],[70,23,5,20,10,45]],
};
for(const [goal,profiles] of Object.entries(bands)) for(const [index,values] of profiles.entries()) for(const q of [0,1,2]) {
  const [weeklyKm,longestKm,runs,count,distanceKm,timeMinutes]=values;
  const input={...saved.find((e)=>e.input.goal===goal).input,weeklyKm,longestKm,currentRuns:runs,runsPerWeek:runs,days:{3:[1,3,6],4:[0,2,4,6],5:[0,1,2,4,6],6:[0,1,2,3,4,6]}[runs],raceDate:addDays('2026-09-28',count*7-1),recentRace:{distanceKm,timeMinutes},qualitySessions:q,recentQualitySessions:2,recentQualityMinutes:40};
  run(`${goal}-${['lower','middle','higher'][index]}-q${q}`,input,'matched');
}
const firstRace={'5k':[8,3,3,8],'10k':[15,5,3,8],half:[22,6,4,12],marathon:[30,10,4,18]};
for(const goal of Object.keys(bands)) for(const branch of ['zero-history','first-race']) for(const q of [0,1,2]) {
  const [weeklyKm,longestKm,runs,count]=branch==='zero-history'?[0,0,3,12]:firstRace[goal];
  const input={...saved.find((e)=>e.input.goal===goal).input,planLevel:'beginner',experience:'new',weeklyKm,longestKm,currentRuns:branch==='zero-history'?0:runs,runsPerWeek:runs,days:runs===3?[1,3,6]:[0,2,4,6],raceDate:addDays('2026-09-28',count*7-1),recentRace:undefined,easyPace:branch==='zero-history'?null:7,qualitySessions:q,recentQualitySessions:0,recentQualityMinutes:0,runMeasure:branch==='zero-history'?'time':'distance'};
  run(`${goal}-${branch}-q${q}`,input,branch);
}
assert.equal(observed.size,3);
const after=await fingerprint(); assert.equal(before,after,'Production source changed during audit');
await mkdir(folder,{recursive:true});
const summary={attempted:records.length,generated:records.filter((r)=>r.result.status==='generated').length,rejected:records.filter((r)=>r.result.status==='rejected').length,validationFailures:records.filter((r)=>r.result.status==='validation-failure').length,originalsMatched:records.filter((r)=>r.matchesSaved).length,sourceFingerprint:before,sourceUnchanged:before===after};
await writeFile(new URL('derivations.json',folder),JSON.stringify({summary,records},(_key,value)=>typeof value==='number'&&!Number.isFinite(value)?String(value):value,2)+'\n',{flag:'wx'});
const lines=['# Actual derivation trace','','Read-only observations of the production generator. The hook inserts observations after existing calls; it does not substitute their logic. All 12 regenerated examples must equal the saved day-by-day example summaries, including titles, actual work minutes and templates. No production files are changed.','','```json',JSON.stringify(summary,null,2),'```','','## Comparison caveat','','The earlier two-workout examples changed starting mileage, familiar long run and/or running frequency. They cannot isolate the effect of selecting a second workout. The matched matrix below holds those inputs, benchmark and declared quality history fixed within each three-case group. These are synthetic input fixtures, not recommended starting routines. Lower/middle/higher are fixture labels, not source-authored coaching levels.','','## All original examples: each week explained','','Initial km is the sum after the first recipe allocation, before reconciliation. Nominal km is the allocator’s weekly budget. Final km excludes race distance. Q counts weekday quality; hard includes hard long runs and therefore can exceed Q. A dash means no designated long outing.'];
for(const r of records.filter((r)=>r.group==='original')) {
  const c=r.context;
  lines.push('',`## ${r.id}`,'',`Input: ${r.input.weeklyKm} km/week, ${r.input.longestKm} km familiar long, ${r.input.runsPerWeek} days; ${r.input.recentRace.distanceKm} km in ${r.input.recentRace.timeMinutes} minutes. Input days: ${r.input.days.map((d)=>dayNames[d]).join('/')}; chosen days: ${r.normalizedProfile.days.map((d)=>dayNames[d]).join('/')}.`,`Policy: ${c.road?.ability??'marathon'}; allocation easy pace ${round(c.pace)} min/km; nominal long target ${round(c.peakLong)} km; peak week ${c.peakWeek+1}; preparation window ${c.preparationWeeks} weeks; quality days ${c.qualityDays.map((d)=>dayNames[d]).join('/')||'none'}; medium day ${c.mediumDay===undefined?'none':dayNames[c.mediumDay]}.`,'','| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |','| --- | ---: | ---: | ---: | --- | --- | --- |');
  for(const w of r.result.weeks) {
    const a=r.allocations.find((a)=>a.week===w.week), initial=r.stages[0].weeks.find((v)=>v.week===w.week);
    lines.push(`| ${w.week} ${w.phase} | ${round(a.desired)} | ${initial.km} | ${w.km} | ${initial.longKm??'—'} → ${w.longKm??'—'} | ${w.weekdayWorkouts} / ${w.hardSessions} | ${w.runs.map((s)=>`${dayNames[weekday(s.date)]} ${s.kind}${s.role?'('+s.role+')':''} ${s.km}`).join('; ')} |`);
  }
  lines.push('','### Week-one calculation changes','','Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.','','| Operation | Week-one km | Long km | Individual distances |','| --- | ---: | ---: | --- |');
  let prior;
  for(const stage of r.stages) {const w=stage.weeks[0]; const state=JSON.stringify(w.runs.map((s)=>[s.km,s.minutes,s.template])); if(state===prior) continue; prior=state; lines.push(`| ${stage.label} | ${w.km} | ${w.longKm??'—'} | ${w.runs.map((s)=>s.km).join(' / ')} |`);}
  lines.push('','### Recovery-week calculation changes','','Only stages changing the week are shown; both distances and prescription time/template changes count.');
  for(const w of r.result.weeks.filter((w)=>w.phase==='Recovery')) {
    let prior;
    const sequence=[];
    for(const stage of r.stages) {const row=stage.weeks.find((v)=>v.week===w.week);const state=JSON.stringify(row.runs.map((s)=>[s.km,s.minutes,s.template]));if(prior===state)continue;prior=state;sequence.push(`${stage.label}: ${row.km} km total / ${row.longKm??'—'} km long`);}
    lines.push(`- Week ${w.week}: ${sequence.join(' → ')}.`);
  }
  lines.push('','### Actual weekday workout main sets','','These are generated Stride prescriptions. They are not transcriptions from a published schedule.');
  for(const w of r.result.weeks) {const qs=w.runs.filter((s)=>s.hard&&s.kind!=='long');if(qs.length)lines.push(`- Week ${w.week}: ${qs.map((s)=>`${s.title} [${s.template??'no template'}], ${s.qualityMinutes} min work, ${s.km} km total`).join('; ')}.`);}
}
lines.push('','## Matched inputs and beginner branches','','Q0/Q1/Q2 in each matched group differ only in requested quality count. All other runner inputs, including declared recent quality exposure, stay identical. Beginner branches explicitly declare no recent quality. Refusals are outcomes, not successful or suitable training plans.','','| Case | Input weekly / long / days | Outcome | Opening → peak training km | Long sequence (all weeks) | Weekday workout counts (all weeks) |','| --- | --- | --- | --- | --- | --- |');
for(const r of records.filter((r)=>r.group!=='original')) {const w=r.result.weeks;lines.push(`| ${r.id} | ${r.input.weeklyKm} / ${r.input.longestKm} / ${r.input.runsPerWeek} | ${w?r.result.feasibility?.status??'generated':r.result.message.replaceAll('|','/')} | ${w?r.group==='zero-history'?'Unprescribed (timed run/walk)':w[0].km+' → '+Math.max(...w.map((x)=>x.km)):'—'} | ${w?w.map((x)=>x.longKm??'—').join(', '):'—'} | ${w?w.map((x)=>x.weekdayWorkouts).join(', '):'—'} |`);}
lines.push('', 'Zero-history lessons prescribe time, not distance. Their internal zero distance placeholders in the JSON trace do not mean zero exercise or a measured zero-kilometre run. The calendar repeats the currently approved beginner stage until a completion review advances it.');
await writeFile(new URL('week-by-week-derivations.md',folder),lines.join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify(summary,null,2));
