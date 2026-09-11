/** Only known application views may be authentication destinations. */
export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.includes('\\') ||
    value.split('').some((c) => c.charCodeAt(0) <= 32)
  )
    return '/';
  try {
    const url = new URL(value, 'https://stride.invalid');
    if (url.origin !== 'https://stride.invalid' || url.pathname !== '/')
      return '/';
    const query = new URLSearchParams();
    const view = url.searchParams.get('view');
    if (view && ['today', 'plan', 'progress', 'settings'].includes(view))
      query.set('view', view);
    const day = url.searchParams.get('day');
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) query.set('day', day);
    const block = url.searchParams.get('block');
    if (block && /^[a-zA-Z0-9-]{1,80}$/.test(block)) query.set('block', block);
    if (url.searchParams.get('setup') === '1') query.set('setup', '1');
    return query.size ? `/?${query}` : '/';
  } catch {
    return '/';
  }
}
export function signInHref(returnTo: unknown) {
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(safeReturnTo(returnTo))}`;
}
export type AccessSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;
