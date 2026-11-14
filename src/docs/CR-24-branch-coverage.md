# CR-24: Branch Coverage Report

**Run date:** 2026-11-14
**Branch:** `chore/CR-31-final-evaluation-readiness`
**Revision under test:** CR-31 working tree after the Origin validation hardening
**Runtime:** Node.js v22.19.0; Vitest 5.0.3; V8 coverage provider 5.0.3

## Method

From `src/frontend`, run:

```powershell
npm ci
npm run test:branch-coverage
```

The command runs the frontend unit suite and writes V8/Istanbul branch counters to `coverage/frontend/coverage-final.json` (repository root). It includes the frontend `.jsx` source files, including the application entry point. Branch outcomes with a zero execution count were reviewed in the generated report.

## Results

| Measure | Covered | Total | Coverage |
| --- | ---: | ---: | ---: |
| Branch outcomes | 187 | 216 | 86.57% |
| Uncovered branch outcomes | 29 | 216 | 13.43% |

The run completed with **1 test file passed and 16 tests passed**. No tests were skipped. The percentage is generated from the same source and suite as CR-23.

## Uncovered branch areas

The zero-count outcomes in `src/frontend/src/App.jsx` cluster in these conditional paths:

- **API response handling (lines 7, 9):** HTTP 204 handling and the fallback message when an error response has no message.
- **Optional ride-card details (line 47):** displaying a driver rating and displaying notes when present.
- **Dashboard and ride management (lines 79, 81, 83, 86, 94–95):** error/toast rendering, empty or populated recent-request states, ride status/pending-request variants, offer submission errors, and the accepted-booking completion action after departure.
- **History and ratings (lines 98, 112–115, 125):** history rows with and without a saved rating, driver/passenger labels, booking-status and cancellation-control variants, and rating feedback states.
- **Messaging and profile (lines 128, 154):** no-conversation/no-selection states, message fallback/error paths, and profile-save errors.
- **Browser navigation (line 54):** popstate events with and without Campusride history state.

These are coverage gaps, not confirmed functional defects. Several require controlled API responses or test records for the relevant status. The current suite verifies the primary paths; adding focused tests for the listed conditional paths would raise branch coverage.

## Artifacts and reproduction

- Machine-readable branch counters: `coverage/frontend/coverage-final.json`.

Coverage outputs are ignored generated files and are not committed. The recorded counters came from a local run on this branch and should be regenerated after source or test changes.

## CR-31 verification note

On 14 November 2026, the locked `@vitest/coverage-v8` dependency was installed with `npm ci` and branch coverage was regenerated successfully on the CR-31 branch. The changed source adds Origin-validation branches, so the totals differ slightly from the earlier CR-24 report.
