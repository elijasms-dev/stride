import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approximateWeatherLocation,
  parseCurrentWeather,
  parseWeatherPlaces,
  weatherCondition,
  weatherNeedsRefresh,
} from '../lib/weather.ts';
import {
  fetchWeatherProvider,
  parseWeatherRequest,
  weatherProviderUrl,
} from '../lib/weather-provider.ts';
import {
  runningWeatherAdvice,
  weatherForSelectedDay,
} from '../lib/weather-running.ts';

const now = Date.parse('2026-09-29T12:00:00Z');
const sample = () => ({
  current_units: {
    temperature_2m: '°C',
    apparent_temperature: '°C',
    wind_speed_10m: 'km/h',
    time: 'unixtime',
  },
  current: {
    temperature_2m: 12.2,
    apparent_temperature: 10,
    wind_speed_10m: 15,
    weather_code: 2,
    is_day: 1,
    time: now / 1000,
  },
});

test('workout weather displays only current, fresh conditions on the current date', () => {
  const weather = parseCurrentWeather(sample(), now);
  const today = '2026-09-29';
  assert.equal(weatherForSelectedDay(weather, today, today, now), weather);
  for (const date of ['2026-09-28', '2026-09-30', '2026-10-10'])
    assert.equal(weatherForSelectedDay(weather, date, today, now), null);
  assert.equal(weatherForSelectedDay(null, today, today, now), null);
  assert.equal(
    weatherForSelectedDay(weather, today, today, now + 61 * 60_000),
    null,
  );
  assert.equal(
    weatherForSelectedDay({ ...weather, observedAt: NaN }, today, today, now),
    null,
  );
  assert.equal(weatherForSelectedDay(weather, today, today, NaN), null);
  assert.equal(weatherForSelectedDay(weather, '', '', now), null);
});

test('weather condition guidance preserves the source reading and never invents a safe-to-run status', () => {
  const weather = Object.freeze(parseCurrentWeather(sample(), now));
  assert.deepEqual(runningWeatherAdvice(weather), []);
  assert.equal(weather.temperatureC, 12.2);
});

test('heat advice distinguishes the published 30°C session guidance from the softer real-feel review cue', () => {
  const base = parseCurrentWeather(sample(), now);
  assert.deepEqual(
    runningWeatherAdvice({ ...base, temperatureC: 24, feelsLikeC: 25 }),
    [],
  );
  const warm = runningWeatherAdvice({
    ...base,
    temperatureC: 24,
    feelsLikeC: 26,
  });
  assert.equal(warm[0].title, 'Warm conditions');
  assert.match(warm[0].source.url, /recommendations-for-running-events/);
  const hot = runningWeatherAdvice({
    ...base,
    temperatureC: 30,
    feelsLikeC: 29,
  });
  assert.equal(hot[0].title, 'Hot conditions');
  assert.match(hot[0].source.url, /running-sessions/);
  assert.match(hot[0].text, /cooler time or an indoor session/);
});

test('strong-wind cue begins at the published Beaufort 6 lower boundary, converted from mph', () => {
  const base = parseCurrentWeather(sample(), now);
  assert.deepEqual(
    runningWeatherAdvice({ ...base, windKmh: 24.9 * 1.609344 }),
    [],
  );
  assert.equal(
    runningWeatherAdvice({ ...base, windKmh: 25 * 1.609344 })[0].id,
    'wind',
  );
});

test('cold and rain cues coexist without conflating rain with thunderstorms', () => {
  const base = parseCurrentWeather(sample(), now);
  const result = runningWeatherAdvice({ ...base, temperatureC: 10, code: 61 });
  assert.deepEqual(
    result.map((item) => item.id),
    ['cold', 'rain'],
  );
  assert.match(result[0].text, /layers/);
  assert.match(result[1].text, /floodwater/);
  assert.equal(
    runningWeatherAdvice({ ...base, temperatureC: 10.1 })[0],
    undefined,
  );
});

for (const code of [95, 96, 97, 99])
  test(`thunderstorm code ${code} puts shelter advice first, even with concurrent heat and wind`, () => {
    const base = parseCurrentWeather(sample(), now);
    const result = runningWeatherAdvice({
      ...base,
      code,
      temperatureC: 31,
      windKmh: 50,
    });
    assert.deepEqual(
      result.map((item) => item.id),
      ['storm', 'heat', 'wind'],
    );
    assert.match(result[0].text, /substantial building or an enclosed vehicle/);
    assert.equal(
      result[0].source.url,
      'https://www.weather.gov/rnk/outdoorslightning',
    );
  });

test('weather requests discard precise coordinates, including city result coordinates', () => {
  assert.deepEqual(
    approximateWeatherLocation({ latitude: 53.3498, longitude: -6.2603 }),
    { latitude: 53.3, longitude: -6.3 },
  );
  const request = parseWeatherRequest({
    kind: 'current',
    latitude: 53.3498,
    longitude: -6.2603,
  });
  const url = weatherProviderUrl(request);
  assert.equal(url.searchParams.get('latitude'), '53.3');
  assert.equal(url.searchParams.get('longitude'), '-6.3');
  assert.equal(url.hostname, 'api.open-meteo.com');
  assert.equal(url.searchParams.get('timeformat'), 'unixtime');
  assert.ok(!url.searchParams.has('hourly'));
});

