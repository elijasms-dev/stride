import Login from '@/components/login';
import { headers } from 'next/headers';
import { safeReturnTo, type AccessSearchParams } from '@/lib/auth-navigation';
export const dynamic = 'force-dynamic';
export default async function LoginPage({
  searchParams,
}: {
  searchParams: AccessSearchParams;
}) {
  const requestHeaders = await headers();
  const query = await searchParams;
  return (
    <Login
      signedIn={Boolean(requestHeaders.get('oai-authenticated-user-id'))}
      email={requestHeaders.get('oai-authenticated-user-email')}
      returnTo={safeReturnTo(query?.returnTo)}
    />
  );
}
