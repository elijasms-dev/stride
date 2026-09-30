import {
  approximateWeatherLocation,
  parseCurrentWeather,
  parseWeatherPlaces,
  type WeatherLocation,
} from './weather.ts';

export type WeatherRequest =
  | { kind: 'current'; location: WeatherLocation }
  | { kind: 'search'; name: string };

export function parseWeatherRequest(
  value: Record<string, unknown>,
): WeatherRequest {
  if (value.kind === 'current') {
    return {
      kind: 'current',
      location: approximateWeatherLocation({
        latitude: value.latitude as number,
        longitude: value.longitude as number,
      }),
    };
  }
  if (
    value.kind === 'search' &&
    typeof value.name === 'string' &&
    value.name.trim().length >= 2 &&
    value.name.trim().length <= 100
  )
    return { kind: 'search', name: value.name.trim() };
  throw new Error(
    'Choose a location or enter a city with at least two letters.',
  );
}

export function weatherProviderUrl(request: WeatherRequest, apiKey?: string) {
  const prefix = apiKey ? 'customer-' : '';
  const url = new URL(
    request.kind === 'current'
      ? `https://${prefix}api.open-meteo.com/v1/forecast`
      : `https://${prefix}geocoding-api.open-meteo.com/v1/search`,
  );
  if (request.kind === 'current') {
    const location = approximateWeatherLocation(request.location);
    url.searchParams.set('latitude', String(location.latitude));
    url.searchParams.set('longitude', String(location.longitude));
    url.searchParams.set(
      'current',
      'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
    );
    url.searchParams.set('temperature_unit', 'celsius');
    url.searchParams.set('wind_speed_unit', 'kmh');
    url.searchParams.set('timeformat', 'unixtime');
    url.searchParams.set('forecast_days', '1');
  } else {
    url.searchParams.set('name', request.name);
    url.searchParams.set('count', '5');
    url.searchParams.set('language', 'en');
  }
  if (apiKey) url.searchParams.set('apikey', apiKey);
  return url;
}

export async function fetchWeatherProvider(
  request: WeatherRequest,
  apiKey?: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(weatherProviderUrl(request, apiKey), {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
      : AbortSignal.timeout(8000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok)
    throw new Error('Weather is temporarily unavailable. Try again shortly.');
  const payload: unknown = await response.json();
  return request.kind === 'current'
    ? { current: parseCurrentWeather(payload) }
    : { places: parseWeatherPlaces(payload) };
}
