'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import { elapsedTimeText, parseElapsedTime } from '@/lib/benchmark-input';
import { NumericDraftContext } from './numeric-input';
import { Field } from './stride-ui';

const name = 'recentRaceElapsedTime';
const signature = (value: number | null | undefined) =>
  value == null ? 'blank' : String(value);

/** Store minutes in the profile while retaining incomplete text in the setup draft. */
export function ElapsedTimeInput({
  value,
  onValueChange,
}: {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
}) {
  const draft = useContext(NumericDraftContext);
  const [text, setText] = useState(() => {
    const cached = draft?.values[name];
    return cached &&
      typeof cached.text === 'string' &&
      cached.factor === 1 &&
      !cached.pace &&
      (cached.value === signature(value) ||
        (value == null && cached.value === 'NaN'))
      ? cached.text
      : elapsedTimeText(value);
  });
  const [touched, setTouched] = useState(false);
  const last = useRef(value);
  const input = useRef<HTMLInputElement>(null);
  const parsed = parseElapsedTime(text);
  const error =
    parsed === null
      ? 'Enter the elapsed finish time.'
      : !Number.isFinite(parsed)
        ? 'Use hours:minutes:seconds, for example 1:45:30, or minutes:seconds such as 25:30.'
        : parsed <= 0 || parsed > 1500
          ? 'Enter a finish time greater than zero and no longer than 25 hours.'
          : '';
  useEffect(() => {
    if (!Object.is(last.current, value)) {
      const next = Number.isFinite(value)
        ? elapsedTimeText(value)
        : value == null
          ? ''
          : text;
      last.current = value;
      setText(next);
      if (draft?.values[name]?.text !== next)
        draft?.set(name, {
          text: next,
          value: signature(value),
          factor: 1,
          pace: false,
        });
    }
  }, [value, draft, text]);
  useEffect(() => {
    input.current?.setCustomValidity(error);
  }, [error]);
  return (
    <Field
      label="Finish time (hh:mm:ss)"
      hint="Elapsed time, including any stops. For 50 minutes, enter 0:50:00 or 50:00."
      error={touched ? error : ''}
    >
      <input
        ref={input}
        type="text"
        name={name}
        aria-label="Race finish time in hours, minutes and seconds"
        autoComplete="off"
        spellCheck={false}
        required
        inputMode="text"
        value={text}
        placeholder="0:50:00"
        onInvalid={() => setTouched(true)}
        onBlur={() => setTouched(true)}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          const next = parseElapsedTime(raw) ?? NaN;
          last.current = next;
          setText(raw);
          draft?.set(name, {
            text: raw,
            value: signature(next),
            factor: 1,
            pace: false,
          });
          onValueChange(next);
        }}
      />
    </Field>
  );
}
