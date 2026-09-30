'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ChevronDown,
  CloudSun,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  LocateFixed,
  Moon,
  RefreshCw,
  Search,
  Sun,
  X,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  approximateWeatherLocation,
  weatherCondition,
  weatherNeedsRefresh,
  type CurrentWeather,
  type WeatherLocation,
  type WeatherPlace,
} from '@/lib/weather';
import {
  runningWeatherAdvice,
  weatherForSelectedDay,
} from '@/lib/weather-running';

function ConditionIcon({ weather }: { weather: CurrentWeather | null }) {
  const code = weather?.code;
  const Icon =
    code === undefined
      ? CloudSun
      : code >= 95
        ? CloudLightning
        : [71, 73, 75, 77, 85, 86].includes(code)
          ? CloudSnow
          : code >= 51
            ? CloudRain
            : code >= 45
              ? CloudFog
              : code >= 2
                ? Cloud
                : weather?.isDay
                  ? Sun
                  : Moon;
  return <Icon size={18} aria-hidden="true" />;
}

function requestError(error: unknown) {
  if (error instanceof TypeError)
    return 'Weather could not connect. Check your connection and try again.';
  if (error instanceof Error && error.name === 'AbortError')
    return 'Weather took too long to load. Try again.';
  return error instanceof Error && !(error instanceof SyntaxError)
    ? error.message
    : 'Weather is temporarily unavailable. Try again shortly.';
}

/** Location is requested only on a deliberate click and kept only in component memory. */
function useWeatherState() {
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [label, setLabel] = useState('Your area');
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<WeatherPlace[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState<'location' | 'weather' | 'search' | null>(
    null,
  );
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const location = useRef<WeatherLocation | null>(null);
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const stale = !!current && weatherNeedsRefresh(current, now);
  const cancelPending = useCallback(() => {
    generation.current++;
    pending.current?.abort();
  }, []);

  useEffect(() => cancelPending, [cancelPending]);
  useEffect(() => {
    if (!current) return;
    const checkFreshness = () => setNow(Date.now());
    const timer = window.setInterval(checkFreshness, 60_000);
    window.addEventListener('focus', checkFreshness);
    document.addEventListener('visibilitychange', checkFreshness);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkFreshness);
      document.removeEventListener('visibilitychange', checkFreshness);
    };
  }, [current]);

  async function request(input: Record<string, unknown>) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
        cache: 'no-store',
      });
      const payload = (await response.json()) as {
        error?: unknown;
        current?: CurrentWeather;
        places?: WeatherPlace[];
      };
      if (!response.ok)
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : 'Weather is temporarily unavailable. Try again shortly.',
        );
      return payload as { current?: CurrentWeather; places?: WeatherPlace[] };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function loadWeather(
    area: WeatherLocation,
    areaLabel: string,
    token = ++generation.current,
  ) {
    setBusy('weather');
    setError('');
    try {
      const rounded = approximateWeatherLocation(area);
      const response = await request({ kind: 'current', ...rounded });
      if (generation.current !== token) return;
      if (!response.current)
        throw new Error(
          'Weather is temporarily unavailable. Try again shortly.',
        );
      location.current = rounded;
      setCurrent(response.current);
      setLabel(areaLabel);
      setNow(Date.now());
      setPlaces([]);
      setSearched(false);
    } catch (e) {
      if (generation.current === token) setError(requestError(e));
    } finally {
      if (generation.current === token) setBusy(null);
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setError(
        'Location is not available in this browser. Search for a city instead.',
      );
      return;
    }
    const token = ++generation.current;
    pending.current?.abort();
    setBusy('location');
    setError('');
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (generation.current !== token) return;
          void loadWeather(position.coords, 'Your area', token);
        },
        (failure) => {
          if (generation.current !== token) return;
          setBusy(null);
          setError(
            failure.code === 1
              ? 'Location access is off. Search for a city, or allow location in your browser settings.'
              : 'Your location could not be found. Search for a city instead.',
          );
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60_000 },
      );
    } catch {
      setBusy(null);
      setError(
        'Location is not available in this browser. Search for a city instead.',
      );
    }
  }

  async function search(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setError('Enter at least two letters to search for a city.');
      return;
    }
    const token = ++generation.current;
    setBusy('search');
    setError('');
    setPlaces([]);
    setSearched(false);
    try {
      const response = await request({ kind: 'search', name: query.trim() });
      if (generation.current === token) {
        setPlaces(response.places ?? []);
        setSearched(true);
      }
    } catch (e) {
      if (generation.current === token) setError(requestError(e));
    } finally {
      if (generation.current === token) setBusy(null);
    }
  }

  function clearWeather() {
    generation.current++;
    pending.current?.abort();
    location.current = null;
    setCurrent(null);
    setLabel('Your area');
    setError('');
    setBusy(null);
    setPlaces([]);
    setQuery('');
    setSearched(false);
  }

  return {
    current,
    label,
    query,
    setQuery,
    places,
    searched,
    busy,
    error,
    now,
    stale,
    locate,
    search,
    clearWeather,
    selectPlace: (place: WeatherPlace) => void loadWeather(place, place.label),
    refresh: () =>
      location.current && void loadWeather(location.current, label),
  };
}

const WeatherContext = createContext<ReturnType<typeof useWeatherState> | null>(
  null,
);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const state = useWeatherState();
  return (
    <WeatherContext.Provider value={state}>{children}</WeatherContext.Provider>
  );
}

function useWeather() {
  const state = useContext(WeatherContext);
  if (!state) throw new Error('WeatherProvider is missing.');
  return state;
}

