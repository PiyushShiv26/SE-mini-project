# CR-23: Code Coverage Report

**Run date:** 2026-11-14
**Branch:** `chore/CR-31-final-evaluation-readiness`
**Revision under test:** CR-31 working tree after the Origin validation hardening
**Runtime:** Node.js v22.19.0; Vitest 5.0.3; V8 coverage provider 5.0.3

## Method

From `src/frontend`, run:

```powershell
npm ci
npm run test:coverage
```

Vitest runs the frontend tests and collects V8 coverage for `src/frontend/src/**/*.{js,jsx}`. The command prints a text summary and writes machine-readable JSON and HTML reports under the repository-root `coverage/frontend/` directory. The report includes all frontend source files, including entry points that are not imported by unit tests.

## Results

| Measure | Covered | Total | Coverage |
| --- | ---: | ---: | ---: |
| Statements | 216 | 263 | 82.12% |
| Branches | 187 | 216 | 86.57% |
| Functions | 87 | 123 | 70.73% |
| Lines | 88 | 94 | 93.61% |

The run completed with **1 test file passed and 16 tests passed**. No tests were skipped. The report includes the CR-31 frontend source currently under test.

## Interpretation

Coverage measures executed source locations; it does not establish that every behavior is correct. The entry point `src/frontend/src/main.jsx` is not exercised by the component-level test suite (0% statements/lines), while `App.jsx` has 83.07% statement, 86.69% branch, 71.90% function, and 94.62% line coverage. See CR-24's branch report for uncovered control-flow branches.

## Artifacts and reproduction

- Human-readable output: terminal summary from `npm run test:coverage`.
- Machine-readable summary: `coverage/frontend/coverage-summary.json`.
- Per-file HTML detail: `coverage/frontend/index.html`.

The JSON and HTML reports are generated artifacts and are not committed; rerun the command to regenerate them. The values above are from the run recorded on this branch and should be refreshed if the tested source or suite changes.

## CR-31 verification note

On 14 November 2026, the locked `@vitest/coverage-v8` dependency was installed with `npm ci` and this report was regenerated successfully on the CR-31 branch. Backend unit coverage was also collected with Node's built-in test coverage: 41.51% lines, 60.00% branches and 22.58% functions for `src/backend/src/app.js` across the six non-database unit tests. It is a focused unit-run measure, not whole-workflow backend coverage.
