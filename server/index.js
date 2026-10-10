// Import env config first so dotenv runs before any other module reads process.env
import './src/config/env.js';

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { connectDB } from './src/config/db.js';
import errorHandler from './src/middleware/errorHandler.js';
import authRouter from './src/routes/auth.js';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ── Auth routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

import projectsRouter from './src/routes/projects.js';
import bugsRouter from './src/routes/bugs.js';

// Route stubs will be mounted here as tasks progress, e.g.:
app.use('/api/projects', projectsRouter);
app.use('/api/bugs', bugsRouter);

// ── Global error handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB, server not started:', err.message);
    process.exit(1);
  });

export { app };
