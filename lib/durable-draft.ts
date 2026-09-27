'use client';
/* oxlint-disable react/react-compiler -- Drafts hydrate from scoped browser storage after SSR. */
import { useEffect, useRef, useState } from 'react';

export const DURABLE_DRAFT_PREFIX = 'stride-feedback-draft:';
export const DRAFT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_DRAFT_SIZE = 64 * 1024;
export type DraftStatus = 'ready' | 'saved' | 'restored' | 'unavailable';
export function durableDraftKey(scope: string, key: string) {
  return `${DURABLE_DRAFT_PREFIX}${encodeURIComponent(scope)}:${encodeURIComponent(key)}`;
}
/** Remove feedback belonging to signed-out accounts while retaining the active epoch. */
export function purgeDurableDrafts(
  activeScope?: string,
  storage?: Pick<Storage, 'length' | 'key' | 'removeItem'>,
) {
  try {
    const target = storage ?? localStorage;
    const keepPrefix = activeScope
      ? `${DURABLE_DRAFT_PREFIX}${encodeURIComponent(activeScope)}:`
      : null;
    const remove: string[] = [];
    for (let index = 0; index < target.length; index++) {
      const key = target.key(index);
      if (
        key?.startsWith(DURABLE_DRAFT_PREFIX) &&
        (!keepPrefix || !key.startsWith(keepPrefix))
      )
        remove.push(key);
    }
    for (const key of remove) target.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** A stale tab must not erase drafts belonging to a newer signed-in account. */
export function purgeScopeDurableDrafts(
  scope: string,
  storage?: Pick<Storage, 'length' | 'key' | 'removeItem'>,
) {
  if (!scope) return true;
  try {
    const target = storage ?? localStorage;
    const prefix = `${DURABLE_DRAFT_PREFIX}${encodeURIComponent(scope)}:`;
    const remove: string[] = [];
    for (let index = 0; index < target.length; index++) {
      const key = target.key(index);
      if (key?.startsWith(prefix)) remove.push(key);
    }
    for (const key of remove) target.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readDurableDraft<T>(
  raw: string | null,
  isValid: (value: unknown) => value is T,
  now = Date.now(),
): T | null {
  if (!raw || raw.length > MAX_DRAFT_SIZE) return null;
  try {
    const record = JSON.parse(raw);
    return record?.version === 1 &&
      Number.isFinite(record.savedAt) &&
      record.savedAt <= now + 60_000 &&
      now - record.savedAt <= DRAFT_LIFETIME_MS &&
      isValid(record.value)
      ? record.value
      : null;
  } catch {
    return null;
  }
}

/** Mount each form per account epoch and record. Never reuse a draft across accounts. */
export function useDurableDraft<T>({
  scope,
  key,
  value,
  restore,
  isValid,
  enabled = true,
}: {
  scope: string;
  key: string;
  value: T;
  restore: (value: T) => void;
  isValid: (value: unknown) => value is T;
  enabled?: boolean;
}) {
  const [identity] = useState(() => ({
    scope,
    key,
    storageKey: durableDraftKey(scope, key),
  }));
  const [ready, setReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('ready');
  const finished = useRef(false);
  const restored = useRef(false);
  const callbacks = useRef({ restore, isValid });
  useEffect(() => {
    callbacks.current = { restore, isValid };
  });
  useEffect(() => {
    if (
      !identity.scope ||
      !enabled ||
      restored.current ||
      scope !== identity.scope ||
      key !== identity.key
    )
      return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(identity.storageKey);
      const saved = readDurableDraft(raw, callbacks.current.isValid);
      if (saved !== null) {
        callbacks.current.restore(saved);
        setDraftStatus('restored');
      } else if (raw) localStorage.removeItem(identity.storageKey);
    } catch {
      setDraftStatus('unavailable');
    }
    setReady(true);
  }, [identity, enabled, scope, key]);
  useEffect(() => {
    if (
      !ready ||
      !enabled ||
      finished.current ||
      !scope ||
      scope !== identity.scope ||
      key !== identity.key
    )
      return;
    try {
      const raw = JSON.stringify({ version: 1, savedAt: Date.now(), value });
      if (raw.length > MAX_DRAFT_SIZE)
        throw new Error('Draft exceeds storage budget');
      localStorage.setItem(identity.storageKey, raw);
      setDraftStatus((status) => (status === 'restored' ? status : 'saved'));
    } catch {
      setDraftStatus('unavailable');
    }
  }, [ready, enabled, scope, key, value, identity]);
  const clearDraft = () => {
    finished.current = true;
    if (!scope || scope !== identity.scope || key !== identity.key) return;
    try {
      localStorage.removeItem(identity.storageKey);
    } catch {
      setDraftStatus('unavailable');
    }
  };
  return { draftStatus, clearDraft };
}
