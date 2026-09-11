'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { Tabs } from '@/components/ui/tabs';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { FloatingNavigation, isAppView } from './FloatingNavigation';
import { StrideLogo } from './StrideLogo';

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

export function AppLayout(props: AppLayoutProps) {
  return (
    <SidebarProvider className="app-sidebar-provider">
      <AppLayoutContent {...props} />
    </SidebarProvider>
  );
}

function AppLayoutContent({
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
  const { isMobile, state: sidebarState } = useSidebar();
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current,
      dock = navRef.current;
    if (!root || !dock) return;
    // Measure the actual overlay, including safe area and enlarged text, rather than
    // assuming a fixed pill height. CSS supplies the matching pre-hydration inset.
    const desktop = window.matchMedia('(min-width: 768px)');
    const update = () =>
      root.style.setProperty(
        '--nav-occlusion',
        desktop.matches
          ? '0px'
          : `${Math.ceil(dock.getBoundingClientRect().height)}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(dock);
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
      const visibleBottom = viewport.bottom - 8;
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
    <div
      ref={rootRef}
      className="app-shell running-journal stride-redesign athletic-shell"
      data-view={view}
      data-sidebar={sidebarState}
    >
      <a className="skip-link athletic-skip-link" href="#main-content">
        Skip to your training
      </a>
      <Tabs
        value={isAppView(view) ? view : 'today'}
        onValueChange={(value) => {
          if (isAppView(value)) onViewChange(value);
        }}
        orientation={isMobile ? 'horizontal' : 'vertical'}
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
        <FloatingNavigation overlayRef={navRef} disabled={navigationDisabled} />
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
  );
}
