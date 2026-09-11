'use client';
import { useEffect, useState } from 'react';
import {
  applyAppearance,
  parseTheme,
  readAppearance,
  type Appearance,
} from '@/lib/appearance';

export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>({
    theme: 'system',
    motion: true,
  });
  useEffect(() => {
    const sync = () => {
      let value: Appearance = { theme: 'system', motion: true };
      try {
        value = readAppearance(window.localStorage);
      } catch {}
      applyAppearance(value);
      setAppearance(value);
    };
    sync();
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        ['stride-theme', 'stride-motion'].includes(event.key)
      )
        sync();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const update = (patch: Partial<Appearance>) => {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    applyAppearance(next);
    try {
      localStorage.setItem('stride-theme', next.theme);
      localStorage.setItem('stride-motion', next.motion ? 'on' : 'off');
    } catch {
      /* Device-only choice remains usable when persistence is unavailable. */
    }
  };
  return {
    theme: appearance.theme,
    motion: appearance.motion,
    setTheme: (theme: string) => update({ theme: parseTheme(theme) }),
    setMotion: (motion: boolean) => update({ motion }),
  };
}
