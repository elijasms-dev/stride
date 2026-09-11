'use client';
import { useId, useState } from 'react';
import { runFeedbackError } from '@/lib/form-values';

/** Keep feedback validation next to the runner's missing answer. */
export function useRunFeedbackValidation(effort: string, feeling: string) {
  const id = useId();
  const [submitted, setSubmitted] = useState(false);
  const effortId = `${id}-effort`;
  const feelingId = `${id}-feeling`;
  const effortError = runFeedbackError(effort, 'okay');
  const feelingError = runFeedbackError('1', feeling);
  return {
    effortId,
    feelingId,
    effortError: submitted ? effortError : undefined,
    feelingError: submitted ? feelingError : undefined,
    validate() {
      setSubmitted(true);
      if (!effortError && !feelingError) return true;
      const firstMissing = effortError ? effortId : feelingId;
      requestAnimationFrame(() => {
        document.getElementById(firstMissing)?.focus();
      });
      return false;
    },
  };
}
