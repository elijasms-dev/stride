import { addDays } from './plan/calendar.ts';
import { type Plan, type Workout } from './plan/types.ts';
import { supportingSession } from './coaching-context.ts';
import { journalEntries } from './journal-view.ts';
import { orderedDaySessions } from './day-sessions.ts';
import { isRunWalkWorkout } from './run-walk.ts';

export type GuideSection = {
  id: 'before' | 'food' | 'after' | 'recovery' | 'next';
  label: string;
  title: string;
  paragraphs: string[];
};
export type DailyGuide = { key: string; sections: GuideSection[] };

/** Presentation only. Actual recordings never become an inferred rest day. */
export function dayOverview(plan: Plan, date: string) {
  const records = journalEntries(plan).filter(
    (entry) => entry.record.date === date,
  );
  const sessions = orderedDaySessions(plan.workouts, date);
  const planned = sessions.filter((w) => w.status === 'planned');
  const activity = supportingSession(plan, date);
  const title = planned.length
    ? 'Training day'
    : records.length
      ? 'Run recorded'
      : date < plan.profile.startDate
        ? 'Before your plan'
        : date > plan.profile.raceDate
          ? 'After your block'
          : sessions.some((w) => w.status === 'skipped')
            ? 'Session skipped'
            : (activity?.title ?? 'Rest day');
  return { title, records, activity, planned };
}

const foodAfter =
  'Your next regular meal can support recovery. Include carbohydrate and protein: rice with beans or tofu, potatoes with eggs, or a sandwich with a filling you enjoy. If you are hungry and a meal is a while away, a familiar snack can help. Choose foods that fit your dietary needs.';
const hydration =
  'Have fluids available and drink to thirst. Needs change with heat and sweat; do not force a fixed amount of water.';
const nextDay = (plan: Plan, date: string): GuideSection => {
  const tomorrow = addDays(date, 1);
  const { planned: next, records } = dayOverview(plan, tomorrow);
  return {
    id: 'next',
    label: 'Next day',
    title: 'Make tomorrow easier',
    paragraphs: [
      next.length
        ? `Tomorrow’s plan: ${next.map((w) => w.title).join('; ')}. Get familiar kit ready and leave time for breakfast or a snack if you want one.`
        : records.length
          ? 'Running is already recorded for the next day. Open that date to review what you did.'
          : tomorrow > plan.profile.raceDate
            ? 'There is no session in this block tomorrow. Give yourself time to recover before deciding on your next goal.'
            : 'No run is scheduled tomorrow. There is no missed mileage to make up.',
      'Protect a regular bedtime and give yourself enough time to sleep.',
    ],
  };
};

