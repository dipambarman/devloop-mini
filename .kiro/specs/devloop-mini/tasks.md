# Implementation Plan: DevLoop Mini

## Overview

Full MERN implementation of DevLoop Mini — an error-tracking and bug-collaboration tool. The stack is Node 20 (ESM), Express, MongoDB Atlas via Mongoose, React + Vite, with bcrypt/JWT auth, Zod validation, and Jest + Supertest + fast-check testing.

Tasks follow strict ordering: models → utils → services → middleware → routes/controllers → client → tests. Each task produces runnable, integrated code — no hanging or orphaned modules.

---

## Tasks

- [ ] 1. Server bootstrap — project skeleton, env config, DB connection, Express app
  - [ ] 1.1 Initialise `server/package.json` with `"type": "module"`, add dependencies: `express`, `mongoose`, `bcrypt`, `jsonwebtoken`, `cookie-parser`, `zod`, `dotenv`, `cors`; add devDependencies: `jest`, `supertest`, `@jest/globals`, `fast-check`, `babel-jest` (or native ESM Jest config); add npm scripts `start`, `dev`, `test`
    - Use exact pinned versions for all dependencies
    - _Requirements: 19.7_
    - _Design: Architecture > Directory Structure_
  - [ ] 1.2 Create `server/src/config/env.js` — import `dotenv`, validate and export required env vars (`MONGODB_URI`, `JWT_SECRET`, `NODE_ENV`, `PORT`); throw on startup if any are missing
    - _Design: Auth Service_
  - [ ] 1.3 Create `server/src/config/db.js` — export an async `connectDB()` function using `mongoose.connect(process.env.MONGODB_URI)`
    - _Design: Architecture > Directory Structure_
  - [ ] 1.4 Create `server/index.js` — bootstrap Express app, register `cookie-parser`, `express.json()`, CORS (allow client origin with credentials), mount route stubs at `/api`, call `connectDB()`, start server on `PORT`
    - _Design: Architecture > Request Flow_
  - [ ] 1.5 Create `server/src/middleware/errorHandler.js` — global error handler: handle `AppError`, `ZodError`, and unexpected errors; return consistent `{ error, code }` JSON shape
    - _Design: Error Handling > Global error handler_
  - [ ] 1.6 Create `server/src/utils/AppError.js` — `AppError` class extending `Error` with `statusCode` and `code` fields
    - _Design: Error Handling > AppError class_
  - _Requirements: 1, 2, 19.7_

- [ ] 2. User model and auth service
  - [ ] 2.1 Create `server/src/models/User.js` — Mongoose schema with `email` (unique, lowercase, trim), `passwordHash`, `createdAt`; export model
    - _Requirements: 1.1_
    - _Design: Data Models > User_
  - [ ] 2.2 Create `server/src/services/authService.js` — implement `signup(email, password)`: check duplicate email (throw `AppError(409, 'EMAIL_TAKEN')`), `bcrypt.hash` cost 12, `User.create`, sign JWT 24h, return `{ id, email, token }`; implement `login(email, password)`: `User.findOne`, `bcrypt.compare`, sign JWT, return user fields; implement `me(userId)`: `User.findById`, return `{ id, email }`; JWT payload `{ sub: user._id, email }` signed with `JWT_SECRET`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.9_
    - _Design: Service Layer > Auth Service_
  - _Requirements: 1_

- [ ] 3. Auth middleware, routes, and controllers
  - [ ] 3.1 Create `server/src/middleware/authenticate.js` — read `token` HttpOnly cookie, `jwt.verify`, attach `req.user = { id, email }`; on missing/invalid/expired → `AppError(401, 'UNAUTHORIZED')`
    - _Requirements: 1.6, 1.7, 13.5_
    - _Design: Middleware Chain > authenticate_
  - [ ] 3.2 Create `server/src/middleware/validate.js` — accept a Zod schema, parse `req.body` or `req.query`, on `ZodError` pass to `next(err)` (global handler converts to 400)
    - _Requirements: 1.8, 2.7, 4.5, 5.3, 9.5, 9.6, 11.7_
    - _Design: Middleware Chain > validate_
  - [ ] 3.3 Create Zod schemas in `server/src/routes/schemas.js` (or co-located): `signupSchema`, `loginSchema`
    - _Requirements: 1.8_
    - _Design: API Route Map > Zod Validation Schemas_
  - [ ] 3.4 Create `server/src/controllers/authController.js` — thin handlers: `signup` sets HttpOnly cookie and returns 201 `{ id, email }`; `login` sets cookie and returns 200 `{ id, email }`; `logout` clears cookie returns 204; `me` returns 200 `{ id, email }`
    - _Requirements: 1.1, 1.3, 1.5, 1.6_
    - _Design: Architecture > Request Flow_
  - [ ] 3.5 Create `server/src/routes/auth.js` — wire `POST /signup`, `POST /login`, `POST /logout`, `GET /me` with appropriate middleware and controllers; mount in `index.js` at `/api/auth`
    - _Requirements: 1.1–1.9_
    - _Design: API Route Map_

