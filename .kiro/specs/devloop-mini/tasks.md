# Implementation Plan: DevLoop Mini

## Overview

Full MERN implementation of DevLoop Mini — an error-tracking and bug-collaboration tool. The stack is Node 20 (ESM), Express, MongoDB Atlas via Mongoose, React + Vite, with bcrypt/JWT auth, Zod validation, and Jest + Supertest testing.

Tasks follow strict ordering: models → utils → services → middleware → routes/controllers → client → tests. Each task produces runnable, integrated code — no hanging or orphaned modules.

---

## Tasks

- [x] 1. Server bootstrap — project skeleton, env config, DB connection, Express app
  - [x] 1.1 Initialise `server/package.json` with `"type": "module"`, add dependencies: `express`, `mongoose`, `bcrypt`, `jsonwebtoken`, `cookie-parser`, `zod`, `dotenv`, `cors`; add devDependencies: `jest`, `supertest`, `@jest/globals`, `babel-jest` (or native ESM Jest config); add npm scripts `start`, `dev`, `test`
    - Use exact pinned versions for all dependencies
    - _Requirements: 19.7_
    - _Design: Architecture > Directory Structure_
  - [x] 1.2 Create `server/src/config/env.js` — import `dotenv`, validate and export required env vars (`MONGODB_URI`, `JWT_SECRET`, `NODE_ENV`, `PORT`); throw on startup if any are missing
    - _Design: Auth Service_
  - [x] 1.3 Create `server/src/config/db.js` — export an async `connectDB()` function using `mongoose.connect(process.env.MONGODB_URI)`
    - _Design: Architecture > Directory Structure_
  - [x] 1.4 Create `server/src/utils/AppError.js` — `AppError` class extending `Error` with `statusCode` and `code` fields
    - _Design: Error Handling > AppError class_
  - [x] 1.5 Create `server/src/middleware/errorHandler.js` — global error handler: handle `AppError`, `ZodError`, and unexpected errors; return consistent `{ error, code }` JSON shape
    - _Design: Error Handling > Global error handler_
  - [x] 1.6 Create `server/index.js` — bootstrap Express app, register `cookie-parser`, `express.json()`, CORS (allow client origin with credentials), mount route stubs at `/api`, call `connectDB()`, start server on `PORT`
    - _Design: Architecture > Request Flow_
  - _Requirements: 1, 2, 19.7_

- [x] 2. User model and auth service
  - [x] 2.1 Create `server/src/models/User.js` — Mongoose schema with `email` (unique, lowercase, trim), `passwordHash`, `createdAt`; export model
    - _Requirements: 1.1_
    - _Design: Data Models > User_
  - [x] 2.2 Create `server/src/services/authService.js` — implement `signup(email, password)`: check duplicate email (throw `AppError(409, 'EMAIL_TAKEN')`), `bcrypt.hash` cost 12, `User.create`, sign JWT 24h, return `{ id, email, token }`; implement `login(email, password)`: `User.findOne`, `bcrypt.compare`, sign JWT, return user fields; implement `me(userId)`: `User.findById`, return `{ id, email }`; JWT payload `{ sub: user._id, email }` signed with `JWT_SECRET`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.9_
    - _Design: Service Layer > Auth Service_
  - _Requirements: 1_

- [x] 3. Auth middleware, routes, and controllers
  - [x] 3.1 Create `server/src/middleware/authenticate.js` — read `token` HttpOnly cookie, `jwt.verify`, attach `req.user = { id, email }`; on missing/invalid/expired → `AppError(401, 'UNAUTHORIZED')`
    - _Requirements: 1.6, 1.7, 13.5_
    - _Design: Middleware Chain > authenticate_
  - [x] 3.2 Create `server/src/middleware/validate.js` — accept a Zod schema, parse `req.body` or `req.query`, on `ZodError` pass to `next(err)` (global handler converts to 400)
    - _Requirements: 1.8, 2.7, 4.5, 9.5, 9.6_
    - _Design: Middleware Chain > validate_
  - [x] 3.3 Create Zod schemas `signupSchema` and `loginSchema` in `server/src/routes/schemas.js`
    - _Requirements: 1.8_
    - _Design: API Route Map > Zod Validation Schemas_
  - [x] 3.4 Create `server/src/controllers/authController.js` — thin handlers: `signup` sets HttpOnly cookie (`httpOnly: true, sameSite: 'lax', secure: NODE_ENV==='production', maxAge: 86400000`) and returns 201 `{ id, email }`; `login` sets cookie and returns 200 `{ id, email }`; `logout` clears cookie and returns 204; `me` returns 200 `{ id, email }`
    - _Requirements: 1.1, 1.3, 1.5, 1.6_
    - _Design: Architecture > Request Flow_
  - [x] 3.5 Create `server/src/routes/auth.js` — wire `POST /signup`, `POST /login`, `POST /logout`, `GET /me` with appropriate middleware and controllers; mount in `index.js` at `/api/auth`
    - _Requirements: 1.1–1.9_
    - _Design: API Route Map_

