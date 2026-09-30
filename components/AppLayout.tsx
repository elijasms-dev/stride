'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { Tabs } from '@/components/ui/tabs';
import { FloatingNavigation, isAppView } from './FloatingNavigation';
import { StrideLogo } from './StrideLogo';
import { WeatherProvider } from './weather-widget';

export type AppLayoutProps = {
  view: string;
  onViewChange: (view: string) => void;
  children: ReactNode;
  overlays?: ReactNode;
  status?: ReactNode;
  profileInitials: string;
  onProfile: () => void;
  scrollRef: RefObject<HTMLElement | null>;
  loading?: boolean;
  navigationDisabled?: boolean;
};

export function AppLayout({
  view,
  onViewChange,
  children,
  overlays,
  status,
  profileInitials,
  onProfile,
  scrollRef,
  loading = false,
  navigationDisabled = false,
}: AppLayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current,
      dock = navRef.current;
    if (!root || !dock) return;
    // The page reserves the measured pill plus its safe-area/bottom inset once.
    const navigation = dock.querySelector<HTMLElement>('.athletic-nav');
    if (!navigation) return;
    const desktop = window.matchMedia('(min-width: 768px)');
    const update = () =>
      root.style.setProperty(
        '--nav-occlusion',
        desktop.matches
          ? '0px'
          : `${Math.ceil(navigation.getBoundingClientRect().height)}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(navigation);
    desktop.addEventListener('change', update);
    return () => {
      observer.disconnect();
      desktop.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [view, scrollRef]);

  function revealFocusedControl(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return;
    requestAnimationFrame(() => {
      const main = scrollRef.current,
        dock = navRef.current;
      if (
        !main ||
        !dock ||
        !main.contains(target) ||
        document.activeElement !== target
      )
        return;
      const rect = target.getBoundingClientRect(),
        viewport = main.getBoundingClientRect();
      const navigation = dock.querySelector<HTMLElement>('.athletic-nav');
      const visibleBottom = Math.min(
        viewport.bottom - 8,
        window.matchMedia('(min-width: 768px)').matches || !navigation
          ? viewport.bottom - 8
          : navigation.getBoundingClientRect().top - 16,
      );
      const visibleTop = viewport.top + 8;
      if (rect.height > visibleBottom - visibleTop) return;
      if (rect.bottom > visibleBottom)
        main.scrollBy({
          top: rect.bottom - visibleBottom,
          behavior: 'instant',
        });
      else if (rect.top < visibleTop)
        main.scrollBy({ top: rect.top - visibleTop, behavior: 'instant' });
    });
  }

  return (
    <WeatherProvider>
      <div
        ref={rootRef}
        className="app-shell running-journal stride-redesign athletic-shell"
        data-view={view}
      >
        <a className="skip-link athletic-skip-link" href="#main-content">
          Skip to your training
        </a>
        <Tabs
          value={isAppView(view) ? view : 'today'}
          onValueChange={(value) => {
            if (isAppView(value)) onViewChange(value);
          }}
          orientation="horizontal"
          className="app-tabs athletic-tabs"
        >
          <header className="topbar athletic-topbar">
            <Link
              className="wordmark"
              href="/"
              prefetch={false}
              aria-label="Stride home"
            >
              <StrideLogo />
            </Link>
            <div className="top-actions">
              {status}
              <button
                type="button"
                className="avatar-button"
                aria-label="Your profile"
                onClick={onProfile}
                disabled={navigationDisabled}
              >
                {profileInitials}
              </button>
            </div>
          </header>
          <FloatingNavigation
            overlayRef={navRef}
            disabled={navigationDisabled}
          />
          <main
            ref={scrollRef}
            id="main-content"
            className="athletic-main"
            tabIndex={-1}
            aria-busy={loading || undefined}
            onFocusCapture={(event) => revealFocusedControl(event.target)}
          >
            <div className="workspace">{children}</div>
          </main>
        </Tabs>
        {overlays}
      </div>
    </WeatherProvider>
  );
}
