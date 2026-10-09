# Requirements Document

## Introduction

DevLoop Mini is an error-tracking and bug-collaboration tool built for developers who work with AI coding assistants. The core problem it solves is bug identity loss: the same failure recurs across files and sessions, but flat ticket lists treat each recurrence as a new bug. DevLoop Mini models a bug as a persistent identity with a fingerprint, occurrence count, regression history, and an append-only event timeline. It provides ingest from both a logged-in UI and a lightweight API key–authenticated reporter snippet, a state-machine–driven status workflow, team project membership, and a minimal React UI.

---

## Glossary

- **System**: The DevLoop Mini application, comprising the Express API server and the React client.
- **Auth_Service**: The server-side module responsible for signup, login, logout, and identity verification via JWT stored in an HttpOnly cookie.
- **Project**: A named workspace owned by one user; other users may be added as members by the owner.
- **Member**: A user who has been added to a project by the project owner and holds read/write access to that project's bugs.
- **Ingest_Service**: The shared server-side service function that accepts an error message and stack trace, computes a fingerprint, upserts the Bug record, increments occurrence count, handles regression, and appends events.
- **Bug**: A persistent record representing one distinct failure within a project, identified by its fingerprint. Never duplicated; updated on each occurrence.
- **Fingerprint**: A 16-hex-character SHA-1 hash computed from the normalized error message, error type, and top stack frame (function@file, no line numbers). Computed by a pure function in `utils/fingerprint.js`.
- **BugEvent**: An append-only document recording either an occurrence or a status/comment change on a Bug.
- **Bug_State_Machine**: The explicit transitions table in `services/bugState.js` governing legal Bug status changes.
- **Ingest_API_Key**: A random 32-byte key shown to the project owner once in plaintext; stored server-side as its SHA-256 hash only.
- **Stats_Service**: The aggregation pipeline that produces per-project counts grouped by status and severity.
- **Cursor_Pagination**: Pagination over Bug lists using a compound cursor of `(lastSeen, _id)` to support stable, efficient iteration.
- **Validator**: The Zod-based request validation layer applied to all incoming request bodies and query parameters.

---

## Requirements

### Requirement 1: User Authentication

**User Story:** As a developer, I want to create an account and log in securely, so that I can access my projects and bugs without exposing credentials.

#### Acceptance Criteria

1. WHEN a POST request is received at `/api/auth/signup` with a valid `email` (RFC 5322 format) and a `password` of at least 8 characters, THE Auth_Service SHALL create a new user record with the password stored as a secure hash and return a JWT in an HttpOnly cookie with HTTP 201 and the user's `id` and `email`.
2. WHEN a POST request is received at `/api/auth/signup` and the email already exists, THE Auth_Service SHALL return HTTP 409 with `{ "error": "Email already registered", "code": "EMAIL_TAKEN" }`.
3. WHEN a POST request is received at `/api/auth/login` with credentials matching an existing user, THE Auth_Service SHALL issue a new JWT in an HttpOnly cookie and return HTTP 200 with the user's `id` and `email`.
4. WHEN a POST request is received at `/api/auth/login` with an unrecognized email or incorrect password, THE Auth_Service SHALL return HTTP 401 with `{ "error": "Invalid credentials", "code": "INVALID_CREDENTIALS" }`.
5. WHEN a POST request is received at `/api/auth/logout`, THE Auth_Service SHALL clear the JWT cookie and return HTTP 204.
6. WHEN a GET request is received at `/api/auth/me` with a valid, non-expired JWT cookie, THE Auth_Service SHALL return HTTP 200 with the authenticated user's `id` and `email`.
7. IF a request is received at `/api/auth/me` with a missing, malformed, incorrectly-signed, or expired JWT, THEN THE Auth_Service SHALL return HTTP 401 with `{ "error": "Unauthorized", "code": "UNAUTHORIZED" }`.
8. IF a signup or login request is received with a missing `email`, a missing `password`, an `email` that is not in RFC 5322 format, or a `password` shorter than 8 characters, THEN THE Validator SHALL return HTTP 400 with an error message indicating which field failed validation.
9. THE System SHALL issue JWTs with an expiry of 24 hours from the time of issuance.