- [ ] 4. Project model, requireMember middleware, and project routes
  - [ ] 4.1 Create `server/src/models/Project.js` — Mongoose schema: `name` (1–100 chars, trim), `owner` (ObjectId ref User), `members` ([ObjectId ref User]), `createdAt`; no `ingestKeyHash` field
    - _Requirements: 2.1_
    - _Design: Data Models > Project_
  - [~] 4.2 Create `server/src/middleware/requireMember.js` — Mode A (project-scoped, `:id` param): `Project.findById`, check `owner` / `members`; Mode B (bug-scoped, `:bugId` param): `Bug.findById.select('project status __v')` then `Project.findById(bug.project)`, same owner/member check; 404 on failure; attach `req.project` (and `req.bug`); never read `projectId` from body/query
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
    - _Design: Authorization Middleware Design_
  - [~] 4.3 Create Zod schemas `projectSchema` and `addMemberSchema` in `server/src/routes/schemas.js`
    - _Requirements: 2.7_
    - _Design: API Route Map > Zod Validation Schemas_
  - [~] 4.4 Create `server/src/controllers/projectController.js` — `create`: `Project.create`, return 201 `{ id, name, owner }`; `list`: find where owner or member, return 200 array; `addMember`: find user by email (404 if not found, 409 if already member/owner), push to `members`, return 200 `{ id, email }`
    - _Requirements: 2.1–2.8_
    - _Design: Service Interfaces_
  - [~] 4.5 Create `server/src/routes/projects.js` — wire `POST /`, `GET /`, `POST /:id/members` with `authenticate`, `requireMember` (Mode A where applicable), `validate`, and controllers; mount at `/api/projects`
    - _Requirements: 2.1–2.8_
    - _Design: API Route Map_

- [ ] 5. Bug and BugEvent models
  - [~] 5.1 Create `server/src/models/Bug.js` — Mongoose schema: `project` (ObjectId ref Project), `fingerprint` (String, length 16), `title` (String, required), `status` (enum: `open`, `in_progress`, `fixed`, `wontfix`, default `open`), `severity` (enum: `low`, `medium`, `high`, `critical`, default `medium`), `assignee` (ObjectId ref User, default null), `occurrenceCount` (Number, default 0), `regressions` (Number, default 0), `lastSeen` (Date, default Date.now), `errorType` (String, default `UnknownError`), `createdAt` (Date, default Date.now); define indexes: `UNIQUE { project:1, fingerprint:1 }`, `{ project:1, lastSeen:-1 }`, `{ project:1, status:1 }`, `{ project:1, severity:1 }`
    - _Requirements: 6.5, 7.1_
    - _Design: Data Models > Bug_
  - [~] 5.2 Create `server/src/models/BugEvent.js` — Mongoose schema: `bug` (ObjectId ref Bug, required), `project` (ObjectId ref Project, required, denormalised), `type` (enum: `occurrence`, `status_changed`, required), `createdAt` (Date, default Date.now), `occurrenceCount` (Number), `from` (String), `to` (String), `memberId` (ObjectId ref User); define index `{ bug:1, createdAt:1, _id:1 }`; documents are append-only — never updated or deleted
    - _Requirements: 8.2, 10.4_
    - _Design: Data Models > BugEvent_

