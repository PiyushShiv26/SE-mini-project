# CR-23: Code Coverage Report

**Run date:** 2026-11-12  
**Branch:** `test/CR-23-code-coverage`  
**Revision under test:** working tree based on `main` at `d78f82c`  
**Runtime:** Node.js v22.19.0; Vitest 5.0.3; V8 coverage provider 5.0.3

## Method

From `src/frontend`, run:

```powershell
npm ci
npm run test:coverage
```

Vitest runs the frontend tests and collects V8 coverage for `src/frontend/src/**/*.{js,jsx}`. The command prints a text summary and writes machine-readable JSON and HTML reports under `src/frontend/coverage/frontend/`. The report includes all frontend source files, including entry points that are not imported by unit tests.

## Results

| Measure | Covered | Total | Coverage |
| --- | ---: | ---: | ---: |
| Statements | 216 | 261 | 82.75% |
| Branches | 189 | 218 | 86.69% |
| Functions | 87 | 121 | 71.90% |
| Lines | 88 | 94 | 93.61% |

The run completed with **1 test file passed and 16 tests passed**. No tests were skipped.

## Interpretation

Coverage measures executed source locations; it does not establish that every behavior is correct. The entry point `src/frontend/src/main.jsx` is not exercised by the component-level test suite (0% statements/lines), while `App.jsx` has 83.07% statement, 86.69% branch, 71.90% function, and 94.62% line coverage. See CR-24's branch report for uncovered control-flow branches.

## Artifacts and reproduction

- Human-readable output: terminal summary from `npm run test:coverage`.
- Machine-readable summary: `coverage/frontend/coverage-summary.json`.
- Per-file HTML detail: `coverage/frontend/index.html`.

The JSON and HTML reports are generated artifacts and are not committed; rerun the command to regenerate them. The values above are from the run recorded on this branch and should be refreshed if the tested source or suite changes.
