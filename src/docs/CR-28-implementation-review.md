# CR-28 Implementation Review

**Review date:** 13 November 2026  
**Implementation baseline:** `main` at `128e4e3` (`Merge pull request #26 from PiyushShiv26/test/CR-23-code-coverage`)  
**Requirements/design baseline:** SRS v1.2 and SAD v1.2, both dated 12 October 2026  
**Test plan baseline:** submitted STP v1.2, plus the proposed CR-27 update on branch `docs/CR-27-update-test-case-document` (commit `bb7c001`; not merged into `main` at review time)

## Review summary

The implementation covers the core account, ride, booking, dashboard, history, messaging, and rating workflows in the SRS. The backend enforces the main ownership and booking rules, uses PostgreSQL transactions and constraints for seat allocation, and the CI workflow runs frontend checks, backend HTTP tests, PostgreSQL integration tests, and a system workflow.

The documents are not yet fully aligned with the delivered system. The most material implementation gap is SEC-05: production startup still falls back to a known development session secret. The interface also describes ride-level shared messaging as private, conversation rows can repeat for a ride with multiple eligible passengers, and only the oldest 300 messages are returned. The test plan needs a corrected integration command and updated revision metadata. Performance, accessibility, browser compatibility, production security, and restart/rollback criteria remain without current evidence in the reviewed reports.

This is a documentation review, not a new test execution. “Implemented” below means the behavior is visible in the reviewed source; it does not claim runtime verification.

## Findings

| ID | Priority | Requirement or reference | Finding and evidence | Recommended disposition |
| --- | --- | --- | --- | --- |
| F-01 | High | SRS SEC-05; STP TC-29; SAD 3.9 and 4.6 | **Production secret fallback remains.** `src/backend/src/app.js` configures sessions with `process.env.SESSION_SECRET || 'dev-only-change-this-secret'` for every environment. The cookie becomes Secure in production, but startup does not reject a missing or default session secret. This directly misses SEC-05’s production acceptance criterion. | Fail production startup unless a non-default `SESSION_SECRET` is supplied. Add a configuration check and verify missing/default values are rejected before release. |
| F-02 | Medium | SRS FR-11; SAD ADR-06, 4.5 and 4.6 | **The UI misstates the shared-chat model.** The API stores messages by ride and authorizes the driver and all eligible passengers, as specified. The empty state in `src/frontend/src/App.jsx` calls this a “private ride conversation,” which implies one-to-one privacy. Also, `/api/conversations` returns one row per eligible booking; the frontend uses `ride_id` as each row’s React key and active selection. A driver’s ride with several accepted passengers can therefore produce duplicate-key conversation entries and ambiguous participant labels, while all users read the same ride-wide message stream. | Describe the conversation as shared with the ride’s eligible participants. Decide whether the UI should show one ride conversation or separate participant rows, then make API and UI semantics agree. |
| F-03 | Medium | SRS FR-11; SAD API table and 4.6 | **Message history is capped at the oldest 300 messages.** `GET /api/rides/:id/messages` orders ascending and applies `LIMIT 300`; after a ride exceeds that count, newly sent messages are omitted from the response. This behavior is called out as an open issue in SAD 4.6 but has no user-facing retention rule in the SRS. | Define the intended history behavior. Use pagination or return the latest page while preserving chronological display, and state any retention limit in the requirements. |
| F-04 | Medium | SRS FR-14; SAD 4.6; STP TC-14 | **Path ID validation is incomplete.** Search date and seat filters have explicit validation, but several route parameters (for example ride and booking IDs) are passed directly to PostgreSQL. A malformed non-numeric ID can reach a database cast error instead of the planned structured 400 validation response. SAD 4.6 already lists ID normalization as unfinished. | Validate route IDs before querying and add cases for malformed IDs to TC-14 and the API tests. Confirm the response is a structured 400, not a server error. |
| F-05 | Medium | STP 13.2; tests/README.md; `.github/workflows/ci.yml` | **The STP backend command does not run the integration suite.** The plan says to run `npm test` with `DATABASE_URL_TEST`, but `src/backend/package.json` maps `npm test` only to `tests/backend/health.test.js`. The database suite is `npm run test:integration`; the connected system suite is `npm run test:system`. CI does run all three backend steps, and `tests/README.md` documents the dedicated commands. | Update STP 13.2 to list `npm test`, `npm run test:integration`, and `npm run test:system` separately, each with its required environment. Keep their outcomes distinct in execution records. |
| F-06 | Low | SAD 4.1, 4.6; SRS FR-17 | **Ride cancellation is transactional, but accepted-seat reconciliation is unspecified in the code.** `PATCH /api/rides/:id/cancel` locks the ride and atomically cancels the ride and active bookings. It does not restore `available_seats` for accepted bookings. Because the parent ride is cancelled, those seats cannot be booked again; however, this leaves a stale capacity value on a terminal ride and does not satisfy SAD 4.6’s request to reconcile capacity. | State the invariant for cancelled rides. Either reconcile seats in the same transaction or document that capacity is intentionally irrelevant once a ride is cancelled. Add a database assertion to the cancellation case. |
| F-07 | Medium | SRS NFR-01 through NFR-04; SEC-01 through SEC-03; STP TC-19 through TC-22 and TC-25 through TC-27 | **Several acceptance targets lack recorded evidence.** The reviewed reports describe successful CI functional suites, but do not record a 50-user p95 measurement, keyboard/viewport evaluation, browser matrix, API restart/rollback exercise, production cookie/HTTPS check, rate-limit test, or CSRF/origin validation. `tests/README.md` likewise lists rate limiting and CSRF among gaps. The SAD notes that CSRF/origin controls need review before public deployment. | Keep these requirements Not run or record them as blocked until evidence is collected. Do not infer production security or quality-attribute compliance from the functional CI run. |