- [ ] 4. Project model
  - [ ] 4.1 Create `server/src/models/Project.js` — Mongoose schema: `name` (1–100 chars, trim), `owner` (ObjectId ref User), `members` ([ObjectId ref User]), `ingestKeyHash` (String, default null), `createdAt`
    - _Requirements: 2.1, 3.1_
    - _Design: Data Models > Project_

- [ ] 5. Ingest API key utilities
  - [ ] 5.1 Create `server/src/utils/apiKey.js` — `generateKey()`: `crypto.randomBytes(32).toString('hex')` for plaintext, SHA-256 of plaintext for hash, return `{ plaintext, hash }`; `hashKey(key)`: SHA-256 of key
    - _Requirements: 3.1, 3.6, 5.2_
    - _Design: Components > API Key Utilities_

- [ ] 6. Project routes, controllers, and Zod schemas
  - [ ] 6.1 Create `server/src/middleware/requireMember.js` — Mode A (project-scoped, `:id` param): `Project.findById`, check `owner` / `members`; Mode B (bug-scoped, `:bugId` param): `Bug.findById.populate('project')`, same check; 404 on failure; attach `req.project` (and `req.bug`); never read `projectId` from body/query
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
    - _Design: Authorization Middleware Design_
  - [ ] 6.2 Create Zod schemas: `projectSchema`, `addMemberSchema`
    - _Requirements: 2.7_
    - _Design: API Route Map > Zod Validation Schemas_
  - [ ] 6.3 Create `server/src/controllers/projectController.js` — `create`: `Project.create`, return 201 `{ id, name, owner }`; `list`: find where owner or member, return 200 array; `addMember`: find user by email, push to `members`, return 200 `{ id, email }`; `generateKey`: call `apiKey.generateKey()`, store hash on project, return 201 `{ key }` with warning message
    - _Requirements: 2.1–2.8, 3.1–3.6_
    - _Design: Service Interfaces_
  - [ ] 6.4 Create `server/src/routes/projects.js` — wire `POST /`, `GET /`, `POST /:id/members`, `POST /:id/keys`, `GET /:id/stats`, with `authenticate`, `requireMember` (Modes A), `validate`, and controllers; mount at `/api/projects`
    - _Requirements: 2.1–2.8, 3.1–3.6, 12.1–12.3_
    - _Design: API Route Map_

- [ ] 7. Bug and BugEvent models
  - [ ] 7.1 Create `server/src/models/Bug.js` — Mongoose schema: `project` (ObjectId), `fingerprint` (16-char String), `title` (String), `status` (enum, default `open`), `severity` (enum, default `medium`), `assignee` (ObjectId, null), `occurrenceCount` (Number, 0), `regressions` (Number, 0), `lastSeen` (Date), `errorType` (String, default `UnknownError`), `createdAt`; define indexes: `UNIQUE { project:1, fingerprint:1 }`, `{ project:1, lastSeen:-1, _id:-1 }`, `{ project:1, status:1 }`, `{ project:1, severity:1 }`
    - _Requirements: 6.5, 7.1_
    - _Design: Data Models > Bug_
  - [ ] 7.2 Create `server/src/models/BugEvent.js` — Mongoose schema: `bug` (ObjectId), `project` (ObjectId, denormalised), `type` (enum: `occurrence`, `status_changed`, `comment`), `createdAt`, `occurrenceCount` (Number), `from` (String), `to` (String), `body` (String, maxlength 5000), `authorId` (ObjectId), `memberId` (ObjectId); define index `{ bug:1, createdAt:1 }`
    - _Requirements: 8.2, 11.1_
    - _Design: Data Models > BugEvent_

