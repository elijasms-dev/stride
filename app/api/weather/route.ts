import { env } from 'cloudflare:workers';
import {
  body,
  failure,
  guardWrite,
  HttpError,
  json,
  ownerId,
  requestLimit,
} from '@/lib/server';
import {
  fetchWeatherProvider,
  parseWeatherRequest,
} from '@/lib/weather-provider';

// A short, bounded process cache contains only area forecasts, never account IDs.
const forecasts = new Map<
  string,
  { expires: number; value: Awaited<ReturnType<typeof fetchWeatherProvider>> }
>();

export async function POST(request: Request) {
  try {
    guardWrite(request);
    const owner = ownerId(request);
    await requestLimit(owner, 'weather', 20);
    let input;
    try {
      input = parseWeatherRequest(await body(request, 1024));
    } catch {
      throw new HttpError(
        422,
        'Choose a location or enter a city with at least two letters.',
      );
    }
    const apiKey = (env as unknown as { OPEN_METEO_API_KEY?: string })
      .OPEN_METEO_API_KEY;
    // The free service is licensed only for non-commercial use. Keep paid keys on the server.
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(
      new URL(request.url).hostname,
    );
    if (!apiKey && !local)
      throw new HttpError(
        503,
        'Weather is not available here yet. Your training plan is still available.',
      );
    const key =
      input.kind === 'current'
        ? `${input.location.latitude},${input.location.longitude}`
        : null;
    const cached = key ? forecasts.get(key) : undefined;
    if (cached && cached.expires > Date.now()) return json(cached.value);
    let result;
    try {
      result = await fetchWeatherProvider(input, apiKey, request.signal);
    } catch {
      throw new HttpError(
        503,
        'Weather is temporarily unavailable. Try again shortly.',
      );
    }
    if (key) {
      for (const [id, entry] of forecasts)
        if (entry.expires <= Date.now()) forecasts.delete(id);
      if (forecasts.size >= 200)
        forecasts.delete(forecasts.keys().next().value!);
      forecasts.set(key, { expires: Date.now() + 10 * 60_000, value: result });
    }
    return json(result);
  } catch (error) {
    return failure(error);
  }
}