## Alignment confirmed in source

The following principal requirements have corresponding implementation paths in the reviewed baseline:

- **FR-01–FR-03:** registration, login/logout, server-side sessions, and name-only profile updates.
- **FR-04–FR-06:** ride creation, validated text/date/seat search, and ride-card details.
- **FR-07–FR-10 and FR-16:** pending requests, owner decisions, seat allocation under row locks and transaction, cancellation, dashboard data, and last-seat concurrency controls.
- **FR-11–FR-13:** participant messaging, history, booking completion, and eligible one-time ratings.
- **FR-14–FR-15 and FR-17–FR-18:** structured application errors, health/OpenAPI endpoints, transactional ride cancellation, and post-departure completion.
- **SEC-02–SEC-04:** bcrypt cost 12, a 20-per-15-minute authentication limiter outside test mode, ownership/participant checks, parameterized queries, database constraints, and transactional booking updates are present in source. Rate-limit behavior itself is not covered by the reviewed automated suite.

These are source-level alignments only. Passing test evidence remains tied to the specific CI runs recorded in CR-23 through CR-26, not to this review branch.

## Document consistency notes

1. **SRS/SAD traceability:** The shared FR, NFR, and SEC identifiers are consistent across the requirements, SAD traceability tables, and STP cases TC-01 through TC-29.
2. **SAD open issues should be refreshed:** Passenger booking cancellation is now available from ride history, ride cancellation and its active-booking update use one transaction, and search date/seat filters are validated. The SAD’s ID-validation, production-secret, chat-label, duplicate-conversation, message-history, timezone, and deployment-security items remain open or need explicit closure evidence.
3. **CR-27 STP update metadata:** The proposed CR-27 branch adds revision 1.3 to the revision-history table and cases TC-30 through TC-35, but its cover still says “Version 1.2” and “12 October 2026.” Update the cover metadata and any “STP v1.2” cross-references when that revision is finalized. The CR-27 branch is separate and unmerged at this review baseline.
4. **CR-27 STP command text:** Its revised section 13.1 correctly describes the separate CI suites, but section 13.2 still gives only `npm test` for the backend. Apply F-05 before treating the STP update as complete.

## Review disposition

The core functional design is substantially reflected in the code, but the documents should not state that all acceptance criteria are met. Resolve F-01 before any production deployment; correct the STP commands and revision metadata; align shared-chat wording and semantics; and collect or explicitly defer the remaining quality and security evidence. No new tests were run for this review.