- [ ] 8. Fingerprint utility
  - [ ] 8.1 Create `server/src/utils/fingerprint.js` — pure export `fingerprint(rawMessage, errorType, rawStack)`:
    1. Resolve error type (fallback `"UnknownError"`)
    2. Parse top stack frame as `functionName@fileName`, fallback `"anonymous"`
    3. Normalize `rawMessage`: strip UUIDs (`/[0-9a-f]{8}-…/gi`), hex 4+ chars (`/\b[0-9a-f]{4,}\b/gi`), standalone ints (`/\b\d+\b/g`), `line:col` (`/\b\d+:\d+\b/g`), collapse whitespace
    4. Canonical string: `"{normalizedMsg}|{errorType}|{topFrame}"`
    5. `crypto.createHash('sha1').update(canonical,'utf8').digest('hex').slice(0,16)`
    - No I/O, no side effects; export as named function
    - _Requirements: 6.1–6.6_
    - _Design: Fingerprint Algorithm_
  - [ ]* 8.2 Write property tests for fingerprint output format and determinism
    - **Property 1: Fingerprint output format** — for any `(message, errorType, stack)`, output matches `/^[0-9a-f]{16}$/`
    - **Property 2: Fingerprint determinism** — identical inputs always produce identical outputs
    - File: `server/tests/unit/fingerprint.property.test.js`
    - _Requirements: 6.3, 6.4_
    - _Design: Correctness Properties 1, 2; Testing Strategy > Property-Based Tests_
  - [ ]* 8.3 Write property test for fingerprint noise invariance
    - **Property 3: Fingerprint noise invariance** — injecting UUIDs, hex sequences, numeric IDs, `line:col`, or whitespace into a message SHALL NOT change the fingerprint
    - File: `server/tests/unit/fingerprint.property.test.js`
    - _Requirements: 6.1, 6.2_
    - _Design: Correctness Properties 3_

- [ ] 9. Cursor pagination utility
  - [ ] 9.1 Create `server/src/utils/cursor.js` — `encodeCursor(lastSeen, id)`: `Buffer.from(JSON.stringify({lastSeen,id})).toString('base64url')`; `decodeCursor(token)`: parse, return `{ lastSeen: new Date(…), id }`, throw `AppError(400,'INVALID_CURSOR')` on parse failure
    - _Requirements: 7.6, 7.9_
    - _Design: Cursor Pagination_

- [ ] 10. Ingest service
  - [ ] 10.1 Create `server/src/services/ingestService.js` — implement `ingest(projectId, message, stack)`:
    1. Call `fingerprint(message, errorType, stack)` — extract `errorType` from message prefix
    2. Compute `title = normalizeMessage(message).slice(0,120)`
    3. `Bug.findOneAndUpdate({ project, fingerprint }, { $setOnInsert:{title,errorType,createdAt}, $inc:{occurrenceCount:1}, $set:{lastSeen:now} }, { upsert:true, new:true, runValidators:true })`
    4. On `DuplicateKeyError (code 11000)`: retry once; if retry fails throw `AppError(500,'INTERNAL_ERROR')`
    5. If `bug.status === 'fixed'`: atomic `findOneAndUpdate({_id,__v,status:'fixed'}, {$set:{status:'open'},$inc:{regressions:1,__v:1}}, {new:true})`; on null result throw `AppError(500,'INTERNAL_ERROR')`; append `BugEvent{type:'status_changed',from:'fixed',to:'open'}`
    6. Append `BugEvent{type:'occurrence',occurrenceCount:bug.occurrenceCount}`
    7. Return bug
    - _Requirements: 4.1–4.5, 5.1, 5.4, 6.5_
    - _Design: Service Layer > Ingest Service_
  - [ ]* 10.2 Write property test for ingest fingerprint round-trip
    - **Property 4: Ingest fingerprint round-trip** — for any valid `(message, stack)`, the `fingerprint` in the returned Bug SHALL equal `fingerprint()` called with the same inputs
    - File: `server/tests/integration/ingest.property.test.js`
    - _Requirements: 4.1, 6.5_
    - _Design: Correctness Properties 4_
  - [ ]* 10.3 Write property test for regression detection and event ordering
    - **Property 5: Regression detection and event ordering** — for any Bug with `status="fixed"`, ingesting a new occurrence SHALL atomically set status to `"open"`, increment `regressions` by 1, and the `status_changed` event SHALL have `createdAt` strictly before the `occurrence` event
    - File: `server/tests/integration/regression.property.test.js`
    - _Requirements: 4.2, 19.3_
    - _Design: Correctness Properties 5_
  - [ ]* 10.4 Write property test for ingest route equivalence
    - **Property 6: Both ingest routes are behaviourally equivalent** — for any valid `(message, stack)`, member route and API key route targeting the same project SHALL produce identical response shape and Bug state
    - File: `server/tests/integration/ingest.property.test.js`
    - _Requirements: 5.1, 5.4_
    - _Design: Correctness Properties 6_