/** A quiet current-conditions note. Setup and stale readings belong in Settings. */
export function WeatherWidget({
  selectedDate,
  today,
}: {
  selectedDate: string;
  today: string;
}) {
  const { current, label, now, busy, error, refresh } = useWeather();
  const weather = weatherForSelectedDay(current, selectedDate, today, now);
  if (!weather) return null;
  const advice = runningWeatherAdvice(weather);
  return (
    <aside
      className="stride-run-weather"
      aria-label="Current weather near your run"
    >
      <div className="stride-run-weather-summary">
        <ConditionIcon weather={weather} />
        <strong>{Math.round(weather.temperatureC)}°C</strong>
        <span>{weatherCondition(weather.code)}</span>
        <span className="stride-run-weather-now">
          Now in {label.toLowerCase() === 'your area' ? 'your area' : label}
        </span>
      </div>
      <details className="stride-run-weather-details">
        <summary>
          Running in these conditions
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="stride-run-weather-body">
          <p>
            Feels like {Math.round(weather.feelsLikeC)}°C. Wind{' '}
            {Math.round(weather.windKmh)} km/h.
          </p>
          {advice.length > 0 && (
            <ul>
              {advice.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <p>
                    {item.text}{' '}
                    <a
                      href={item.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.source.label}
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="stride-weather-time">
            Current model estimate for your approximate area, updated{' '}
            {new Date(weather.observedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            . Check local forecasts and warnings before running. This is not a
            forecast for your workout time.
          </p>
          <div className="stride-weather-result-actions">
            <button type="button" disabled={!!busy} onClick={refresh}>
              <RefreshCw size={15} aria-hidden="true" />
              Refresh weather
            </button>
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open-Meteo
            </a>
          </div>
          <output className="stride-weather-status">
            {busy === 'weather' ? 'Refreshing weather…' : error}
          </output>
        </div>
      </details>
    </aside>
  );
}

export function WeatherSettings() {
  const [open, setOpen] = useState(false);
  const fieldId = useId();
  const {
    current,
    label,
    query,
    setQuery,
    places,
    searched,
    busy,
    error,
    stale,
    locate,
    search,
    clearWeather,
    refresh,
    selectPlace,
  } = useWeather();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="stride-weather-setup-trigger"
        aria-label="Weather settings"
      >
        <CloudSun size={18} aria-hidden="true" />
        <span>Local weather</span>
        <span className="stride-weather-setup-state">
          {current && !stale ? label : current ? 'Refresh needed' : 'Optional'}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="stride-weather-panel"
        align="end"
        sideOffset={10}
      >
        <div className="stride-weather-heading">
          <PopoverTitle>Weather now</PopoverTitle>
          <button
            type="button"
            className="stride-weather-close"
            aria-label="Close weather"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        {current && !stale && (
          <section
            className="stride-weather-result"
            aria-label={`Weather for ${label}`}
          >
            <p className="stride-weather-area">{label}</p>
            <div className="stride-weather-reading">
              <ConditionIcon weather={current} />
              <strong>{Math.round(current.temperatureC)}°C</strong>
              <span>{weatherCondition(current.code)}</span>
            </div>
            <p>
              Feels like {Math.round(current.feelsLikeC)}°C · Wind{' '}
              {Math.round(current.windKmh)} km/h
            </p>
            <p className="stride-weather-time">
              {stale ? 'Earlier estimate' : 'Model estimate'} ·{' '}
              {new Date(current.observedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
              . Current conditions, independent of your selected training date.
            </p>
            <div className="stride-weather-result-actions">
              <button type="button" disabled={!!busy} onClick={refresh}>
                <RefreshCw size={15} aria-hidden="true" />
                Refresh
              </button>
              <button type="button" onClick={clearWeather}>
                Clear location
              </button>
            </div>
          </section>
        )}
        {current && stale && (
          <div className="stride-weather-stale">
            <p>
              Refresh weather to show current conditions beside today’s workout.
            </p>
            <div className="stride-weather-result-actions">
              <button type="button" onClick={refresh} disabled={!!busy}>
                Refresh weather
              </button>
              <button type="button" onClick={clearWeather}>
                Clear location
              </button>
            </div>
          </div>
        )}
        <p className="stride-weather-privacy">
          Use your approximate area, or choose a city. We send that area or city
          search to Open-Meteo for weather. It stays only in this open journal,
          not in your profile.
        </p>
        <button
          type="button"
          className="stride-weather-locate"
          disabled={!!busy}
          onClick={locate}
        >
          <LocateFixed size={16} aria-hidden="true" />
          Use my location
        </button>
        <form className="stride-weather-search" onSubmit={search}>
          <label htmlFor={fieldId}>Or search a city</label>
          <div>
            <input
              id={fieldId}
              type="search"
              placeholder="City, country"
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" disabled={!!busy} aria-label="Search cities">
              <Search size={18} aria-hidden="true" />
            </button>
          </div>
        </form>
        <output className="stride-weather-status">
          {busy === 'location'
            ? 'Finding your area…'
            : busy === 'search'
              ? 'Searching cities…'
              : busy === 'weather'
                ? 'Loading weather…'
                : error ||
                  (searched && !places.length
                    ? 'No cities found. Add a country to your search.'
                    : '')}
        </output>
        {places.length > 0 && (
          <ul className="stride-weather-places">
            {places.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => selectPlace(place)}
                >
                  {place.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="stride-weather-credit">
          Weather by{' '}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open-Meteo
          </a>{' '}
          · Places by{' '}
          <a
            href="https://www.geonames.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            GeoNames
          </a>
        </p>
      </PopoverContent>
    </Popover>
  );
}
