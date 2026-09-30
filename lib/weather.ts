/** Open-Meteo current conditions, WMO codes and units: https://open-meteo.com/en/docs */
export type WeatherLocation = { latitude: number; longitude: number };
export type WeatherPlace = WeatherLocation & { id: number; label: string };
export type CurrentWeather = {
  temperatureC: number;
  feelsLikeC: number;
  windKmh: number;
  code: number;
  isDay: boolean;
  observedAt: number;
};

const conditions: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  97: 'Heavy thunderstorm',
  99: 'Thunderstorm with heavy hail',
};

export function weatherCondition(code: number) {
  return conditions[code] ?? 'Conditions unavailable';
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Weather information is unavailable. Try again shortly.');
  return value as Record<string, unknown>;
}

function numeric(value: unknown, min: number, max: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error('Weather information is unavailable. Try again shortly.');
  return value;
}

/** Discard precise coordinates before they leave the browser or enter a provider URL. */
export function approximateWeatherLocation(
  value: WeatherLocation,
): WeatherLocation {
  return {
    latitude: Math.round(numeric(value.latitude, -90, 90) * 10) / 10,
    longitude: Math.round(numeric(value.longitude, -180, 180) * 10) / 10,
  };
}

export function parseCurrentWeather(
  value: unknown,
  now = Date.now(),
): CurrentWeather {
  const payload = object(value),
    current = object(payload.current),
    units = object(payload.current_units);
  if (
    units.temperature_2m !== '°C' ||
    units.apparent_temperature !== '°C' ||
    units.wind_speed_10m !== 'km/h' ||
    units.time !== 'unixtime'
  )
    throw new Error(
      'Weather information has unexpected units. Try again shortly.',
    );
  const code = numeric(current.weather_code, 0, 99);
  if (
    !Number.isInteger(code) ||
    !conditions[code] ||
    ![0, 1].includes(Number(current.is_day)) ||
    typeof current.is_day !== 'number'
  )
    throw new Error('Weather conditions are unavailable. Try again shortly.');
  const observedAt =
    numeric(
      current.time,
      (now - 2 * 60 * 60_000) / 1000,
      (now + 30 * 60_000) / 1000,
    ) * 1000;
  return {
    temperatureC: numeric(current.temperature_2m, -100, 70),
    feelsLikeC: numeric(current.apparent_temperature, -120, 100),
    windKmh: numeric(current.wind_speed_10m, 0, 500),
    code,
    isDay: current.is_day === 1,
    observedAt,
  };
}

export function parseWeatherPlaces(value: unknown): WeatherPlace[] {
  const payload = object(value);
  if (payload.results === undefined && payload.error !== true) return [];
  if (!Array.isArray(payload.results))
    throw new Error('Place search is unavailable. Try again shortly.');
  return payload.results.slice(0, 5).flatMap((value) => {
    try {
      const place = object(value);
      if (
        !Number.isSafeInteger(place.id) ||
        typeof place.name !== 'string' ||
        !place.name.trim()
      )
        return [];
      const region = [place.name, place.admin1, place.country].filter(
        (s): s is string => typeof s === 'string' && !!s.trim(),
      );
      return [
        {
          id: place.id as number,
          label: [...new Set(region)].join(', ').slice(0, 180),
          ...approximateWeatherLocation({
            latitude: place.latitude as number,
            longitude: place.longitude as number,
          }),
        },
      ];
    } catch {
      return [];
    }
  });
}

export function weatherNeedsRefresh(weather: CurrentWeather, now = Date.now()) {
  return (
    !Number.isFinite(weather.observedAt) ||
    !Number.isFinite(now) ||
    now - weather.observedAt > 60 * 60_000 ||
    weather.observedAt > now + 30 * 60_000
  );
}