- [ ] 11. Bug state service
  - [ ] 11.1 Create `server/src/services/bugStateService.js` — define `TRANSITIONS` table: `{open:['in_progress','wontfix'],in_progress:['open','fixed'],fixed:['open'],wontfix:['open']}`; implement `transition(bugId, toStatus, memberId, version, currentStatus)`:
    1. Validate against TRANSITIONS, throw `AppError(422,'ILLEGAL_TRANSITION')` on failure
    2. `Bug.findOneAndUpdate({_id:bugId,__v:version,status:currentStatus},{$set:{status:toStatus},$inc:{__v:1}},{new:true})`
    3. If null result throw `AppError(409,'STALE_VERSION')`
    4. `BugEvent.create({bug,project,type:'status_changed',from:currentStatus,to:toStatus,memberId})`
    5. Return updated bug
    - _Requirements: 10.1–10.6_
    - _Design: Service Layer > Bug State Service_
  - [ ]* 11.2 Write property test for state machine acceptance
    - **Property 7: State machine acceptance matches TRANSITIONS table** — for any `(currentStatus, toStatus)` pair, `transition` SHALL accept if and only if `toStatus ∈ TRANSITIONS[currentStatus]`
    - File: `server/tests/unit/bugState.property.test.js`
    - _Requirements: 10.1, 10.2, 19.4_
    - _Design: Correctness Properties 7_
  - [ ]* 11.3 Write property test for status transition event appending
    - **Property 8: Every successful status transition appends a status_changed event** — after a legal transition, BugEvent collection SHALL contain a `status_changed` event with correct `from`, `to`, `memberId`
    - File: `server/tests/integration/bugState.property.test.js`
    - _Requirements: 10.4_
    - _Design: Correctness Properties 8_

- [ ] 12. Stats service
  - [ ] 12.1 Create `server/src/services/statsService.js` — `getStats(projectId)`: aggregation pipeline `$match:{project}` → `$group:{_id:'$status',count:{$sum:1}}`; fill zero-counts for all status and severity enum values; return `{ byStatus:[…], bySeverity:[…] }`
    - _Requirements: 12.1_
    - _Design: Service Layer > Stats Service_
  - [ ]* 12.2 Write property test for stats group completeness
    - **Property 11: Stats response always includes all status and severity groups** — for any project with any bug distribution (including empty), stats response SHALL include exactly four status groups and four severity groups each with a non-negative count
    - File: `server/tests/integration/stats.property.test.js`
    - _Requirements: 12.1_
    - _Design: Correctness Properties 11_

- [ ] 13. Checkpoint — server services complete
  - Ensure all unit tests for fingerprint, bugState, and cursor pass. Ensure `server/src/` compiles without errors. Ask the user if questions arise.