---

### Requirement 2: Project Management

**User Story:** As a project owner, I want to create projects and invite members by email, so that my team can collaborate on tracking bugs together.

#### Acceptance Criteria

1. WHEN an authenticated user sends a POST request to `/api/projects` with a valid `name` between 1 and 100 characters, THE System SHALL create a new project with the requesting user as `owner`, return HTTP 201, and include the project's `id`, `name`, and `owner` in the response body.
2. WHEN an authenticated user sends a GET request to `/api/projects`, THE System SHALL return HTTP 200 with the list of all projects where the user is the owner or a member.
3. WHEN an authenticated owner sends a POST request to `/api/projects/:id/members` with a valid `email`, THE System SHALL add the identified user as a member of the project and return HTTP 200 with the added member's `id` and `email` in the response body.
4. IF the `email` provided to add a member does not correspond to a registered user, THEN THE System SHALL return HTTP 404 with `{ "error": "User not found", "code": "USER_NOT_FOUND" }`.
5. IF a non-owner member sends a POST request to `/api/projects/:id/members`, THEN THE System SHALL return HTTP 404, indistinguishable from a non-existent project.
6. IF an unauthenticated user sends any request to `/api/projects`, THEN THE System SHALL return HTTP 401 with `{ "error": "Unauthorized", "code": "UNAUTHORIZED" }`.
7. IF a project creation request contains a missing `name`, an empty `name`, or a `name` exceeding 100 characters, THEN THE Validator SHALL return HTTP 400 with an error message indicating which validation rule was violated.
8. IF the `email` provided to add a member belongs to a user who is already a member or is the project owner, THEN THE System SHALL return HTTP 409 with an error message indicating the user is already part of the project.

---

### Requirement 3: Ingest API Key Management

**User Story:** As a project owner, I want to generate an ingest API key for my project, so that I can embed a reporter snippet in my application to send errors automatically.

#### Acceptance Criteria

1. WHEN an authenticated owner sends a POST request to `/api/projects/:id/keys`, THE System SHALL generate a cryptographically random key, store only its hash on the project record, return HTTP 201 with the plaintext key in the response body, and include a message indicating the key will not be shown again.
2. IF an owner sends a second POST request to `/api/projects/:id/keys` when a key already exists, THEN THE System SHALL invalidate the previous key (so that it is rejected on subsequent ingest requests), generate a new one, and return HTTP 201 with the new plaintext key.
3. IF an unauthenticated user sends a POST request to `/api/projects/:id/keys`, THEN THE System SHALL return HTTP 401 with `{ "error": "Unauthorized", "code": "UNAUTHORIZED" }`.
4. IF an authenticated non-owner sends a POST request to `/api/projects/:id/keys`, THEN THE System SHALL return HTTP 404.
5. IF an owner sends a POST request to `/api/projects/:id/keys` where `:id` does not correspond to an existing project, THEN THE System SHALL return HTTP 404.
6. THE plaintext API key SHALL NOT appear in any subsequent API response or API-accessible log after the initial HTTP 201 response.

---

### Requirement 4: Error Ingest — Member Route

**User Story:** As a project member, I want to paste an error message and stack trace into the UI, so that the bug is recorded or updated in the project without leaving my development environment.

#### Acceptance Criteria

