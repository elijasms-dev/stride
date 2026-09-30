# Source-based pacing and training-journal UI verification

28 September 2026

## Result

Implemented the shared source-aware resolver, saved segment provenance, independent pace overrides, protected pace-change review, source-consistent exports, and drawn session/progression graphics. Existing navigation, fonts and workout colours are retained.

## Automated checks

| Check | Result |
| --- | --- |
| Full repository test suite | 3,286 passed, 0 failed |
| Focused presentation/export tests after the final layout fixes | 60 passed, 0 failed |
| TypeScript | Passed |
| Application lint | Passed |
| Production build | Passed |
| Diff whitespace | Passed |

Coverage includes mile/1500m versus 5K repetition instructions; half/marathon event goals; progressive and conversational effort; slow, intermediate and faster matching benchmarks; missing, unconfirmed and unsuitable evidence; manual overrides and reset; stale goals after an event change; beginner and explicit-zero preferences; fixed-distance and timed endpoints; JSON reload and recovery; matching app, print, calendar, Intervals text and decoded Garmin FIT instructions.

Pace-review checks preserve completed, past, delivered and next-seven-day workouts, all scheduled dates, session types, repetitions, work and recovery endpoints. Faster fixed-distance repeats retain their original session-count eligibility only when the entire original prescription is intact; load calculations use their new estimated duration. Changed or missing repetitions and forged provenance remain invalid.

## Browser review

- Desktop at 1280 × 900 and mobile at 390 × 844; the pace panel was also inspected at the original 300 px width.
- Light and device-driven dark themes; motion disabled for testing, then restored.
- Keyboard selection of workout segments and chart weeks, with visible focus and updated instructions.
- Actual source evidence preview: a confirmed 4:00 marathon result supplies 5:41/km to current marathon pace while easy and threshold remain effort-guided. This was a temporary, unsaved test input.
- Individual override/reset; an incompatible slower target reports the existing time-limit conflict. A fitting target previews all 100 affected future workouts, their dates, previous/proposed targets and estimated-duration differences. Expand-all worked. No test changes were saved to the runner’s plan.
- Selected plan week exposes phase, planned training and planned long run together. Recorded totals and missing-distance cases are covered by rendering tests; the existing browser journal was not populated with fabricated activities.
- 200% root text size at 390 px exposed and helped fix metric collisions in workout details. Updated metric rows stayed within their container. The temporary text-size stylesheet was removed.
- Fixed Today’s unequal metric-column collision and checked the corrected values fit their columns on desktop and stack on mobile.

Screenshots: [desktop sequence](session-desktop.png), [mobile sequence](session-mobile.png).

## Scope and migration notes

The resolver does not claim an unverified V.O2 calculation or invent a conversion when a matching reference is missing. Historical fitness calculations remain available for planning estimates and historical compatibility, but no longer automatically prescribe a universal pace table. Saved history is not reinterpreted on load.

Newly generated benchmark-based plans can differ from earlier plans because automatic global pace zones previously influenced executable duration and allocation. The old regression fixtures remain unchanged; 100 explicit successor cases record these differences separately and check schedule, frequency, arithmetic and provenance. One previously accepted capacity scenario now refuses to invent faster targets to make the input fit.

Source IDs identify pace instructions, not an assertion that every existing adaptive Stride schedule exactly reproduces an external programme. Beginner transitions require review; faster benchmarks and elapsed weeks do not introduce speedwork. This implementation does not add an automatic transition to a new quality programme.

Browser and decoded-export checks are not physical-watch, VoiceOver/TalkBack or outdoor validation. Changes are local; no push or deployment was performed.