- [ ] 6. Fingerprint utility
  - [~] 6.1 Create `server/src/utils/fingerprint.js` — pure export `fingerprint(rawMessage, errorType, rawStack)`:
    1. Resolve error type: use `errorType` if non-empty; else substitute `"UnknownError"`
    2. Parse top stack frame: first line of `rawStack` with a file reference → extract `functionName@basename` (basename = file base name only, no directory, no line/col); fallback `"anonymous"` if absent, anonymous, or unparseable
    3. Normalize `rawMessage`: strip UUIDs (`/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi`), strip `0x`-prefixed hex (`/\b0x[0-9a-f]+\b/gi`), strip hex runs of 8+ chars containing at least one digit (`/\b(?=[0-9a-f]*[0-9])[0-9a-f]{8,}\b/gi`), strip standalone integers (`/\b\d+\b/g`), strip `line:col` refs (`/\b\d+:\d+\b/g`), collapse whitespace (trim + single space)
    4. Canonical string: `"{normalizedMsg}|{errorType}|{topFrame}"`
    5. `crypto.createHash('sha1').update(canonical, 'utf8').digest('hex').slice(0, 16)`
    - No I/O, no side effects; export as named function
    - _Requirements: 6.1–6.6_
    - _Design: Fingerprint Algorithm_

- [ ] 7. Ingest service
  - [~] 7.1 Create `server/src/services/ingestService.js` — implement `ingest(projectId, message, stack)`:
    1. Extract `errorType` from message prefix (e.g. `TypeError: …`); call `fingerprint(message, errorType, stack)`
    2. Compute `title = normalizeMessage(message).slice(0, 120)` (reuse normalization from fingerprint.js)
    3. `Bug.findOneAndUpdate({ project: projectId, fingerprint: fp }, { $setOnInsert: { title, errorType, createdAt: now }, $inc: { occurrenceCount: 1 }, $set: { lastSeen: now } }, { upsert: true, new: true, runValidators: true })`
    4. On DuplicateKeyError (MongoDB code 11000): retry step 3 exactly once; if retry also fails → throw `AppError(500, 'INTERNAL_ERROR')`
    5. If `bug.status === 'fixed'`: `Bug.findOneAndUpdate({ _id: bug._id, __v: bug.__v, status: 'fixed' }, { $set: { status: 'open' }, $inc: { regressions: 1, __v: 1 } }, { new: true })`; on null result → throw `AppError(500, 'INTERNAL_ERROR')`; append `BugEvent { type: 'status_changed', from: 'fixed', to: 'open', createdAt: new Date(now - 1) }` (1 ms before occurrence)
    6. Append `BugEvent { type: 'occurrence', occurrenceCount: bug.occurrenceCount, createdAt: now }`
    7. Return bug
    - _Requirements: 4.1–4.5, 6.5_
    - _Design: Service Layer > Ingest Service_

- [ ] 8. Bug state service
  - [~] 8.1 Create `server/src/services/bugStateService.js` — define `TRANSITIONS` table: `{ open: ['in_progress', 'wontfix'], in_progress: ['open', 'fixed'], fixed: ['open'], wontfix: ['open'] }`; implement `transition(bugId, toStatus, memberId, version, currentStatus)`:
    1. Validate against TRANSITIONS; if invalid → throw `AppError(422, 'ILLEGAL_TRANSITION')`
    2. `Bug.findOneAndUpdate({ _id: bugId, __v: version, status: currentStatus }, { $set: { status: toStatus }, $inc: { __v: 1 } }, { new: true })`
    3. If null result → throw `AppError(409, 'STALE_VERSION')`
    4. `BugEvent.create({ bug: bugId, project: bug.project, type: 'status_changed', from: currentStatus, to: toStatus, memberId })`
    5. Return updated bug
    - _Requirements: 10.1–10.6_
    - _Design: Service Layer > Bug State Service_

- [~] 9. Checkpoint — server services complete
  - Ensure `server/src/` has no import errors and all models, utils, and services load correctly. Ask the user if questions arise.

