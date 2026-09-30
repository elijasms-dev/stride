# Annotated UI corrections — 29 September 2026

## Implemented

| Annotation                        | Result                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1: Disclosure/menu text alignment | Removed inherited top padding from bordered disclosures; balanced summary padding and vertical alignment. Inset expanded preparation metrics to the same text edge.                        |
| 2: Training update popup          | Replaced the portal/popover with a full-width inline disclosure. Opening it moves the page content down. Escape closes it and restores focus. A single update does not repeat its heading. |
| 3: Progress graph first           | Progress starts with an outlined weekly plan chart and a separately identified recorded series. Exact values, phase and long run are available through the week selector.                  |
| 4: All-time totals                | Compact runs/distance/time bar below the chart, covering all records retained in the journal. Missing distances remain unknown; partial totals are labelled.                               |
| 5: Revision rows                  | Dedicated full-width controls with equal padding, wrapping labels and trailing chevrons. Removed conflicting shared detail/settings-row styling.                                           |
| 6: Centered days                  | Seven-day rail centers when it fits. On narrow screens it scrolls, retaining the selected day after resize.                                                                                |
| 7: Week labels                    | Primary control shows the actual programme week and date range. Navigation preserves the weekday; historical dates and arbitrary date entry remain available.                              |
| 8: Menu bar                       | One horizontal desktop navigation bar, with the existing mobile dock. Keyboard tab orientation matches the visual layout.                                                                  |
| Weather                           | Compact header control; explicit location action, city fallback, approximate coordinates, current-condition labels, cancellation and error states.                                         |

Training prescriptions, plan generation, saved schedule and recorded runs were not changed by this UI work.

## Automated verification

- Full `npm test`: **3,310 passed, 0 failed**.
- Final focused UI/data/weather rerun after visual fixes: **62 passed, 0 failed**.
- TypeScript check, application lint (`npm run lint:app`), production build and whitespace check: passed.
- Repository-wide `npm run lint` is not clean: it also checks legacy test/script files and reports diagnostics outside the application check. No claim of a clean repository-wide lint run is made.
- Date tests cover week/year boundaries, keeping the selected weekday, out-of-plan history and unavailable adjacent weeks.
- Chart tests cover actual run dates, preserved historical records, skipped sessions, race-day inclusion, missing versus zero and unavailable estimates. A React server-rendered SVG title issue found during verification was fixed.
- Weather tests use fixtures for validation, coordinate rounding, provider errors, stale readings and cancellation.

## Browser verification

Reviewed the live local app at 1171px desktop, 656px, 390px and 320px widths, with light/dark themes and keyboard operation. At 320px with 200% root text size, chart detail overflow was found and fixed; the Progress and Today main regions then had no horizontal overflow. Temporary text-size styling was removed. Original appearance/motion preferences and the normal viewport were restored.

Verified notification expansion is in normal document flow with no dialog; Escape restores the trigger. Checked the marked preparation summary at 656px (zero outer padding and equal 16px inner padding), Settings revision rows, centered desktop dates, week selection and the new menu.

A live city search for the public example London returned disambiguated results and current weather. The test selection was cleared. No real device location or browser location permission was requested during verification. Permission-denied/unavailable handling is implemented, but was not exercised by changing the user's browser permissions.

Screenshots: [Today desktop](today-desktop.png), [Progress desktop](progress-desktop.png), [Progress light](progress-light-656.png), [inline notification](notification-inline-656.png), [preparation disclosure](plan-disclosure-656.png), [revision rows](settings-desktop.png), [weather test](weather-desktop.png).

## Deployment

Weather works on localhost without a key. A published installation requires the server-only `OPEN_METEO_API_KEY`; without it the widget gives an unavailable message. See [weather integration](../../weather-integration.md) for provider setup and official documentation. No push or deployment was performed in this task.
