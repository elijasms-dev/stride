# Local weather

The optional weather setting retrieves current modelled weather after the runner explicitly chooses their location or a city. Opening the widget does not request permission or send a location. A denied/unavailable browser location leaves city search available.

The browser rounds latitude and longitude to one decimal place before sending them in a same-origin POST body. The server rounds again before its Open-Meteo request. Coordinates are held only in component memory; a page reload or Clear location removes them. They are not put in the account, plan, browser storage, request URL or application logs. Open-Meteo receives the approximate area (or city search) and the server request. The provider may retain request data under its own [privacy terms](https://open-meteo.com/en/terms).

The authenticated server route limits requests, applies an eight-second provider timeout, validates units/values/timestamps and caches area forecasts for ten minutes in a bounded process cache. The client cancels replaced requests and ignores late callbacks. Readings older than an hour disappear from Today; Settings offers an explicit refresh. Freshness is checked on window focus, visibility changes and once a minute while a reading exists. There is no continuous GPS monitoring or automatic background weather polling. Current weather never changes training prescriptions. A compact temperature and condition note appears beneath the selected workout only when its date is today. Selecting a past or future workout hides the note. The note explicitly says Now and expands to explain the estimate, source-backed condition cues and update time. A quiet or empty weather response never means the run has been declared safe.

## Provider setup

For local evaluation the route uses the public Open-Meteo API without a key. For a deployed app, configure the server-only `OPEN_METEO_API_KEY` secret from a licensed Open-Meteo subscription. The route then uses `customer-api.open-meteo.com` and `customer-geocoding-api.open-meteo.com`. A deployed installation without the secret returns a friendly unavailable state instead of silently using the non-commercial service. No key enters the browser bundle.

Open-Meteo's [terms](https://open-meteo.com/en/terms) restrict the free endpoint to non-commercial use; commercial products, subscriptions and advertising require a suitable paid subscription. Confirm the deployment's licence and quota before publishing. The widget credits Open-Meteo and GeoNames.

## Contract references

- [Forecast API](https://open-meteo.com/en/docs): current variables, explicit Celsius/km/h units, Unix timestamps and WMO condition codes. Current conditions are model estimates, not a local sensor reading.
- [Geocoding API](https://open-meteo.com/en/docs/geocoding-api): city names, region/country disambiguation, returned coordinates and GeoNames attribution.

The page's `Permissions-Policy` must permit `geolocation=(self)`; the browser still requests the runner's permission. Production also requires HTTPS. The API is same-origin, so no external browser `connect-src` exception is needed.

## Verification

`node --experimental-strip-types --test tests/weather.test.mjs` covers rounding, invalid locations, missing/invalid readings, zero/negative temperatures, units, stale/future timestamps, city disambiguation, provider failures and request cancellation. Tests use fixtures and never request the user's real location.

## Running guidance sources and limits

Condition guidance is a presentation aid, not a medical risk calculation or a modification of the training plan. No pace formulas or heat-acclimation recommendations are introduced. Current weather is an approximate model estimate; this feature does not retrieve official alerts or predict conditions at the planned start time.

- [England Athletics session guidance](https://www.englandathletics.org/news/running-sessions-in-hot-weather-guidance-for-athletes-and-clubs/) explicitly addresses very physical activity at air temperatures of 30°C or higher. The stronger heat cue suggests a cooler time or indoor session, and shorter outdoor activity with shade breaks and water.
- [England Athletics event guidance](https://www.englandathletics.org/news/recommendations-for-running-events-in-hot-weather/) calls for further event precautions above 25°C real-feel. Using that value to display a softer warm-weather reminder for an individual is Stride's conservative presentation choice; it is not a published personalized risk threshold. Open-Meteo apparent temperature is displayed as feels-like and is not presented as WBGT or the NWS heat index.
- [CDC cold-weather advice](https://wwwnc.cdc.gov/travel/page/travel-to-cold-climates) notes that wet-related chilling can happen around 50°F (10°C), and advises adjustable layers and attention to persistent shivering. The cold cue appears at or below this temperature, or for freezing/snow codes; warmer weather is not guaranteed safe.
- The [NWS Beaufort scale](https://www.weather.gov/mfl/beaufort) puts the start of a strong breeze at 25 mph. Stride converts that boundary to km/h and shows [NWS wind precautions](https://www.weather.gov/safety/wind-during), rather than inventing a pace adjustment. This is not a local wind warning threshold.
- Rain codes bring up [NWS flood-route guidance](https://www.weather.gov/safety/flood-during). Thunderstorm codes prioritize [NWS lightning guidance](https://www.weather.gov/rnk/outdoorslightning), including moving indoors and avoiding isolated trees.

Each displayed advisory links to its source. These categories only select relevant guidance; missing guidance must not be read as clearance to run.