- [ ] 10. Bug routes, controllers, and ingest route
  - [~] 10.1 Create Zod schemas in `server/src/routes/schemas.js`: `ingestSchema` (`message` 1–2000, `stack` 1–50000), `bugPatchSchema` (optional `severity` enum + optional `assignee` string, `.refine` at least one field, `.strict()` to reject extra keys), `statusSchema` (`status` enum + `version` integer), `bugListQuery` (`status?`, `severity?`, `assignee?`, `search?`, `skip?: coerce int ≥0 default 0`, `limit?: coerce int 1–200 default 50`)
    - _Requirements: 4.5, 7.8, 9.5, 9.6_
    - _Design: API Route Map > Zod Validation Schemas_
  - [~] 10.2 Create `server/src/controllers/bugController.js` — `list`: apply filters from validated query + `limit`/`skip` pagination, return 200 `{ bugs, total }`; `detail`: return bug fields + BugEvents sorted `{ createdAt: 1, _id: 1 }`; `patchMetadata`: conditional write `{ _id, __v, status }` filter, return 200 or throw 409; `transitionStatus`: delegate to `bugStateService.transition`, return 200; no comment handlers
    - _Requirements: 7.1–7.9, 8.1–8.4, 9.1–9.6, 10.1–10.6_
    - _Design: Service Interfaces, Concurrency and Optimistic Locking_
  - [~] 10.3 Create `server/src/controllers/ingestController.js` — single member route handler: delegate to `ingestService.ingest(req.project._id, message, stack)`; return 200 `{ id, fingerprint, occurrenceCount, status, regressions }`
    - _Requirements: 4.1–4.5_
    - _Design: Service Interfaces_
  - [~] 10.4 Create `server/src/routes/bugs.js` — wire `GET /:bugId`, `PATCH /:bugId`, `POST /:bugId/status` with `authenticate`, `requireMember` (Mode B), `validate`, and controllers; mount at `/api/bugs`
    - _Requirements: 8–10, 13_
    - _Design: API Route Map_
  - [~] 10.5 Add bug list and member ingest routes to `server/src/routes/projects.js` — `GET /:id/bugs` with `authenticate`, `requireMember` (Mode A), `validate(bugListQuery)`, `bugController.list`; `POST /:id/ingest` with `authenticate`, `requireMember` (Mode A), `validate(ingestSchema)`, `ingestController.member`
    - _Requirements: 4.1–4.5, 7.1–7.9_
    - _Design: API Route Map_

- [~] 11. Checkpoint — server complete
  - Ensure Express app starts cleanly and all server-side routes respond to a basic health check or OPTIONS request. Ask the user if questions arise.

- [ ] 12. Client bootstrap and API layer
  - [~] 12.1 Initialise Vite + React project in `client/` (`npm create vite@latest client -- --template react`); install `react-router-dom`; configure `vite.config.js` proxy for `/api` to `http://localhost:<PORT>`
    - _Requirements: 14, 15, 16, 17, 18_
    - _Design: Architecture > Directory Structure_
  - [~] 12.2 Create `client/src/api/auth.js` — `login(email, password)`, `signup(email, password)`, `logout()`, `me()` — thin `fetch` wrappers with `credentials: 'include'`; throw `{ error, code }` on non-2xx
    - _Requirements: 14.2, 14.3, 14.6_
    - _Design: React Component and Page Structure > API Layer_
  - [~] 12.3 Create `client/src/api/projects.js` — `listProjects()`, `createProject(name)`, `addMember(projectId, email)`
    - _Requirements: 15.1, 15.2_
    - _Design: React Component and Page Structure > API Layer_
  - [~] 12.4 Create `client/src/api/bugs.js` — `listBugs(projectId, params)`, `getBug(bugId)`, `patchBug(bugId, data)`, `transitionStatus(bugId, data)`
    - _Requirements: 16.1, 17.1_
    - _Design: React Component and Page Structure > API Layer_
  - [~] 12.5 Create `client/src/api/ingest.js` — `ingestError(projectId, message, stack)`
    - _Requirements: 18.1, 18.2_
    - _Design: React Component and Page Structure > API Layer_

- [ ] 13. React Router setup and protected route wrapper
  - [~] 13.1 Create `client/src/App.jsx` — set up React Router v6 routes: `/login` → `LoginPage`, `/signup` → `SignupPage`, `/projects` → `ProjectListPage`, `/projects/:id/bugs` → `BugListPage`, `/bugs/:bugId` → `BugDetailPage`; implement `ProtectedRoute` component that calls `api/auth.me()` and redirects to `/login` if unauthenticated
    - _Requirements: 14.1, 14.6_
    - _Design: React Component and Page Structure > Routing_