1. WHEN an authenticated member sends a POST request to `/api/projects/:id/ingest` with a `message` string of 1–2000 characters and a `stack` string of 1–50000 characters, THE Ingest_Service SHALL compute a Fingerprint, upsert the Bug record for that project and fingerprint, increment `occurrenceCount` by 1, update `lastSeen` to the current UTC time, append a `BugEvent` of type `occurrence`, and return HTTP 200 with the Bug's `id`, `fingerprint`, `occurrenceCount`, `status`, and `regressions`.
2. WHEN the ingest resolves to an existing Bug with status `fixed`, THE Ingest_Service SHALL atomically set the Bug status to `open`, increment `regressions` by 1, and append a `BugEvent` of type `status_changed` recording the regression before appending the `occurrence` event; IF this atomic operation fails, THE Ingest_Service SHALL leave the Bug record unchanged and return HTTP 500.
3. IF THE Ingest_Service receives a duplicate-key error (MongoDB code 11000) on the upsert, THEN THE Ingest_Service SHALL retry the upsert exactly once; IF the retry also fails with a duplicate-key error, THE Ingest_Service SHALL return HTTP 500.
4. IF a non-member authenticated user sends a POST request to `/api/projects/:id/ingest`, THEN THE System SHALL return HTTP 404, indistinguishable from a non-existent project.
5. IF an ingest request is received with a missing `message`, a missing `stack`, a `message` exceeding 2000 characters, or a `stack` exceeding 50000 characters, THEN THE Validator SHALL return HTTP 400 with an error message indicating which field(s) failed validation.

---

### Requirement 5: Error Ingest — API Key Route

**User Story:** As an application developer, I want my in-app reporter snippet to send errors via an API key, so that bugs are captured automatically from production without requiring a logged-in session.

#### Acceptance Criteria

1. WHEN a POST request is received at `/api/ingest` with an `x-api-key` header that matches a stored project key hash, and the request body contains `message` as a non-empty string up to 2000 characters and `stack` as a non-empty string up to 50000 characters, THE Ingest_Service SHALL execute the upsert, occurrence-recording, and regression-detection logic for the resolved project and return HTTP 200 with the Bug's `id`, `fingerprint`, `occurrenceCount`, `status`, and `regressions`.
2. IF the `x-api-key` header is absent or does not match any project's stored key hash, THEN THE System SHALL return HTTP 401 with `{ "error": "Invalid API key", "code": "INVALID_API_KEY" }`.
3. IF a POST request is received at `/api/ingest` with a valid `x-api-key` header and the request body is missing `message` or `stack`, or either field is not a string, THEN THE Ingest_Service SHALL return HTTP 400 with a body containing an error message indicating which field failed validation.
4. THE Ingest_Service SHALL accept the same request body structure (`message`, `stack`) and return the same response shape (`id`, `fingerprint`, `occurrenceCount`, `status`, `regressions`) for both the API key ingest route and the member session ingest route.

---

### Requirement 6: Bug Fingerprinting

**User Story:** As a developer, I want identical errors from different sessions to map to the same bug record, so that occurrence history is consolidated rather than fragmented.

#### Acceptance Criteria

1. THE Fingerprint function SHALL normalize the error message by removing UUIDs, hexadecimal sequences of 4 or more consecutive characters, numeric IDs, `line:col` references, trimming leading and trailing whitespace, and collapsing all internal whitespace runs to a single space before hashing.
2. THE Fingerprint function SHALL incorporate the error type (e.g., `TypeError`) and the top stack frame expressed as `function@file` with no line or column numbers; IF the top stack frame is absent, anonymous, or unparseable, THE Fingerprint function SHALL substitute the literal string `anonymous`.
3. THE Fingerprint function SHALL produce a 16-character lowercase hexadecimal string by taking the first 16 characters of the 40-character SHA-1 hex digest of the normalized input.
4. THE Fingerprint function SHALL produce the same output for the same normalized input on every invocation (determinism).
5. THE System SHALL enforce uniqueness of `(project, fingerprint)` via a UNIQUE compound index on the Bug collection, and THE Ingest_Service SHALL upsert the Bug atomically in a single operation on each new error event.
6. IF the error type field is absent or empty, THEN THE Fingerprint function SHALL substitute the literal string `UnknownError`.

