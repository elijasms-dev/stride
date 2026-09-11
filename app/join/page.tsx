import Login from '@/components/login';
import { headers } from 'next/headers';
export const dynamic = 'force-dynamic';
export default async function JoinPage() {
  const requestHeaders = await headers();
  return (
    <Login
      mode="join"
      signedIn={Boolean(requestHeaders.get('oai-authenticated-user-id'))}
      email={requestHeaders.get('oai-authenticated-user-email')}
      returnTo="/?setup=1"
    />
  );
}
