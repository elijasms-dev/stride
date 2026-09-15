'use client';
import { AppProvider, useAppContext } from './app/app-context';
import { AppNotices } from './app/app-notices';
import { AppOverlays } from './app/app-overlays';
import { AppStatus } from './app/app-status';
import { LoadingRoute } from './app/loading-route';
import { PlanRoute } from './app/plan-route';
import { ProgressRoute } from './app/progress-route';
import { SettingsRoute } from './app/settings-route';
import { TodayRoute } from './app/today-route';
import { useStrideApp } from './app/use-stride-app';
import { AppLayout } from './AppLayout';
import Login from './login';
import { initials } from './profile';

function AppShell() {
  const {
    sessionInvalid,
    hasLoaded,
    view,
    setView,
    mainScrollRef,
    account,
    plan,
    openModal,
  } = useAppContext();
  if (sessionInvalid) return <Login mode="expired" />;
  if (!hasLoaded) return <LoadingRoute />;
  return (
    <AppLayout
      view={view}
      onViewChange={setView}
      scrollRef={mainScrollRef}
      profileInitials={initials(
        account.profile?.display_name || plan.profile.name,
      )}
      onProfile={() => openModal('profile')}
      status={<AppStatus />}
      overlays={<AppOverlays />}
    >
      <AppNotices />
      <TodayRoute />
      <PlanRoute />
      <ProgressRoute />
      <SettingsRoute />
    </AppLayout>
  );
}
export default function StrideApp() {
  const app = useStrideApp();
  return (
    <AppProvider value={app}>
      <AppShell />
    </AppProvider>
  );
}
