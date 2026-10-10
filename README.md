# DevLoop Mini

DevLoop Mini is a simplified MERN-stack error tracking and bug collaboration tool designed specifically for developers building with AI coding tools. It addresses the core problem of error recurrences across files and sessions by treating bugs as persistent identities with occurrences, regressions, and an append-only timeline.

## Features
- **User Authentication:** Secure JWT-based signup, login, and session management.
- **Project Management:** Create projects and invite team members by email.
- **Bug Tracking & Ingestion:** REST API to ingest error payloads with automatic deduplication using intelligent stack-trace fingerprinting.
- **Interactive Timeline:** Append-only event log showing occurrences and status transitions over time.
- **Optimistic Concurrency:** Safe, concurrent bug updates (severity/status) using version locking.
- **Responsive UI:** Premium dark-mode interface with real-time filtering, pagination, and intuitive bug details.

## Technologies Used
- **MongoDB** (with Mongoose)
- **Express.js**
- **React.js** (via Vite)
- **Node.js**
- **Zod** (Validation)
- **Jest & Supertest** (Testing)

## AI Development Experience (Kiro)

During the development of this project, I used **Kiro** to accelerate the implementation and ensure high code quality. Kiro was particularly effective for generating boilerplate, writing tests, and implementing complex logic based on strict constraints. 

### Specific Tasks Supported by Kiro:
1. **API Creation & Routing:** Used Kiro to rapidly bootstrap the Express server, middleware (authentication, error handling, Zod validation), and route controllers for Auth, Projects, and Bugs.
2. **Database Integration:** Directed Kiro to create Mongoose schemas (`Bug`, `BugEvent`, `Project`, `User`) and complex aggregation/update queries (e.g., atomic `$inc` updates and optimistic locking).
3. **Component Development:** Leveraged Kiro to scaffold the React frontend, generate the premium dark-theme CSS tokens, and build components like `BugTimeline` and `FilterBar`.
4. **Complex Logic (Fingerprinting):** Used Kiro to implement the deterministic error fingerprinting algorithm using regex rules to strip volatile data (UUIDs, hex codes, line numbers) to prevent false splits/merges.
5. **Testing:** Instructed Kiro to write comprehensive Jest and Supertest suites for unit and integration testing, ensuring correct concurrency behavior and accurate state transitions.

## Prerequisites

- Node.js (v20+ recommended)
- MongoDB Atlas cluster (or local instance)

## Setup

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd devloop-mini
   ```

2. **Install dependencies:**
   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Configure Environment:**
   Copy `server/.env.example` to `server/.env` and update the values:
   ```bash
   cp server/.env.example server/.env
   ```
   *Note: `TEST_MONGODB_URI` must point to a separate database for running tests safely.*

## Running the App

Start the backend server and frontend dev server in separate terminals.

**Backend Server (Port 4000):**
```bash
cd server
npm run dev
```

**Frontend Client (Vite Proxy):**
```bash
cd client
npm run dev
```
Open `http://localhost:5173` in your browser.

## Running Tests

The server uses Jest and Supertest. It creates database collections and clears them, so make sure `TEST_MONGODB_URI` is correctly configured to a test database in `.env` (or pass it in the command line).

```bash
cd server
npm test
```

## Design Notes

### Bug Identity via Unique Index
A bug is uniquely identified by the combination of its `project` and `fingerprint`. This is strictly enforced at the database level using a compound unique index: `{ project: 1, fingerprint: 1 }`. This guarantees that concurrent ingests of the same error will hit a `DuplicateKeyError`, triggering a safe atomic upsert retry instead of creating duplicate bugs.

### Append-Only Event Log
We treat the `BugEvent` collection as an immutable, append-only ledger. Events (like `occurrence` and `status_changed`) are only inserted, never updated or deleted. This models the history of a bug explicitly, ensuring that a bug's lifecycle is a reliable timeline rather than a single mutated state.

### Fingerprint Limitations
The fingerprint algorithm strips highly volatile data (like UUIDs, timestamps, line numbers) but has known limitations:
- **False Merges**: Distinct errors that happen to throw the exact same generic message (e.g., "Timeout") from the exact same line in a utility function will produce the same fingerprint and merge into one bug.
- **False Splits**: The same logical error thrown from code deployed with different bundlers (which changes the file basename) or wrapped in different async handlers will produce different fingerprints and appear as separate bugs.

### Optimistic Locking
To prevent lost updates during concurrent edits (e.g., two developers changing severity or status at once), we use optimistic locking. The Mongoose `__v` field acts as the version token. Write operations (like `PATCH` or status transitions) require the client to supply the version they read. The database update filters on `{ _id, __v }`, and increments `__v`. If the document was modified in the interim, the write fails with a 409 Conflict.

### Non-Atomic Gap Between Bug Update and Event Insert
The ingest operation updates the `Bug` document and then creates a `BugEvent` in two separate operations, as MongoDB doesn't support multi-document transactions by default. This means there is a narrow window where a crash could leave the Bug's `occurrenceCount` updated without the corresponding `occurrence` event in the timeline. This is a deliberate design trade-off for simplicity and performance over strict ACID guarantees.