---

### Requirement 7: Bug Listing and Search

**User Story:** As a project member, I want to browse, filter, and search bugs in a project, so that I can triage and prioritize issues efficiently.

#### Acceptance Criteria

1. WHEN an authenticated member sends a GET request to `/api/projects/:id/bugs`, THE System SHALL return HTTP 200 with a paginated list of Bugs sorted by `lastSeen` descending, including `id`, `title`, `status`, `severity`, `assignee`, `occurrenceCount`, `regressions`, and `lastSeen` for each Bug.
2. IF a `status` query parameter is present, THEN THE System SHALL filter the result set to Bugs matching that status value.
3. IF a `severity` query parameter is present, THEN THE System SHALL filter the result set to Bugs matching that severity value.
4. IF an `assignee` query parameter is present, THEN THE System SHALL filter the result set to Bugs assigned to the specified user ID.
5. IF a `search` query parameter is present, THEN THE System SHALL filter the result set to Bugs whose `title` field contains the search string (case-insensitive).
6. THE System SHALL implement Cursor_Pagination using a compound cursor of `(lastSeen, _id)`, return a default page of 20 bugs, accept a `limit` query parameter up to a maximum of 100, and return a `nextCursor` token in the response when additional results exist.
7. IF a non-member sends a GET request to `/api/projects/:id/bugs`, THEN THE System SHALL return HTTP 404.
8. IF a `status` or `severity` query parameter contains a value not in the defined enum, THEN THE System SHALL return HTTP 400 with an error message indicating the invalid value.
9. IF a `cursor` query parameter is present but malformed or unrecognized, THEN THE System SHALL return HTTP 400 with an error message indicating the cursor is invalid.

---

### Requirement 8: Bug Detail and Event Timeline

**User Story:** As a project member, I want to view the full history of a bug including all occurrences, status changes, and comments, so that I can understand how and when the issue evolved.

#### Acceptance Criteria

1. WHEN an authenticated member sends a GET request to `/api/bugs/:bugId`, THE System SHALL return HTTP 200 with the Bug's `id`, `title`, `status`, `severity`, `assignee`, `occurrenceCount`, `regressions`, `lastSeen`, `fingerprint`, and `project` fields.
2. WHEN an authenticated member sends a GET request to `/api/bugs/:bugId`, THE System SHALL include in the response an ordered list of associated BugEvents sorted by `createdAt` ascending, each containing `id`, `type`, `createdAt`, and type-specific payload fields (`body` for comments; `from` and `to` for status_changed; `occurrenceCount` for occurrence).
3. THE System SHALL derive project membership from the Bug's `project` reference and SHALL NOT trust a `projectId` supplied by the client for this route.
4. IF the Bug does not exist or the requesting user is not a member of the Bug's project, THEN THE System SHALL return HTTP 404 with `{ "error": "Not found", "code": "NOT_FOUND" }`.

---

### Requirement 9: Bug Metadata Updates

**User Story:** As a project member, I want to update the severity and assignee of a bug, so that the team can track ownership and priority.

#### Acceptance Criteria

1. WHEN an authenticated member sends a PATCH request to `/api/bugs/:bugId` with at least one of a `severity` value from `["low", "medium", "high", "critical"]` or an `assignee` value that is a valid project member ID, THE System SHALL apply the update using a conditional write filtered by `_id`, `__v` (Mongoose version key), and the current `status`, and return HTTP 200 with the updated Bug.
2. IF the conditional write finds no matching document (version or status mismatch), THEN THE System SHALL return HTTP 409 with `{ "error": "Conflict: stale version", "code": "STALE_VERSION" }`.
3. IF a non-member sends a PATCH request to `/api/bugs/:bugId`, THEN THE System SHALL return HTTP 404.
4. IF an authenticated member sends a PATCH request to `/api/bugs/:bugId` where `bugId` does not correspond to an existing Bug, THEN THE System SHALL return HTTP 404.
5. IF an authenticated member sends a PATCH request to `/api/bugs/:bugId` with a body containing no `severity` or `assignee` field, THEN THE Validator SHALL return HTTP 400 with an error message indicating that at least one updatable field is required.
6. IF an authenticated member sends a PATCH request to `/api/bugs/:bugId` with one or more fields outside `severity` and `assignee`, THEN THE Validator SHALL return HTTP 400 with an error message indicating which fields are not permitted.