- [ ] 14. Bug routes, controllers, and ingest routes
  - [ ] 14.1 Create Zod schemas: `ingestSchema`, `bugPatchSchema` (with `.refine` and `.strict()`), `statusSchema`, `commentSchema`, `bugListQuery`
    - _Requirements: 4.5, 5.3, 7.6, 7.8, 7.9, 9.5, 9.6, 11.7_
    - _Design: API Route Map > Zod Validation Schemas_
  - [ ] 14.2 Create `server/src/controllers/bugController.js` — `list`: apply filters + cursor pagination via `cursor.js`, return 200 with bugs array + `nextCursor`; `detail`: return bug + ordered BugEvents; `patchMetadata`: call conditional update, return 200 or 409; `transitionStatus`: call `bugStateService.transition`, return 200; `addComment`: create BugEvent, return 201; `deleteComment`: verify author, delete BugEvent, return 204
    - _Requirements: 7.1–7.9, 8.1–8.4, 9.1–9.6, 10.1–10.6, 11.1–11.7_
    - _Design: Service Interfaces, Cursor Pagination_
  - [ ] 14.3 Create `server/src/routes/bugs.js` — wire `GET /:bugId`, `PATCH /:bugId`, `POST /:bugId/status`, `POST /:bugId/comments`, `DELETE /:bugId/comments/:eventId` with `authenticate`, `requireMember` (Mode B), `validate`, and controllers; mount at `/api/bugs`
    - _Requirements: 7–11, 13_
    - _Design: API Route Map_
  - [ ] 14.4 Create `server/src/controllers/ingestController.js` — member route handler (delegates to `ingestService.ingest`); API key route handler: hash `x-api-key` header, find project by `ingestKeyHash`, call `ingestService.ingest`; both return 200 with `{ id, fingerprint, occurrenceCount, status, regressions }`
    - _Requirements: 4.1–4.5, 5.1–5.4_
    - _Design: Service Interfaces_
  - [ ] 14.5 Create `server/src/routes/ingest.js` — wire `POST /api/projects/:id/ingest` (authenticate + requireMember Mode A + validate + ingestController.member) and `POST /api/ingest` (validate + ingestController.apiKey); mount both in `index.js`
    - _Requirements: 4.1–4.5, 5.1–5.4_
    - _Design: API Route Map_
  - [ ] 14.6 Add `GET /:id/bugs` route to `projects.js` router — wire `authenticate`, `requireMember` (Mode A), `validate(bugListQuery)`, `bugController.list`
    - _Requirements: 7.1–7.9_
    - _Design: API Route Map_
  - [ ]* 14.7 Write property test for optimistic locking
    - **Property 9: Optimistic locking rejects stale writes** — submitting an update with a stale `__v` or mismatched `status` SHALL return HTTP 409 and leave the Bug unchanged
    - File: `server/tests/integration/concurrency.property.test.js`
    - _Requirements: 9.2, 10.5, 19.5_
    - _Design: Correctness Properties 9_
  - [ ]* 14.8 Write property test for cursor pagination completeness
    - **Property 10: Cursor pagination covers all results exactly once** — paginating through all pages for N > page-size bugs SHALL yield exactly N bugs, no duplicates, no omissions, in descending `lastSeen` order
    - File: `server/tests/integration/pagination.property.test.js`
    - _Requirements: 7.1, 7.6_
    - _Design: Correctness Properties 10_

- [ ] 15. Checkpoint — server complete
  - Ensure Express app starts cleanly and all server-side routes are registered. Ask the user if questions arise.

- [ ] 16. Client bootstrap and API layer
  - [ ] 16.1 Initialise Vite + React project in `client/` (`npm create vite@latest client -- --template react`); install `react-router-dom`; configure `vite.config.js` proxy for `/api` to `http://localhost:<PORT>`
    - _Requirements: 14, 15, 16, 17, 18_
    - _Design: Architecture > Directory Structure_
  - [ ] 16.2 Create `client/src/api/auth.js` — `login(email,password)`, `signup(email,password)`, `logout()`, `me()` — thin `fetch` wrappers with `credentials:'include'`; throw `{ error, code }` on non-2xx
    - _Requirements: 14.2, 14.3, 14.6_
    - _Design: React Component and Page Structure > API Layer_
  - [ ] 16.3 Create `client/src/api/projects.js` — `listProjects()`, `createProject(name)`, `addMember(projectId,email)`, `generateKey(projectId)`
    - _Requirements: 15.1, 15.2_
    - _Design: React Component and Page Structure > API Layer_
  - [ ] 16.4 Create `client/src/api/bugs.js` — `listBugs(projectId,params)`, `getBug(bugId)`, `patchBug(bugId,data)`, `transitionStatus(bugId,data)`, `addComment(bugId,body)`, `deleteComment(bugId,eventId)`
    - _Requirements: 16.1, 17.1_
    - _Design: React Component and Page Structure > API Layer_
  - [ ] 16.5 Create `client/src/api/ingest.js` — `ingestError(projectId,message,stack)`
    - _Requirements: 18.1, 18.2_
    - _Design: React Component and Page Structure > API Layer_

- [ ] 17. React Router setup and protected route wrapper
  - [ ] 17.1 Create `client/src/App.jsx` — set up React Router v6 routes: `/login`→`LoginPage`, `/signup`→`SignupPage`, `/projects`→`ProjectListPage`, `/projects/:id/bugs`→`BugListPage`, `/bugs/:bugId`→`BugDetailPage`; implement `ProtectedRoute` component that calls `api/auth.me()` and redirects to `/login` if unauthenticated
    - _Requirements: 14.1, 14.6_
    - _Design: React Component and Page Structure > Routing_