- [ ] 14. Auth pages and NavBar
  - [~] 14.1 Create `client/src/components/NavBar.jsx` — displays logout button when authenticated; calls `api/auth.logout()` on click; redirects to `/login` on 204
    - _Requirements: 14.6_
    - _Design: React Component and Page Structure > Components_
  - [~] 14.2 Create `client/src/pages/LoginPage.jsx` — email + password form; client-side validation (non-empty, email format, password ≥8 chars) without submission; calls `api/auth.login()`; redirects to `/projects` on 200; inline error on 4xx
    - _Requirements: 14.1, 14.2, 14.4, 14.5_
    - _Design: React Component and Page Structure > Pages_
  - [~] 14.3 Create `client/src/pages/SignupPage.jsx` — same pattern as LoginPage; calls `api/auth.signup()`; redirects to `/projects` on 201
    - _Requirements: 14.3, 14.4, 14.5_
    - _Design: React Component and Page Structure > Pages_

- [ ] 15. Project list page and form
  - [~] 15.1 Create `client/src/components/ProjectForm.jsx` — inline create-project form; client-side validation (non-empty name); calls `api/projects.createProject()`; on 201 prepends project to list; inline error on 4xx; no full page reload
    - _Requirements: 15.2, 15.3, 15.4_
    - _Design: React Component and Page Structure > Components_
  - [~] 15.2 Create `client/src/pages/ProjectListPage.jsx` — fetch and display projects list (name + owner email) on mount; render `ProjectForm`; protected by `ProtectedRoute`
    - _Requirements: 15.1, 15.2_
    - _Design: React Component and Page Structure > Pages_

- [ ] 16. Bug list page, filter bar, paste error box, and pagination
  - [~] 16.1 Create `client/src/components/FilterBar.jsx` — controlled inputs for `status`, `severity`, `assignee`, and search text; debounced 300 ms; emits filter change to parent
    - _Requirements: 16.3_
    - _Design: React Component and Page Structure > Components_
  - [~] 16.2 Create `client/src/components/PasteErrorBox.jsx` — two textareas (`message` max 2000, `stack` max 50000); submit calls `api/ingest.ingestError()`; on 200 display returned `status` + `occurrenceCount` inline and clear inputs; on error display inline error and retain values
    - _Requirements: 18.1–18.4_
    - _Design: React Component and Page Structure > Components_
  - [~] 16.3 Create `client/src/pages/BugListPage.jsx` — fetch paginated bugs for project on mount using `limit`/`skip`; render each bug's `title`, `status`, `severity`, `occurrenceCount`, `regressions`, `lastSeen`; empty-state message when no bugs; render `FilterBar` and reload bugs within 300 ms of filter change; load-more button or simple pagination for additional pages; inline retry on fetch failure; render `PasteErrorBox`
    - _Requirements: 16.1–16.5_
    - _Design: React Component and Page Structure > Pages_

- [ ] 17. Bug detail page — timeline and status actions
  - [~] 17.1 Create `client/src/components/BugTimeline.jsx` — render ordered BugEvents ascending by `createdAt`; switch on `type`: `occurrence` (show `occurrenceCount`), `status_changed` (show `from` → `to`); no comment rendering
    - _Requirements: 17.1_
    - _Design: React Component and Page Structure > Components_
  - [~] 17.2 Create `client/src/components/StatusActions.jsx` — render one button per legal next status (derived from TRANSITIONS) for the bug's current status; on click call `api/bugs.transitionStatus()`; on 200 update displayed status and append `status_changed` event to timeline; inline error on 4xx/5xx
    - _Requirements: 17.2, 17.3, 17.4_
    - _Design: React Component and Page Structure > Components_
  - [~] 17.3 Create `client/src/pages/BugDetailPage.jsx` — fetch bug + events on mount; display `title`, `status`, `severity`, `assignee`, `occurrenceCount`, `regressions`, `lastSeen`, `fingerprint`; render `BugTimeline` and `StatusActions`; inline error on action failures
    - _Requirements: 17.1–17.4_
    - _Design: React Component and Page Structure > Pages_

- [~] 18. Checkpoint — client complete
  - Ensure the React app builds without errors (`npm run build`). Verify routing and protected routes work. Ask the user if questions arise.