for (const location of [
  { latitude: NaN, longitude: 0 },
  { latitude: 91, longitude: 0 },
  { latitude: 0, longitude: 181 },
  { latitude: '0', longitude: 0 },
  { latitude: null, longitude: 0 },
])
  test(`invalid coordinate input is rejected: ${JSON.stringify(location)}`, () => {
    assert.throws(() => approximateWeatherLocation(location));
  });

test('current weather accepts zero and negative temperatures without showing them as missing', () => {
  for (const temperature of [0, -15.5, 20]) {
    const input = sample();
    input.current.temperature_2m = temperature;
    const result = parseCurrentWeather(input, now);
    assert.equal(result.temperatureC, temperature);
    assert.equal(result.observedAt, now);
    assert.equal(weatherCondition(result.code), 'Partly cloudy');
  }
});

for (const field of [
  'temperature_2m',
  'apparent_temperature',
  'wind_speed_10m',
  'weather_code',
  'is_day',
  'time',
])
  test(`missing ${field} cannot appear as a valid weather reading`, () => {
    const input = sample();
    input.current[field] = null;
    assert.throws(() => parseCurrentWeather(input, now));
  });

test('wrong units, unknown codes and stale/future provider timestamps are rejected', () => {
  const wrongUnit = sample();
  wrongUnit.current_units.temperature_2m = '°F';
  assert.throws(() => parseCurrentWeather(wrongUnit, now));
  for (const time of [now / 1000 - 8000, now / 1000 + 3600]) {
    const input = sample();
    input.current.time = time;
    assert.throws(() => parseCurrentWeather(input, now));
  }
  for (const code of [4, 1.5, 999]) {
    const input = sample();
    input.current.weather_code = code;
    assert.throws(() => parseCurrentWeather(input, now));
  }
  assert.equal(weatherCondition(97), 'Heavy thunderstorm');
});

test('old readings are labelled as earlier weather until refreshed', () => {
  const value = parseCurrentWeather(sample(), now);
  assert.equal(weatherNeedsRefresh(value, now + 59 * 60_000), false);
  assert.equal(weatherNeedsRefresh(value, now + 61 * 60_000), true);
});

test('manual city lookup supports permission denial and does not choose a result automatically', () => {
  assert.deepEqual(
    parseWeatherPlaces({
      results: [
        {
          id: 1,
          name: 'Example',
          admin1: 'Example',
          country: 'Test',
          latitude: 53.3498,
          longitude: -6.2603,
        },
        { id: 2, name: 'Bad data', latitude: null, longitude: 0 },
      ],
    }),
    [{ id: 1, label: 'Example, Test', latitude: 53.3, longitude: -6.3 }],
  );
  assert.deepEqual(parseWeatherPlaces({}), []);
  assert.throws(() => parseWeatherPlaces({ error: true }));
  assert.throws(() => parseWeatherRequest({ kind: 'search', name: 'A' }));
  assert.throws(() =>
    parseWeatherRequest({ kind: 'search', name: 'a'.repeat(101) }),
  );
  const request = parseWeatherRequest({
    kind: 'search',
    name: '  Paris, France  ',
  });
  const url = weatherProviderUrl(request, 'test-key');
  assert.equal(url.hostname, 'customer-geocoding-api.open-meteo.com');
  assert.equal(url.searchParams.get('name'), 'Paris, France');
  assert.equal(url.searchParams.get('apikey'), 'test-key');
});

test('provider adapter uses a bounded signal and validates the complete response', async () => {
  const request = parseWeatherRequest({
    kind: 'current',
    latitude: 0,
    longitude: 0,
  });
  const input = sample();
  input.current.time = Math.floor(Date.now() / 1000);
  const result = await fetchWeatherProvider(
    request,
    undefined,
    undefined,
    async (url, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(new URL(url).hostname, 'api.open-meteo.com');
      return Response.json(input);
    },
  );
  assert.equal(result.current.temperatureC, 12.2);
  await assert.rejects(
    fetchWeatherProvider(request, undefined, undefined, async () =>
      Response.json({ reason: 'bad' }, { status: 429 }),
    ),
    /temporarily unavailable/,
  );
  await assert.rejects(
    fetchWeatherProvider(request, undefined, undefined, async () =>
      Response.json({ current: {} }),
    ),
    /unavailable/,
  );
});

test('aborted weather request remains abortable and never fabricates a result', async () => {
  const controller = new AbortController();
  controller.abort();
  const request = parseWeatherRequest({ kind: 'search', name: 'Paris' });
  await assert.rejects(
    fetchWeatherProvider(
      request,
      undefined,
      controller.signal,
      async (_, options) => {
        options.signal.throwIfAborted();
        return Response.json({});
      },
    ),
    { name: 'AbortError' },
  );
});