- [ ] 18. Auth pages and NavBar
  - [ ] 18.1 Create `client/src/components/NavBar.jsx` — displays logout button when authenticated; calls `api/auth.logout()` on click; redirects to `/login` on 204
    - _Requirements: 14.6_
    - _Design: React Component and Page Structure > Components_
  - [ ] 18.2 Create `client/src/pages/LoginPage.jsx` — email + password form; client-side validation (non-empty, email format, password ≥8 chars) without submission; calls `api/auth.login()`; redirects to `/projects` on 200; inline error on 4xx
    - _Requirements: 14.1, 14.2, 14.4, 14.5_
    - _Design: React Component and Page Structure > Pages_
  - [ ] 18.3 Create `client/src/pages/SignupPage.jsx` — same pattern as LoginPage; calls `api/auth.signup()`; redirects to `/projects` on 201
    - _Requirements: 14.3, 14.4, 14.5_
    - _Design: React Component and Page Structure > Pages_

- [ ] 19. Project list page and form
  - [ ] 19.1 Create `client/src/components/ProjectForm.jsx` — inline create-project form; client-side validation (non-empty name); calls `api/projects.createProject()`; on 201 prepends project to list; inline error on 4xx; no full page reload
    - _Requirements: 15.2, 15.3, 15.4_
    - _Design: React Component and Page Structure > Components_
  - [ ] 19.2 Create `client/src/pages/ProjectListPage.jsx` — fetch and display projects list (name + owner email) on mount; render `ProjectForm`; protected by `ProtectedRoute`
    - _Requirements: 15.1, 15.2_
    - _Design: React Component and Page Structure > Pages_

- [ ] 20. Bug list page, filter bar, paste error box, and infinite scroll
  - [ ] 20.1 Create `client/src/components/BugFilters.jsx` — controlled inputs for `status`, `severity`, `assignee`, and search text; debounced 300 ms; emits filter change to parent
    - _Requirements: 16.3_
    - _Design: React Component and Page Structure > Components_
  - [ ] 20.2 Create `client/src/components/PasteErrorBox.jsx` — two textareas (`message` max 2000, `stack` max 50000); submit calls `api/ingest.ingestError()`; on 200 display returned `status` + `occurrenceCount` inline and clear inputs; on error display inline error and retain values
    - _Requirements: 18.1–18.4_
    - _Design: React Component and Page Structure > Components_
  - [ ] 20.3 Create `client/src/pages/BugListPage.jsx` — fetch paginated bugs for project on mount; render each bug's `title`, `status`, `severity`, `occurrenceCount`, `regressions`, `lastSeen`; empty-state message when no bugs; render `BugFilters` and reload bugs within 300 ms of filter change; infinite scroll: on scroll to bottom with `nextCursor` present, fetch next page and append; inline retry on next-page fetch failure; render `PasteErrorBox`
    - _Requirements: 16.1–16.5_
    - _Design: React Component and Page Structure > Pages_

- [ ] 21. Bug detail page — timeline, status actions, comment form
  - [ ] 21.1 Create `client/src/components/BugTimeline.jsx` — render ordered BugEvents ascending by `createdAt`; switch on `type`: occurrence (show `occurrenceCount`), status_changed (show `from`→`to`), comment (show `body` + author + delete button if own comment)
    - _Requirements: 17.1_
    - _Design: React Component and Page Structure > Components_
  - [ ] 21.2 Create `client/src/components/StatusActions.jsx` — render one button per legal next status (from `TRANSITIONS`) for the bug's current status; on click call `api/bugs.transitionStatus()`; on 200 update displayed status and append `status_changed` event to timeline; inline error on 4xx/5xx
    - _Requirements: 17.2, 17.3, 17.4_
    - _Design: React Component and Page Structure > Components_
  - [ ] 21.3 Create `client/src/components/CommentForm.jsx` — textarea + submit; calls `api/bugs.addComment()`; on 201 appends new comment to timeline and clears input; inline error on failure
    - _Requirements: 17.5, 17.4_
    - _Design: React Component and Page Structure > Components_
  - [ ] 21.4 Create `client/src/pages/BugDetailPage.jsx` — fetch bug + events on mount; display `title`, `status`, `severity`, `assignee`, `occurrenceCount`, `regressions`, `lastSeen`, `fingerprint`; render `BugTimeline`, `StatusActions`, `CommentForm`
    - _Requirements: 17.1–17.5_
    - _Design: React Component and Page Structure > Pages_

- [ ] 22. Checkpoint — client complete
  - Ensure the React app builds without errors (`npm run build`). Verify routing and protected routes work. Ask the user if questions arise.

