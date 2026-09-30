'use client';

import type { Ref } from 'react';
import {
  CalendarDays,
  ChartNoAxesCombined,
  Footprints,
  Settings2,
} from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

export const APP_NAVIGATION = [
  { value: 'today', label: 'Today', icon: Footprints },
  { value: 'plan', label: 'Your plan', icon: CalendarDays },
  { value: 'progress', label: 'Progress', icon: ChartNoAxesCombined },
  { value: 'settings', label: 'Settings', icon: Settings2 },
] as const;
export type AppView = (typeof APP_NAVIGATION)[number]['value'];
export function isAppView(value: unknown): value is AppView {
  return APP_NAVIGATION.some((item) => item.value === value);
}

/** Keep one tab list in the Tabs root so keyboard navigation and panel IDs stay intact. */
export function FloatingNavigation({
  overlayRef,
  disabled = false,
}: {
  overlayRef?: Ref<HTMLDivElement>;
  disabled?: boolean;
}) {
  return (
    <div
      ref={overlayRef}
      className="athletic-nav-overlay fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none"
    >
      <div className="responsive-navigation" id="stride-navigation">
        <TabsList
          className="athletic-nav pointer-events-auto"
          aria-label="Main navigation"
        >
          {APP_NAVIGATION.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              disabled={disabled}
              title={label}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={2} />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </div>
  );
}
