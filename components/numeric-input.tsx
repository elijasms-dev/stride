'use client';
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useId,
  useRef,
  useState,
} from 'react';
import {
  numericText,
  paceText,
  parseNumericText,
  parsePaceText,
} from '@/lib/form-values';

export type NumericDraft = {
  text: string;
  value: string;
  factor: number;
  pace: boolean;
};
const signature = (value: number | null | undefined) =>
  value == null ? 'blank' : String(value);
export const NumericDraftContext = createContext<{
  values: Record<string, NumericDraft>;
  set: (name: string, entry: NumericDraft) => void;
} | null>(null);

export function NumericInput({
  value,
  onValueChange,
  name,
  label,
  factor = 1,
  min = 0,
  max = Infinity,
  integer = false,
  required = false,
  pace = false,
  placeholder,
  disabled = false,
  ...accessibility
}: {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  name: string;
  label?: string;
  factor?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  required?: boolean;
  pace?: boolean;
  placeholder?: string;
  disabled?: boolean;
  'aria-describedby'?: string;
}) {
  const draft = useContext(NumericDraftContext);
  const format = useCallback(
    (v: number | null | undefined, f: number) =>
      pace ? paceText(v, f) : numericText(v, f),
    [pace],
  );
  const [text, setText] = useState(() => {
    const cached = draft?.values[name];
    return cached &&
      typeof cached.text === 'string' &&
      cached.factor === factor &&
      cached.pace === pace &&
      (cached.value === signature(value) ||
        (value == null && cached.value === 'NaN'))
      ? cached.text
      : format(value, factor);
  });
  const [touched, setTouched] = useState(false);
  const last = useRef({ value, factor });
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    if (
      !Object.is(last.current.value, value) ||
      last.current.factor !== factor
    ) {
      const next = Number.isFinite(value)
        ? format(value, factor)
        : value == null
          ? ''
          : text;
      last.current = { value, factor };
      setText(next);
      if (draft?.values[name]?.text !== next)
        draft?.set(name, { text: next, value: signature(value), factor, pace });
    }
  }, [value, factor, pace, name, draft, text, format]);
  const parsed = pace ? parsePaceText(text, factor) : parseNumericText(text);
  const canonical = parsed == null ? null : pace ? parsed : parsed * factor;
  const error =
    canonical == null
      ? required
        ? 'Enter a value.'
        : ''
      : !Number.isFinite(canonical)
        ? pace
          ? 'Use minutes:seconds, for example 6:17 or 6:17.5. Decimal minutes such as 6.17 are not accepted.'
          : 'Enter a number. A decimal point or comma is accepted; do not use thousands separators.'
        : integer && !Number.isInteger(canonical)
          ? 'Enter a whole number.'
          : canonical < min - 1e-8 || canonical > max + 1e-8
            ? pace
              ? `Use a pace from ${paceText(min, factor)} to ${paceText(max, factor)}, or leave it blank.`
              : `Enter ${numericText(min, factor)}–${numericText(max, factor)}${required ? '.' : ', or leave it blank.'}`
            : '';
  useEffect(() => {
    input.current?.setCustomValidity(error);
  }, [error]);
  return (
    <>
      <input
        ref={input}
        id={id}
        name={name}
        type="text"
        inputMode={pace ? 'text' : integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        spellCheck={false}
        required={required}
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={touched && !!error}
        aria-describedby={
          [
            accessibility['aria-describedby'],
            touched && error ? `${id}-error` : '',
          ]
            .filter(Boolean)
            .join(' ') || undefined
        }
        onInvalid={() => setTouched(true)}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          const parsed = pace
            ? parsePaceText(raw, factor)
            : parseNumericText(raw);
          const next =
            parsed == null
              ? required
                ? NaN
                : null
              : pace
                ? parsed
                : parsed * factor;
          last.current = { value: next, factor };
          setText(raw);
          draft?.set(name, { text: raw, value: signature(next), factor, pace });
          onValueChange(next);
        }}
      />
      {touched && error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </>
  );
}