---

### Requirement 10: Bug Status Transitions

**User Story:** As a project member, I want to advance or revert a bug's status through defined transitions, so that the team has a shared, auditable view of each bug's resolution state.

#### Acceptance Criteria

1. WHEN an authenticated member sends a POST request to `/api/bugs/:bugId/status` with a `status` field, THE Bug_State_Machine SHALL validate the transition against the TRANSITIONS table: `open → in_progress | wontfix`; `in_progress → open | fixed`; `fixed → open`; `wontfix → open`.
2. IF the requested transition is not present in the TRANSITIONS table, THEN THE Bug_State_Machine SHALL return HTTP 422 with `{ "error": "Illegal status transition", "code": "ILLEGAL_TRANSITION" }`.
3. WHEN a legal transition is validated by the Bug_State_Machine, THE System SHALL perform a conditional write filtered by `_id`, `__v`, and the current `status`, and return HTTP 200 with the updated Bug.
4. IF the conditional write for a status transition succeeds, THEN THE System SHALL append a BugEvent of type `status_changed` containing the `bugId`, the previous `status`, the new `status`, and the `memberId` of the requester.
5. IF the conditional write finds no matching document, THEN THE System SHALL return HTTP 409 with `{ "error": "Conflict: stale version", "code": "STALE_VERSION" }`.
6. IF an authenticated member sends a POST request to `/api/bugs/:bugId/status` where `bugId` does not correspond to an existing Bug, THEN THE System SHALL return HTTP 404.

---

### Requirement 11: Comments on Bugs

**User Story:** As a project member, I want to add and delete comments on a bug, so that my team can discuss the issue in context.

#### Acceptance Criteria

1. WHEN an authenticated member sends a POST request to `/api/bugs/:bugId/comments` with a `body` string of 1–5000 characters, THE System SHALL append a BugEvent of type `comment` with the author's user ID and the provided body, and return HTTP 201 with the created BugEvent's `id`, `type`, `body`, `authorId`, and `createdAt`.
2. WHEN an authenticated user sends a DELETE request to `/api/bugs/:bugId/comments/:eventId`, THE System SHALL verify that the requesting user is the author of that BugEvent, delete the BugEvent, and return HTTP 204.
3. IF the requesting user is not the author of the BugEvent targeted for deletion, THEN THE System SHALL return HTTP 403 with `{ "error": "Forbidden", "code": "FORBIDDEN" }`.
4. IF the BugEvent targeted for deletion does not exist, THEN THE System SHALL return HTTP 404.
5. IF the requesting user is not a member of the bug's project, THEN THE System SHALL return HTTP 404.
6. IF a comment creation request is received where the Bug does not exist, THEN THE System SHALL return HTTP 404.
7. IF a comment creation request body is missing a `body` field, contains an empty `body`, or contains a `body` exceeding 5000 characters, THEN THE Validator SHALL return HTTP 400 with an error message indicating which validation rule was violated.

---

### Requirement 12: Project Statistics

**User Story:** As a project member, I want to see counts of bugs grouped by status and severity, so that I can assess the health of my project at a glance.

#### Acceptance Criteria

