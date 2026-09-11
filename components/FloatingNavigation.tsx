'use client';

import type { Ref } from 'react';
import {
  CalendarDays,
  ChartNoAxesCombined,
  Footprints,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sidebar, useSidebar } from '@/components/ui/sidebar';

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
  const { open, setOpen } = useSidebar();
  return (
    <div
      ref={overlayRef}
      className="athletic-nav-overlay fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none"
    >
      <Sidebar
        collapsible="none"
        className="responsive-navigation"
        id="stride-navigation"
      >
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
        <button
          type="button"
          className="sidebar-collapse"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="stride-navigation"
          aria-label={open ? 'Collapse navigation' : 'Expand navigation'}
          title={open ? 'Collapse navigation' : 'Expand navigation'}
        >
          {open ? (
            <PanelLeftClose size={20} aria-hidden="true" />
          ) : (
            <PanelLeftOpen size={20} aria-hidden="true" />
          )}
          <span>Collapse</span>
        </button>
      </Sidebar>
    </div>
  );
}
