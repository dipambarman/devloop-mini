# DevLoop Mini

A bug tracker built for devs who work with AI coding tools.

The idea is simple — when you're building with tools like Cursor or Kiro, the same errors keep popping up across files and sessions. DevLoop Mini treats each unique error as a "bug" with its own identity, tracks every time it happens, detects regressions, and gives your team a timeline to see what went wrong and when.

Built with the MERN stack (MongoDB, Express, React, Node.js).

## What it does

- **Auth** — JWT-based signup/login with httpOnly cookies. No passwords stored in plain text, bcrypt handles hashing.
- **Projects** — Create a project, invite teammates by email. Only members can see/modify bugs in that project.
- **Error ingestion** — POST an error payload (message + stack trace) and the system figures out if it's a new bug or a repeat. Uses a fingerprinting algorithm that strips out noisy stuff like UUIDs, hex addresses, and line numbers before hashing.
- **Regression detection** — If a bug was marked "fixed" and the same error comes in again, it gets reopened automatically and the regression count goes up.
- **Bug timeline** — Every occurrence and status change is logged as an immutable event. You get a full history of what happened to each bug.
- **Concurrent editing** — Uses optimistic locking (version field) so two people editing the same bug don't silently overwrite each other.
- **Dark-mode UI** — React frontend with filtering, pagination, severity badges, and a timeline view.

## Tech stack

| Layer | Tech |
|-------|------|
| Database | MongoDB (Mongoose ODM) |
| Backend | Node.js + Express |
| Frontend | React (Vite) |
| Validation | Zod |
| Auth | JWT + bcrypt |
| Tests | Jest + Supertest |

## Project structure

```
devloop-mini/
├── client/               # React frontend (Vite)
│   └── src/
│       ├── pages/        # Login, Signup, ProjectList, BugList, BugDetail
│       ├── components/   # Shared UI components
│       └── api/          # API helper functions
├── server/               # Express backend
│   └── src/
│       ├── models/       # Mongoose schemas (User, Project, Bug, BugEvent)
│       ├── services/     # Business logic (auth, ingest, state machine)
│       ├── controllers/  # Route handlers
│       ├── routes/       # Express routers + Zod schemas
│       ├── middleware/   # Auth, error handler, project membership
│       └── utils/        # Fingerprinting, AppError helper
│   └── tests/
│       ├── unit/         # Fingerprint algo + state machine tests
│       └── integration/  # Full API tests (auth, bugs, projects, etc.)
└── .kiro/                # Kiro specs (requirements, design, tasks)
```

## Getting started

You'll need Node.js v20+ and a MongoDB instance (Atlas works fine).

```bash
git clone https://github.com/dipambarman/devloop-mini.git
cd devloop-mini
```

Install both sides:
```bash
cd server && npm install
cd ../client && npm install
```

Set up your env — copy the example and fill in your values:
```bash
cp server/.env.example server/.env
```

The `.env` needs these:
```
PORT=4000
MONGODB_URI=mongodb+srv://...your connection string...
TEST_MONGODB_URI=mongodb+srv://...separate db for tests...
JWT_SECRET=some-long-random-string
NODE_ENV=development
```

## Running it

Two terminals:

```bash
# Terminal 1 — backend
cd server
npm run dev

# Terminal 2 — frontend
cd client
npm run dev
```

Then open http://localhost:5173

## Running tests

56 tests across 8 suites — unit tests for the fingerprint algorithm and state machine, plus integration tests hitting the actual API with a real database.

```bash
cd server
npm test
```

Make sure `TEST_MONGODB_URI` points to a separate database so tests don't mess with your dev data.

## How I used Kiro

I used Kiro to plan and build this project. The `.kiro/` folder in the repo has the full spec — requirements, design doc, and task breakdown that Kiro generated.

Here's what I actually used it for:

- **Planning** — Wrote out the requirements and Kiro helped break them into a structured design doc and task list. The state machine for bug status transitions came out of that process.
- **Boilerplate** — Express server setup, Mongoose schemas, route wiring, middleware. The kind of stuff that's tedious to type out but needs to be right.
- **Fingerprinting logic** — The algorithm that normalizes error messages (stripping UUIDs, hex, line numbers) before hashing. I described what I wanted and iterated on the regex rules.
- **Tests** — Kiro wrote most of the test suite. I described the scenarios (concurrent ingests, illegal state transitions, authorization boundaries) and it generated the Jest/Supertest code.
- **Bug fixes** — When tests failed, I used Kiro to debug and fix issues like Zod schema ordering and mock setup problems.

The code is mine to explain and defend — Kiro was the tool, not the author.

## Design decisions worth mentioning

**Why fingerprinting?** — Two errors that look "the same" to a human might have different timestamps, line numbers, or memory addresses in them. The fingerprint algorithm strips all that noise and hashes what's left, so `TypeError at utils.js` on your machine matches the same error on mine.

**Why append-only events?** — Instead of mutating a bug's state and losing history, every change is a new event. This means you can always answer "what happened to this bug and when?"

**Why optimistic locking?** — Two devs open the same bug, both change the severity. Without versioning, the second save silently overwrites the first. With `__v` checking, the second save gets a 409 Conflict and can retry with fresh data.

**Known trade-off** — The ingest operation (update bug + create event) isn't wrapped in a transaction. There's a tiny window where a crash could leave the count updated without the corresponding event. I chose simplicity over strict ACID here since this is a dev tool, not a bank.