1. WHEN an authenticated member sends a GET request to `/api/projects/:id/stats`, THE Stats_Service SHALL return HTTP 200 with two arrays: one grouping Bug counts by each valid status value (`open`, `in_progress`, `fixed`, `wontfix`) and one grouping Bug counts by each valid severity value (`low`, `medium`, `high`, `critical`), including zero-count groups.
2. IF a non-member sends a GET request to `/api/projects/:id/stats`, THEN THE System SHALL return HTTP 404.
3. IF the project `:id` does not correspond to an existing project, THEN THE System SHALL return HTTP 404.

---

### Requirement 13: Authorization Model

**User Story:** As a project owner, I want all access to my project's bugs and data to be restricted to project members, so that unauthorized users cannot read or modify my team's work.

#### Acceptance Criteria

1. FOR bug, comment, and ingest routes that reference a bug by ID, THE System SHALL derive project membership by loading the Bug's `project` reference and verifying the requesting user's membership, using a single reusable middleware function.
2. FOR project-scoped routes (e.g., `/api/projects/:id/bugs`, `/api/projects/:id/ingest`), THE System SHALL verify the requesting user's membership by checking the `:id` path parameter against the project's owner and members list, using the same reusable middleware function.
3. IF a user is not a member of the project associated with a resource they are requesting, THEN THE System SHALL return HTTP 404, indistinguishable from a non-existent resource.
4. IF a request to a bug or comment route includes a `projectId` in the request body or query string, THEN THE System SHALL silently ignore it and derive authorization from the resource reference only.
5. IF an unauthenticated user sends a request to any protected route, THEN THE System SHALL return HTTP 401 with `{ "error": "Unauthorized", "code": "UNAUTHORIZED" }`.

---

### Requirement 14: React UI — Authentication Pages

**User Story:** As a new user, I want to sign up and log in via a web interface, so that I can access DevLoop Mini from a browser.

#### Acceptance Criteria

1. WHEN the application loads and no authenticated session exists, THE System SHALL display a Login page with `email` and `password` fields and a submit button.
2. WHEN the Login page form is submitted with valid credentials, THE System SHALL call the login endpoint and redirect the user to the Project List page on HTTP 200.
3. WHEN the Signup page form is submitted with a valid email and password, THE System SHALL call the signup endpoint and redirect the user to the Project List page on HTTP 201.
4. WHEN the Auth_Service returns an HTTP 4xx response on login or signup, THE System SHALL display the error message inline on the relevant form without navigating away.
5. IF client-side validation detects a missing email, invalid email format, or password shorter than 8 characters before submission, THEN THE System SHALL display an inline validation message without submitting the request.
6. WHILE a user is authenticated, THE System SHALL display a logout button in a persistent navigation element visible on every page; WHEN the logout button is clicked, THE System SHALL call the logout endpoint and redirect to the Login page on HTTP 204.

---

### Requirement 15: React UI — Project List and Creation

**User Story:** As a developer, I want to view and create my projects from a dashboard, so that I can manage multiple codebases in one place.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to the Project List page, THE System SHALL display all projects the user owns or is a member of, showing each project's name and owner email.
2. WHEN the create-project form is submitted with a valid project name (1–100 non-whitespace-only characters), THE System SHALL call the project creation endpoint and prepend the new project to the displayed list without a full page reload.
3. WHEN the project creation endpoint returns an HTTP 4xx response, THE System SHALL display the error message inline in the create-project form without navigating away.
4. IF client-side validation detects a missing or empty project name before submission, THEN THE System SHALL display an inline validation message without submitting the request.

---

### Requirement 16: React UI — Bug List

**User Story:** As a project member, I want to see all bugs in a project with key metadata, so that I can quickly identify what needs attention.

#### Acceptance Criteria

