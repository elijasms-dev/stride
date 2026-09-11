import {
  Encoder,
  Decoder,
  Stream,
  Profile,
  type FileIdMesg,
  type WorkoutMesg,
  type WorkoutStepMesg,
} from '@garmin/fitsdk';
import { validDate, type Workout } from './engine.ts';
import { FitExportError } from './fit-error.ts';
import { validStepTarget } from './workout-targets.ts';
/** Garmin SDK encoding with explicit custom ranges and effort cues in notes. */
export function encodeWorkout(workout: Workout): Uint8Array {
  if (!validDate(workout.originalDate)) throw new FitExportError('FIT_DATE');
  if (
    !workout.steps.length ||
    workout.steps.some(
      (s) =>
        !Number.isFinite(s.metres ?? s.seconds) || (s.metres ?? s.seconds) <= 0,
    )
  )
    throw new FitExportError('FIT_DURATION');
  if (
    workout.steps.some(
      (s) => s.target !== undefined && !validStepTarget(s.target),
    )
  )
    throw new FitExportError('FIT_TARGET');
  let stage = 'FIT_INIT';
  try {
    let serial = 2166136261;
    for (const c of workout.id)
      serial = Math.imul(serial ^ c.charCodeAt(0), 16777619) >>> 0;
    const encoder = new Encoder();
    stage = 'FIT_HEADER';
    encoder.onMesg(Profile.MesgNum.FILE_ID, {
      type: 'workout',
      manufacturer: 'development',
      product: 1,
      serialNumber: serial || 1,
      timeCreated: new Date(workout.originalDate + 'T12:00:00Z'),
    } as FileIdMesg);
    stage = 'FIT_WORKOUT';
    encoder.onMesg(Profile.MesgNum.WORKOUT, {
      sport: 'running',
      numValidSteps: workout.steps.length,
      wktName: workout.title.slice(0, 40),
    } as WorkoutMesg);
    stage = 'FIT_STEPS';
    workout.steps.forEach((s, index) =>
      encoder.onMesg(Profile.MesgNum.WORKOUT_STEP, {
        messageIndex: index,
        wktStepName: s.label.slice(0, 32),
        notes: s.effort,
        durationType: s.metres ? 'distance' : 'time',
        durationValue: s.metres ? s.metres * 100 : s.seconds * 1000,
        targetType:
          s.target?.mode === 'pace'
            ? 'speed'
            : s.target?.mode === 'heart-rate'
              ? 'heartRate'
              : 'open',
        targetValue: 0,
        ...(s.target
          ? {
              customTargetValueLow:
                s.target.mode === 'pace'
                  ? Math.round(1000000 / s.target.high)
                  : s.target.low + 100,
              customTargetValueHigh:
                s.target.mode === 'pace'
                  ? Math.round(1000000 / s.target.low)
                  : s.target.high + 100,
            }
          : {}),
        intensity:
          s.kind === 'warmup'
            ? 'warmup'
            : s.kind === 'cooldown'
              ? 'cooldown'
              : s.kind === 'recovery'
                ? 'recovery'
                : 'active',
      } as WorkoutStepMesg),
    );
    stage = 'FIT_CLOSE';
    const bytes = encoder.close();
    stage = 'FIT_READ';
    const decoder = new Decoder(Stream.fromByteArray(bytes));
    if (!decoder.checkIntegrity()) throw new FitExportError('FIT_INTEGRITY');
    const { messages, errors } = decoder.read();
    const steps = messages.workoutStepMesgs ?? [];
    if (
      errors.length ||
      steps.length !== workout.steps.length ||
      steps.some(
        (s, i) =>
          (workout.steps[i].target?.mode === 'pace'
            ? s.targetType !== 'speed' ||
              !Number.isFinite(s.customTargetSpeedLow) ||
              !Number.isFinite(s.customTargetSpeedHigh) ||
              Math.abs(
                Number(s.customTargetSpeedLow) -
                  Math.round(1000000 / workout.steps[i].target!.high) / 1000,
              ) > 0.00001 ||
              Math.abs(
                Number(s.customTargetSpeedHigh) -
                  Math.round(1000000 / workout.steps[i].target!.low) / 1000,
              ) > 0.00001
            : workout.steps[i].target?.mode === 'heart-rate'
              ? s.targetType !== 'heartRate' ||
                Number(s.customTargetHeartRateLow) !==
                  workout.steps[i].target!.low + 100 ||
                Number(s.customTargetHeartRateHigh) !==
                  workout.steps[i].target!.high + 100
              : s.targetType !== 'open') ||
          (workout.steps[i].metres
            ? Number(s.durationDistance) !== workout.steps[i].metres
            : Number(s.durationTime) !== workout.steps[i].seconds),
      )
    )
      throw new FitExportError(
        errors.length
          ? 'FIT_DECODE'
          : steps.length !== workout.steps.length
            ? 'FIT_STEP_COUNT'
            : 'FIT_STEP_MATCH',
      );
    return bytes;
  } catch (error) {
    if (error instanceof FitExportError) throw error;
    throw new FitExportError(stage);
  }
}