- [ ] 19. Jest configuration and test DB setup
  - [~] 19.1 Create Jest config in `server/jest.config.js` — configure for ESM (`transform`, `extensionsToTreatAsEsm`), set `testEnvironment: 'node'`, point `globalSetup` and `globalTeardown` to setup files
    - _Requirements: 19.7_
    - _Design: Testing Strategy > Test Database Isolation_
  - [~] 19.2 Create `server/tests/globalSetup.js` — connect to `TEST_MONGODB_URI`; create `server/tests/globalTeardown.js` — drop all collections; create `server/tests/helpers/db.js` — `clearCollections()` helper for between-test cleanup
    - _Requirements: 19.7_
    - _Design: Testing Strategy > Test Database Isolation_

- [ ] 20. Fingerprint unit tests
  - [~] 20.1 Create `server/tests/unit/fingerprint.test.js` — table-driven Jest tests covering: UUID removal, `0x`-prefixed hex removal, 8+-char hex-with-digit removal, standalone numeric ID removal, `line:col` removal, whitespace collapsing, `errorType` extraction (present, absent → `UnknownError`), stack frame normalization (present with basename-only, anonymous → `"anonymous"`, absent → `"anonymous"`); include ≥2 documented false-merge cases with inline comments explaining the merge; include ≥2 documented false-split cases with inline comments explaining the split; each case asserts deterministic 16-hex output matching `/^[0-9a-f]{16}$/`
    - _Requirements: 19.1, 6.1–6.6_
    - _Design: Testing Strategy > Unit Tests; Fingerprint Algorithm > Known Limitations_

- [ ] 21. Bug state service unit tests
  - [~] 21.1 Create `server/tests/unit/bugState.test.js` — test all 9 legal transitions (accept, return updated bug); test all 12 illegal transitions (throw `AppError(422, 'ILLEGAL_TRANSITION')`); test stale `__v` or status mismatch → `AppError(409, 'STALE_VERSION')`; mock or use test DB for `Bug.findOneAndUpdate` and `BugEvent.create`
    - _Requirements: 19.4, 10.1, 10.2_
    - _Design: Testing Strategy > Unit Tests_

- [ ] 22. Auth integration tests
  - [~] 22.1 Create `server/tests/integration/auth.test.js` — test: signup success (201, cookie set, `{ id, email }`), duplicate email (409), login success (200, cookie set), wrong password/email (401), logout (204, cookie cleared), `GET /me` with valid cookie (200), `GET /me` with missing/expired cookie (401), validation errors (400) for each invalid field
    - _Requirements: 1.1–1.9, 19_
    - _Design: Testing Strategy > Integration Tests_

- [ ] 23. Project integration tests
  - [~] 23.1 Create `server/tests/integration/projects.test.js` — test: create project (201, owner set), list projects (own + member projects returned), add member by email (200), add member with unknown email (404), add member as non-owner (404), duplicate member (409), unauthenticated requests (401), validation errors (400)
    - _Requirements: 2.1–2.8, 19.6_
    - _Design: Testing Strategy > Integration Tests_

- [ ] 24. Ingest integration tests
  - [~] 24.1 Create `server/tests/integration/ingest.test.js` — test: member ingest (200, response contains `{ id, fingerprint, occurrenceCount, status, regressions }`), same message twice → `occurrenceCount === 2` and exactly 1 Bug document, non-member (404), invalid body (400)
    - _Requirements: 4.1–4.5, 19_
    - _Design: Testing Strategy > Integration Tests_

- [ ] 25. Concurrency and regression integration tests
  - [~] 25.1 Create `server/tests/integration/concurrency.test.js` — send 20 concurrent identical ingest requests via `Promise.all`; assert exactly 1 Bug document exists and `occurrenceCount === 20`
    - _Requirements: 19.2_
    - _Design: Testing Strategy > Integration Tests_
  - [~] 25.2 Create `server/tests/integration/regression.test.js` — create bug, transition to `fixed`, ingest new occurrence; assert `status === 'open'`, `regressions === 1`; assert event log contains `status_changed` event (from `fixed` to `open`) with `createdAt` strictly before the `occurrence` event's `createdAt` when sorted ascending by `(createdAt, _id)`
    - _Requirements: 19.3, 4.2_
    - _Design: Testing Strategy > Integration Tests; Correctness Scenario: Regression detection_

