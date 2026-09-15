import {
  CrcCalculator,
  Decoder,
  Stream,
  Profile,
  Utils,
  type FileIdMesg,
  type WorkoutMesg,
  type WorkoutStepMesg,
} from '@garmin/fitsdk';
import { validDate } from './plan/calendar.ts';
import { type Workout } from './plan/types.ts';
import { FitExportError } from './fit-error.ts';
import { validStepTarget } from './workout-targets.ts';

const MAX_FIT_BYTES = 1024 * 1024;
const FIT_HEADER_BYTES = 14;
const WORKOUT_BASE_TYPES: Record<string, readonly [number, number]> = {
  enum: [0, 1],
  uint8: [2, 1],
  uint16: [0x84, 2],
  uint32: [0x86, 4],
  uint32z: [0x8c, 4],
};

/** The SDK encoder reserves a 500 MB resizable buffer and does not expose its
 * stream options. Write only our three workout messages into a bounded buffer;
 * the SDK still supplies field definitions, enums, dates, CRC and verification. */
class WorkoutEncoder {
  private bytes = new Uint8Array(new ArrayBuffer(1024));
  private offset = FIT_HEADER_BYTES;
  private textEncoder = new TextEncoder();

  private reserve(count: number) {
    const required = this.offset + count;
    // Reserve the final CRC as well, so oversized workouts fail during FIT_STEPS.
    if (required + 2 > MAX_FIT_BYTES) throw new FitExportError('FIT_STEPS');
    if (required + 2 <= this.bytes.length) return;
    const grown = new Uint8Array(
      new ArrayBuffer(
        Math.min(MAX_FIT_BYTES, Math.max(required + 2, this.bytes.length * 2)),
      ),
    );
    grown.set(this.bytes);
    this.bytes = grown;
  }

  private unsigned(value: number, size: number) {
    if (!Number.isInteger(value) || value < 0 || value >= 2 ** (size * 8))
      throw new Error('Unsupported FIT field value.');
    this.reserve(size);
    const view = new DataView(this.bytes.buffer);
    if (size === 1) view.setUint8(this.offset, value);
    else if (size === 2) view.setUint16(this.offset, value, true);
    else view.setUint32(this.offset, value, true);
    this.offset += size;
  }

  onMesg(mesgNum: number, message: FileIdMesg | WorkoutMesg | WorkoutStepMesg) {
    const values = message as unknown as Record<string, unknown>;
    const fields = Object.values(Profile.messages[mesgNum].fields)
      .filter((field) => values[field.name] !== undefined)
      .map((field) => {
        const value = values[field.name];
        if (field.baseType === 'string') {
          // FIT field lengths are one byte, including the terminating zero.
          if (
            typeof value !== 'string' ||
            value.length > 254 ||
            value.includes('\0')
          )
            throw new Error('FIT text exceeds its field capacity.');
          const bytes = this.textEncoder.encode(value);
          if (bytes.length > 254)
            throw new Error('FIT text exceeds its field capacity.');
          return {
            num: field.num,
            type: 7,
            size: bytes.length + 1,
            bytes,
            value: 0,
          };
        }
        const base = WORKOUT_BASE_TYPES[field.baseType];
        if (!base || field.scale !== 1 || field.offset !== 0)
          throw new Error('Unsupported workout field definition.');
        const numeric =
          value instanceof Date
            ? Utils.convertDateToDateTime(value)
            : typeof value === 'string'
              ? Number(
                  Object.entries(Profile.types[field.type] ?? {}).find(
                    ([, label]) => label === value,
                  )?.[0] ?? NaN,
                )
              : Number(value);
        return {
          num: field.num,
          type: base[0],
          size: base[1],
          bytes: undefined,
          value: numeric,
        };
      });
    // Local message 0 is redefined for each record, allowing exact UTF-8 lengths.
    this.unsigned(0x40, 1);
    this.unsigned(0, 1);
    this.unsigned(0, 1); // Little-endian architecture.
    this.unsigned(mesgNum, 2);
    this.unsigned(fields.length, 1);
    for (const field of fields) {
      this.unsigned(field.num, 1);
      this.unsigned(field.size, 1);
      this.unsigned(field.type, 1);
    }
    this.unsigned(0, 1);
    for (const field of fields) {
      if (field.bytes) {
        this.reserve(field.size);
        this.bytes.set(field.bytes, this.offset);
        this.offset += field.bytes.length;
        this.unsigned(0, 1);
      } else this.unsigned(field.value, field.size);
    }
  }

  close() {
    const header = new DataView(this.bytes.buffer);
    header.setUint8(0, FIT_HEADER_BYTES);
    header.setUint8(1, 0x20); // FIT protocol 2.0.
    header.setUint16(
      2,
      Profile.version.major * 1000 + Profile.version.minor,
      true,
    );
    header.setUint32(4, this.offset - FIT_HEADER_BYTES, true);
    this.bytes.set([0x2e, 0x46, 0x49, 0x54], 8);
    header.setUint16(12, CrcCalculator.calculateCRC(this.bytes, 0, 12), true);
    header.setUint16(
      this.offset,
      CrcCalculator.calculateCRC(this.bytes, 0, this.offset),
      true,
    );
    return this.bytes.slice(0, this.offset + 2);
  }
}

/** Bounded FIT encoding with explicit custom ranges and complete effort cues. */
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
    const encoder = new WorkoutEncoder();
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
