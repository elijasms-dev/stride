/** Do not promise cold offline access until the public shell has actually installed. */
export async function prepareOfflineShell(
  workers: Pick<ServiceWorkerContainer, 'register' | 'ready'> | undefined,
  timeoutMs = 15000,
) {
  if (!workers)
    throw new Error(
      'This browser cannot reopen Stride offline. You can still save run logs while this tab is open.',
    );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      workers.register('/sw.js').then(() => workers.ready),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'Offline files are not ready. Reconnect and try enabling offline access again.',
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