/** Advisory copy derived from the saved session, never a new prescription or adaptation. */
export function dailyGuide(
  plan: Plan,
  date: string,
  workout?: Workout,
): DailyGuide {
  const overview = dayOverview(plan, date);
  if (!workout && overview.planned.length)
    return dailyGuide(plan, date, overview.planned[0]);
  const key = `${plan.id}:${date}:${workout?.id ?? 'day'}:${workout?.status ?? 'rest'}`;
  const recorded =
    workout?.status === 'completed' ||
    (workout?.status !== 'planned' && overview.records.length > 0);
  if (!workout || workout.status === 'skipped') {
    const skipped = workout?.status === 'skipped';
    return {
      key,
      sections: [
        {
          id: 'recovery',
          label: 'Recovery',
          title: recorded
            ? 'Give yourself time after your run'
            : 'Let this be an easier day',
          paragraphs: [
            recorded
              ? 'There is running recorded for this date. Refuel, have something to drink and leave room to recover. Keep to your saved schedule rather than adding extra running.'
              : skipped
                ? overview.planned.length
                  ? 'This session is marked skipped. Other sessions remain in today’s plan; check their details and avoid adding the skipped work on top.'
                  : 'This session is marked skipped. There is no need to make up the missed work today.'
                : overview.activity
                  ? `${overview.activity.title} is optional today. Keep the saved ${overview.activity.minutes}-minute limit and reduce or skip it if you need more rest.`
                  : 'No run is scheduled. A gentle walk or a little comfortable mobility is optional; taking the day off is also a good choice.',
            overview.activity?.notes ??
              'Choose movement that feels easy. Avoid turning a recovery day into another demanding workout.',
          ],
        },
        {
          id: 'food',
          label: 'Food & drink',
          title: 'Keep regular meals',
          paragraphs: [
            recorded
              ? foodAfter
              : overview.planned.length
                ? 'Keep regular meals with carbohydrate and protein. Check the remaining session’s food tips when preparing to run.'
                : 'Include carbohydrate, protein, fruit or vegetables in meals you enjoy. Your body still needs fuel on a day without running; adjust portions to appetite rather than skipping meals.',
            hydration,
          ],
        },
        nextDay(plan, date),
      ],
    };
  }
  const runWalk = isRunWalkWorkout(workout);
  const returning =
    !!workout.returnRole ||
    workout.steps.some((s) => s.movement === 'walk' && s.kind !== 'recovery') ||
    (!!plan.returnState &&
      plan.returnState.stage < 3 &&
      date >= plan.returnState.from);
  const race = workout.kind === 'race';
  const long = workout.kind === 'long' || workout.minutes >= 90;
  const quality = workout.hard && !returning;
  const before: GuideSection = {
    id: 'before',
    label: 'Before',
    title: race
      ? 'Keep race morning familiar'
      : runWalk
        ? 'Keep the walking breaks'
        : returning
          ? 'Start gently'
          : quality
            ? 'Give the warm-up its space'
            : long
              ? 'Plan the outing'
              : 'Keep the start simple',
    paragraphs: [
      race
        ? 'Check the start time, route to the start and weather. Use shoes, clothing and breakfast you have already tried in training.'
        : runWalk
          ? 'The walking steps are part of this session. Jog at an effort that lets you speak in full sentences, then walk for the prescribed recovery. Choose a familiar, level route.'
          : returning
            ? 'Choose a familiar, level route. Follow the saved run and walk steps without extending the session or adding faster efforts.'
            : quality
              ? 'Use a predictable route with room for your repetitions. Follow the prescribed warm-up before the faster work; start the first effort under control.'
              : long
                ? 'Choose a route with a way home and places to get water. Check the weather and carry the fuel and kit you have already practised with.'
                : 'Choose a comfortable route and check the weather. Start relaxed and let your breathing settle; an easy run does not need a fast opening kilometre.',
      race
        ? 'Leave time for toilets and the planned warm-up. Avoid trying new gels, supplements or a different meal on the day.'
        : runWalk
          ? 'There is no need to remove the walks or extend the running intervals early. Log how this session felt; repeating the current stage is a useful part of building consistency.'
          : quality
            ? 'Keep the recoveries in the workout. They help you prepare for the next repetition; they are not extra intervals.'
            : 'Follow the session’s effort cues and distance or time limit. Preparation does not add extra running to the plan.',
    ],
  };
  const food: GuideSection = {
    id: 'food',
    label: 'Food & drink',
    title:
      race || long
        ? 'Use a familiar fuelling routine'
        : 'Eat in a way that feels comfortable',
    paragraphs: [
      recorded
        ? foodAfter
        : race || long
          ? 'Have a familiar carbohydrate-rich meal or snack before you go, with time for it to settle. During a longer outing, use food or sports fuel you already tolerate and practise your race routine.'
          : quality
            ? 'Avoid starting hungry. A familiar carbohydrate snack, such as toast or a banana, can be useful if your last meal was a while ago; give your stomach time before the faster work.'
            : workout.minutes <= 60
              ? 'Normal meals are usually enough for a short easy run. If you are hungry before heading out, try a familiar snack such as toast or a banana; gels are not automatically needed.'
              : 'Have a familiar meal or snack before heading out. For a longer outing, consider carrying a snack you already tolerate.',
      hydration,
    ],
  };
  const after: GuideSection = {
    id: 'after',
    label: 'After',
    title: recorded
      ? 'Recover after your run'
      : race
        ? 'Give recovery room'
        : long || quality
          ? 'Recover after harder running'
          : 'Finish comfortably',
    paragraphs: [
      recorded
        ? 'Your run is recorded. Base recovery on what you actually did and how you feel; there is no need to complete any unfinished steps later.'
        : race
          ? 'Ease out of the finish area, get comfortable and begin replacing food and fluids. The time you need before hard training depends on the event and how you feel; the race result alone does not decide it.'
          : 'Complete any cool-down already in the workout, then get comfortable. There is no need to add extra distance to round up your recording.',
      foodAfter,
      !recorded && (long || quality || race)
        ? 'Keep the rest of the day easy where you can and make room for sleep. Gentle movement is optional; do not force stretches into soreness.'
        : 'Carry on with your day and give yourself a normal opportunity to sleep. Extra recovery routines are optional.',
    ],
  };
  return {
    key,
    sections: recorded
      ? [after, food, nextDay(plan, date)]
      : [before, food, after],
  };
}