- [ ] 23. Jest configuration and test DB setup
  - [ ] 23.1 Create Jest config in `server/jest.config.js` — configure for ESM (`transform`, `extensionsToTreatAsEsm`), set `testEnvironment: 'node'`, point `globalSetup` and `globalTeardown` to setup files
    - _Requirements: 19.7_
    - _Design: Testing Strategy > Test Database Isolation_
  - [ ] 23.2 Create `server/tests/globalSetup.js` — connect to `TEST_MONGODB_URI`; create `server/tests/globalTeardown.js` — drop all collections; create `server/tests/helpers/db.js` — `clearCollections()` helper for between-test cleanup
    - _Requirements: 19.7_
    - _Design: Testing Strategy > Test Database Isolation_

- [ ] 24. Fingerprint unit tests
  - [ ] 24.1 Create `server/tests/unit/fingerprint.test.js` — table-driven Jest tests covering: UUID removal, hex sequence removal (4+ chars), numeric ID removal, `line:col` removal, whitespace collapsing, `errorType` extraction (present, absent→`UnknownError`), stack frame normalization (present, anonymous→`"anonymous"`, absent); include at least 2 false-merge cases with inline comments explaining why they merge; include at least 2 false-split cases with inline comments explaining why they split; each case asserts deterministic 16-hex output
    - _Requirements: 19.1, 6.1–6.6_
    - _Design: Testing Strategy > Unit Tests_

- [ ] 25. Bug state service unit tests
  - [ ] 25.1 Create `server/tests/unit/bugState.test.js` — test all 9 legal transitions (accept, return updated bug, append event); test all 12 illegal transitions (throw `AppError(422,'ILLEGAL_TRANSITION')`); test stale `__v` → 409; run against real test DB (or mock `Bug.findOneAndUpdate`)
    - _Requirements: 19.4, 10.1, 10.2_
    - _Design: Testing Strategy > Unit Tests_

- [ ] 26. Cursor unit tests
  - [ ] 26.1 Create `server/tests/unit/cursor.test.js` — encode/decode round-trip (various dates and IDs); malformed or missing tokens throw `AppError(400,'INVALID_CURSOR')`
    - _Requirements: 7.9_
    - _Design: Testing Strategy > Unit Tests_

- [ ] 27. Auth integration tests
  - [ ] 27.1 Create `server/tests/integration/auth.test.js` — test signup success (201, cookie set, user fields), duplicate email (409), login success (200, cookie), wrong password (401), logout (204, cookie cleared), `GET /me` with valid cookie (200), `GET /me` with missing/expired cookie (401), validation errors (400) for each invalid field
    - _Requirements: 1.1–1.9, 19_
    - _Design: Testing Strategy > Integration Tests_

- [ ] 28. Project integration tests
  - [ ] 28.1 Create `server/tests/integration/projects.test.js` — test create project (201, owner set), list projects (own + member), add member by email (200), add member unknown email (404), add member non-owner (404), duplicate member (409), unauthenticated requests (401), validation errors (400), generate API key (201 + plaintext shown once), rotate key (new key invalidates old), non-owner key generation (404)
    - _Requirements: 2.1–2.8, 3.1–3.6, 19.6_
    - _Design: Testing Strategy > Integration Tests_

- [ ] 29. Ingest integration tests
  - [ ] 29.1 Create `server/tests/integration/ingest.test.js` — test member ingest (200, correct fields), same message twice (occurrenceCount=2, 1 Bug doc), non-member (404), invalid body (400), API key ingest (200), invalid API key (401), missing fields (400); verify both routes return same response shape
    - _Requirements: 4.1–4.5, 5.1–5.4, 19_
    - _Design: Testing Strategy > Integration Tests_

- [ ] 30. Concurrency and regression integration tests
  - [ ] 30.1 Create `server/tests/integration/concurrency.test.js` — send 20 concurrent identical ingest requests via `Promise.all`; assert exactly 1 Bug document exists and `occurrenceCount === 20`
    - _Requirements: 19.2_
    - _Design: Testing Strategy > Integration Tests_
  - [ ] 30.2 Create `server/tests/integration/regression.test.js` — create bug, transition to `fixed`, ingest new occurrence; assert `status === 'open'`, `regressions === 1`, event log contains `status_changed` before `occurrence` in ascending `createdAt` order
    - _Requirements: 19.3, 4.2_
    - _Design: Testing Strategy > Integration Tests_