1. WHEN an authenticated member navigates to a project's Bug List page, THE System SHALL display each Bug's `title`, `status`, `severity`, `occurrenceCount`, `regressions`, and `lastSeen`, sorted by `lastSeen` descending.
2. IF no bugs exist for a project, THEN THE System SHALL display an empty state message indicating there are no bugs yet.
3. THE System SHALL display filter controls for `status`, `severity`, and `assignee`, and a text search input; WHEN a filter or search value changes, THE System SHALL reload the bug list with the updated query parameters within 300 milliseconds of the last input change.
4. WHEN the user scrolls to the bottom of the Bug List and a `nextCursor` token is present in the last response, THE System SHALL fetch the next page and append the results to the displayed list.
5. IF the next-page fetch fails, THEN THE System SHALL display an inline error message with a retry option.

---

### Requirement 17: React UI — Bug Detail with Timeline

**User Story:** As a project member, I want to view the complete timeline and details of a single bug, so that I can understand its full history and take action.

#### Acceptance Criteria

1. WHEN an authenticated member navigates to a Bug Detail page, THE System SHALL display the Bug's `title`, `status`, `severity`, `assignee`, `occurrenceCount`, `regressions`, `lastSeen`, and `fingerprint`, followed by an ordered event timeline sorted by `createdAt` ascending showing all occurrences, status changes, and comments.
2. THE System SHALL display one action button per legal next status for the Bug's current status, labeled with the target status name.
3. WHEN a status action button is clicked, THE System SHALL call the status transition endpoint; on HTTP 200, THE System SHALL update the displayed status and append the new status_changed event to the timeline.
4. WHEN a status transition or comment submission returns an HTTP 4xx or 5xx response, THE System SHALL display the error message inline near the relevant control without navigating away.
5. THE System SHALL provide a comment input with a submit button on the Bug Detail page; WHEN the comment form is submitted, THE System SHALL call the comment creation endpoint and, on HTTP 201, append the new comment to the timeline and clear the input.

---

### Requirement 18: React UI — Paste an Error Box

**User Story:** As a developer, I want a quick text box to paste an error message and stack trace, so that I can ingest a bug without leaving the project view.

#### Acceptance Criteria

1. THE System SHALL provide a "Paste an Error" area on the Bug List page with two text inputs: `message` (max 2000 characters) and `stack` (max 50000 characters).
2. WHEN the paste-error form is submitted, THE System SHALL call the member ingest endpoint and display the returned Bug's `status` and `occurrenceCount` inline within the paste area.
3. WHEN the paste-error form is submitted successfully (HTTP 200), THE System SHALL clear both input fields after displaying the result.
4. IF the ingest endpoint returns an error, THEN THE System SHALL display the error message inline within the paste area and retain the submitted values in the input fields.

---

### Requirement 19: Test Coverage

**User Story:** As a maintainer, I want comprehensive automated tests covering all core domain rules, so that regressions are caught before deployment.

#### Acceptance Criteria

1. THE System SHALL include table-driven Jest unit tests for the Fingerprint function covering: message normalization (UUIDs, hex strings, numbers, whitespace), type extraction, stack frame normalization, at least 2 documented known false-merge cases, and at least 2 documented known false-split cases; each test case SHALL include an inline comment explaining why it merges or splits.
2. WHEN 20 concurrent identical ingest requests are sent to the same project, THE System SHALL produce exactly 1 Bug document and that Bug's `occurrenceCount` SHALL equal 20.
3. WHEN a new occurrence is ingested for a Bug with status `fixed`, THE System SHALL set the Bug's status to `open`, increment `regressions` by exactly 1, and the event log SHALL contain a `status_changed` event followed by an `occurrence` event in ascending `createdAt` order.
4. WHEN a status transition request specifies a transition not present in the TRANSITIONS table, THE System SHALL return HTTP 422.
5. WHEN a bug update or status change is submitted with a stale `__v` or mismatched `status`, THE System SHALL return HTTP 409.
6. WHEN user B attempts to read, modify, or ingest into a project owned by user A and user B is not a member, THE System SHALL return HTTP 404 for every applicable route.
7. THE System SHALL run all integration tests against a dedicated test MongoDB instance identified by a `TEST_MONGODB_URI` environment variable, isolated from the development and production databases.
