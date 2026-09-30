import { weatherNeedsRefresh, type CurrentWeather } from './weather.ts';

export type WeatherAdvice = {
  id: 'storm' | 'heat' | 'cold' | 'rain' | 'wind';
  title: string;
  text: string;
  source: { label: string; url: string };
};

const source = {
  warm: {
    label: 'England Athletics',
    url: 'https://www.englandathletics.org/news/recommendations-for-running-events-in-hot-weather/',
  },
  heat: {
    label: 'England Athletics',
    url: 'https://www.englandathletics.org/news/running-sessions-in-hot-weather-guidance-for-athletes-and-clubs/',
  },
  cold: {
    label: 'CDC',
    url: 'https://wwwnc.cdc.gov/travel/page/travel-to-cold-climates',
  },
  rain: {
    label: 'National Weather Service',
    url: 'https://www.weather.gov/safety/flood-during',
  },
  wind: {
    label: 'National Weather Service',
    url: 'https://www.weather.gov/safety/wind-during',
  },
  storm: {
    label: 'National Weather Service',
    url: 'https://www.weather.gov/rnk/outdoorslightning',
  },
};

/** Current model weather is never a forecast for a selected training date. */
export function weatherForSelectedDay(
  weather: CurrentWeather | null,
  selectedDate: string,
  today: string,
  now: number,
) {
  if (
    !weather ||
    selectedDate !== today ||
    !/^\d{4}-\d{2}-\d{2}$/.test(today) ||
    !Number.isFinite(now) ||
    weatherNeedsRefresh(weather, now)
  )
    return null;
  return weather;
}

/** Display cues only. These source-based weather categories are not personal safety cutoffs. */
export function runningWeatherAdvice(weather: CurrentWeather): WeatherAdvice[] {
  const advice: WeatherAdvice[] = [];
  if ([95, 96, 97, 99].includes(weather.code))
    advice.push({
      id: 'storm',
      title: 'Thunderstorms nearby',
      text: 'Move the run indoors or wait. If you hear thunder, get into a substantial building or an enclosed vehicle; an isolated tree is not shelter.',
      source: source.storm,
    });
  // England Athletics identifies 30°C+ as too hot for very physical activities.
  // 25°C real-feel is its published hot-weather event review point; the softer
  // cue is our display interpretation, not a claim that lower temperatures are safe.
  if (weather.temperatureC >= 30)
    advice.push({
      id: 'heat',
      title: 'Hot conditions',
      text: 'Choose a cooler time or an indoor session. If you exercise outside, shorten the session, take more shade breaks and keep water available.',
      source: source.heat,
    });
  else if (weather.feelsLikeC > 25)
    advice.push({
      id: 'heat',
      title: 'Warm conditions',
      text: 'Keep water available and use shade between efforts. Check local heat warnings before heading out; consider a shorter session or a cooler time.',
      source: source.warm,
    });
  // NWS Beaufort force 6 starts at 25 mph. Convert that published threshold exactly.
  if (weather.windKmh >= 25 * 1.609344)
    advice.push({
      id: 'wind',
      title: 'Strong wind',
      text: 'Check local wind warnings before running. Avoid exposed routes, trees and power lines; move indoors if there is a high-wind warning.',
      source: source.wind,
    });
  // CDC describes cold-related risk even around 50°F when wet. This cue applies
  // there and below; it is not a risk score and does not assert safety above 10°C.
  if (
    weather.temperatureC <= ((50 - 32) * 5) / 9 ||
    [48, 56, 57, 66, 67, 71, 73, 75, 77, 85, 86].includes(weather.code)
  )
    advice.push({
      id: 'cold',
      title: 'Keep warm and dry',
      text: 'Use adjustable layers and protect exposed skin. Wet clothing can chill you quickly; if you keep shivering, stop and get warm indoors.',
      source: source.cold,
    });
  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weather.code)
  )
    advice.push({
      id: 'rain',
      title: 'Wet routes',
      text: 'Choose a route you can see clearly and keep out of floodwater. Turn back from flooded paths rather than trying to cross.',
      source: source.rain,
    });
  return advice;
}
