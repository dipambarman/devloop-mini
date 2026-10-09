# DevLoop Mini: engineering rules (always follow)

## Stack
MERN: Node 20 (ESM), Express, MongoDB Atlas via Mongoose, React + Vite.
Auth: bcrypt + JWT in HttpOnly cookie. Validation: zod. Tests: Jest + Supertest.
No new dependencies without stating why in the task summary.

## Structure
server/src/{config,models,routes,controllers,services,middleware,utils}
client/src/{pages,components,api}
Business logic lives in services/, never in route handlers.

## Core domain rules (do not deviate)
1. IDENTITY: a Bug is one distinct failure per project. Identity = fingerprint.
   Enforced by a UNIQUE compound index {project, fingerprint}. Ingest must use an
   atomic findOneAndUpdate upsert and retry once on duplicate key (code 11000).
   Never implement as find-then-insert.
2. FINGERPRINT: pure function in utils/fingerprint.js. Normalize message (ids, uuids,
   hex, line:col, numbers, whitespace) + error type + top stack frame as
   function@file with NO line numbers; sha1, 16 hex chars. Must be deterministic
   and unit-tested.
3. STATUS is a state machine in services/bugState.js with an explicit TRANSITIONS table.
   open -> in_progress|wontfix; in_progress -> open|fixed; fixed -> open; wontfix -> open.
   Illegal transition = 422. Handlers may not set status directly.
4. HISTORY is append-only: BugEvent documents are never updated or deleted.
   Every occurrence and every status change writes an event.
5. CONCURRENCY: writes to a bug use a conditional filter on the version (__v) and
   the current status. No match = 409. Never blind-overwrite.
6. REGRESSION: an occurrence on a 'fixed' bug atomically reopens it,
   increments regressions, and writes a status_changed event.
7. AUTHORIZATION derives from the resource: bug -> project -> membership, loaded in one
   reusable middleware. Never trust a projectId from the client for bug/comment routes.
   Non-members get 404, identical to "does not exist".
8. INGEST API KEYS: random 32 bytes, store only SHA-256, show plaintext once.

## Quality
Consistent error JSON {error, code}. Correct status codes. No secrets in code or repo;
.env.example only. Small, readable functions. Every domain rule above gets a test.
Comment the WHY on non-obvious decisions, not the what.