- [ ] 26. Bug integration tests
  - [~] 26.1 Create `server/tests/integration/bugs.test.js` — test: list bugs (filters: `status`, `severity`, `assignee`, `search`; `limit`/`skip` pagination), bug detail + timeline (events sorted ascending by `createdAt, _id`), PATCH metadata (success 200, stale `__v` → 409, validation error → 400), status transition (legal → 200, illegal → 422, stale → 409, not found → 404)
    - _Requirements: 7.1–7.9, 8.1–8.4, 9.1–9.6, 10.1–10.6, 19.5_
    - _Design: Testing Strategy > Integration Tests_

- [ ] 27. Authorization integration tests
  - [~] 27.1 Create `server/tests/integration/authorization.test.js` — user B (not a member of user A's project) attempts every applicable route: `GET /api/projects/:id/bugs`, `POST /api/projects/:id/ingest`, `GET /api/bugs/:bugId`, `PATCH /api/bugs/:bugId`, `POST /api/bugs/:bugId/status`; assert HTTP 404 on every route
    - _Requirements: 19.6, 13.1–13.5_
    - _Design: Testing Strategy > Integration Tests_

- [ ] 28. README and .env.example
  - [~] 28.1 Create `README.md` at workspace root — sections: Project Overview, Prerequisites, Setup (clone, install, `.env` configuration from `.env.example`), Running the App (server + client commands), Running Tests (unit, integration, `TEST_MONGODB_URI` requirement), Design Notes (Bug Identity via Unique Index, Append-Only Event Log, Fingerprint Limitations, Optimistic Locking, Non-Atomic Gap Between Bug Update and Event Insert)
    - _Design: README Design Notes_
  - [~] 28.2 Verify `server/.env.example` includes keys `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV`, `PORT` with placeholder values; no real secrets
    - _Design: Architecture_

- [~] 29. Final checkpoint — full suite passes
  - Run `npm test` in `server/`; confirm all unit and integration tests pass against `TEST_MONGODB_URI`. Run `npm run build` in `client/`; confirm clean build. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP; all tasks in this list are required
- Each task references specific requirements for traceability
- Checkpoints (tasks 9, 11, 18, 29) ensure incremental validation and are not included in the dependency graph
- No fast-check / property-based tests — Jest unit and integration tests only
- No API key ingest route, no stats service, no cursor pagination, no comments — these are out of scope per revised design
- `limit`/`skip` is used for bug list pagination; no `nextCursor` token
- BugEvent types are `occurrence` and `status_changed` only

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4"] },
    { "id": 5, "tasks": ["3.5"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["4.2", "4.3"] },
    { "id": 8, "tasks": ["4.4"] },
    { "id": 9, "tasks": ["4.5"] },
    { "id": 10, "tasks": ["5.1"] },
    { "id": 11, "tasks": ["5.2"] },
    { "id": 12, "tasks": ["6.1"] },
    { "id": 13, "tasks": ["7.1"] },
    { "id": 14, "tasks": ["8.1"] },
    { "id": 15, "tasks": ["10.1"] },
    { "id": 16, "tasks": ["10.2", "10.3"] },
    { "id": 17, "tasks": ["10.4", "10.5"] },
    { "id": 18, "tasks": ["12.1"] },
    { "id": 19, "tasks": ["12.2", "12.3", "12.4", "12.5"] },
    { "id": 20, "tasks": ["13.1"] },
    { "id": 21, "tasks": ["14.1", "14.2", "14.3"] },
    { "id": 22, "tasks": ["15.1"] },
    { "id": 23, "tasks": ["15.2"] },
    { "id": 24, "tasks": ["16.1", "16.2"] },
    { "id": 25, "tasks": ["16.3"] },
    { "id": 26, "tasks": ["17.1", "17.2"] },
    { "id": 27, "tasks": ["17.3"] },
    { "id": 28, "tasks": ["19.1"] },
    { "id": 29, "tasks": ["19.2"] },
    { "id": 30, "tasks": ["20.1"] },
    { "id": 31, "tasks": ["21.1"] },
    { "id": 32, "tasks": ["22.1"] },
    { "id": 33, "tasks": ["23.1"] },
    { "id": 34, "tasks": ["24.1"] },
    { "id": 35, "tasks": ["25.1", "25.2"] },
    { "id": 36, "tasks": ["26.1"] },
    { "id": 37, "tasks": ["27.1"] },
    { "id": 38, "tasks": ["28.1", "28.2"] }
  ]
}
```
