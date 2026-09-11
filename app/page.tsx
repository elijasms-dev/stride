import StrideApp from '@/components/stride-app';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { safeReturnTo, type AccessSearchParams } from '@/lib/auth-navigation';
export const dynamic = 'force-dynamic';
export default async function Home({
  searchParams,
}: {
  searchParams: AccessSearchParams;
}) {
  const requestHeaders = await headers();
  if (!requestHeaders.get('oai-authenticated-user-id')) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries((await searchParams) ?? {}))
      if (typeof value === 'string') query.set(key, value);
    redirect(
      `/login?returnTo=${encodeURIComponent(safeReturnTo(`/?${query}`))}`,
    );
  }
  return <StrideApp />;
}