- [ ] 31. Bug integration tests
  - [ ] 31.1 Create `server/tests/integration/bugs.test.js` — test list bugs (filters: status, severity, assignee, search, pagination with cursor), bug detail + timeline (all event types), PATCH metadata (success, 409 stale, 400 validation), status transition (success, 422 illegal, 409 stale, 404 not found), add comment (201), delete own comment (204), delete other's comment (403), non-member 404 on every route
    - _Requirements: 7.1–7.9, 8.1–8.4, 9.1–9.6, 10.1–10.6, 11.1–11.7, 19.6_
    - _Design: Testing Strategy > Integration Tests_

- [ ] 32. Authorization integration test
  - [ ] 32.1 Create `server/tests/integration/authorization.test.js` — user B (not a member of user A's project) attempts every applicable route (`GET /projects/:id/bugs`, `POST /projects/:id/ingest`, `GET /bugs/:bugId`, `PATCH /bugs/:bugId`, `POST /bugs/:bugId/status`, `POST /bugs/:bugId/comments`, `DELETE /bugs/:bugId/comments/:eventId`, `GET /projects/:id/stats`); assert HTTP 404 on every route
    - _Requirements: 19.6, 13.1–13.5_
    - _Design: Testing Strategy > Integration Tests_

- [ ] 33. README
  - [ ] 33.1 Create `README.md` at workspace root — sections: Project Overview, Prerequisites, Setup (clone, install, `.env` configuration from `.env.example`), Running the App (server + client commands), Running Tests (unit, integration, property-based, `TEST_MONGODB_URI`), Design Notes (Bug Identity, Append-Only Event Log, Fingerprint Limitations, Optimistic Locking, Non-Atomic Gap Between Bug Update and Event Insert)
    - _Requirements: 19_
    - _Design: README Design Notes_
  - [ ] 33.2 Create `server/.env.example` — include keys `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV`, `PORT` with placeholder values; no real secrets
    - _Design: Architecture_

- [ ] 34. Final checkpoint — full suite passes
  - Run `npm test` in `server/`; confirm all unit, integration, and property-based tests pass against `TEST_MONGODB_URI`. Run `npm run build` in `client/`; confirm clean build. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests require `fast-check`; each test annotates its property number in a comment: `// Feature: devloop-mini, Property N: <text>`
- Checkpoints (tasks 13, 15, 22, 34) are integration gates — do not proceed past one if tests or builds are failing
- All service functions throw `AppError`; controllers never contain business logic
- The `ingestService` and `bugStateService` use two-step MongoDB writes (Bug doc + BugEvent); this is a documented trade-off, not a bug
- `requireMember` is the single authorization middleware; it must never read `projectId` from body or query

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "4.1"] },
    { "id": 4, "tasks": ["3.1", "3.2", "3.3", "5.1"] },
    { "id": 5, "tasks": ["3.4", "6.1", "6.2", "7.1", "7.2"] },
    { "id": 6, "tasks": ["3.5", "8.1", "9.1"] },
    { "id": 7, "tasks": ["6.3", "8.2", "8.3"] },
    { "id": 8, "tasks": ["6.4", "10.1"] },
    { "id": 9, "tasks": ["11.1", "10.2", "10.3", "10.4"] },
    { "id": 10, "tasks": ["11.2", "11.3", "12.1"] },
    { "id": 11, "tasks": ["12.2", "14.1"] },
    { "id": 12, "tasks": ["14.2"] },
    { "id": 13, "tasks": ["14.3", "14.4", "14.5", "14.6"] },
    { "id": 14, "tasks": ["14.7", "14.8", "16.1"] },
    { "id": 15, "tasks": ["16.2", "16.3", "16.4", "16.5"] },
    { "id": 16, "tasks": ["17.1"] },
    { "id": 17, "tasks": ["18.1", "18.2", "18.3"] },
    { "id": 18, "tasks": ["19.1", "20.1", "20.2"] },
    { "id": 19, "tasks": ["19.2", "20.3"] },
    { "id": 20, "tasks": ["21.1", "21.2", "21.3"] },
    { "id": 21, "tasks": ["21.4"] },
    { "id": 22, "tasks": ["23.1", "23.2"] },
    { "id": 23, "tasks": ["24.1", "25.1", "26.1"] },
    { "id": 24, "tasks": ["27.1", "28.1"] },
    { "id": 25, "tasks": ["29.1", "30.1", "30.2"] },
    { "id": 26, "tasks": ["31.1", "32.1"] },
    { "id": 27, "tasks": ["33.1", "33.2"] }
  ]
}
```
