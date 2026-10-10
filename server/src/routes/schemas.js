import { z } from 'zod';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projectSchema = z.object({
  name: z.string().min(1).max(100),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
});

// ---------------------------------------------------------------------------
// Bugs & Ingest
// ---------------------------------------------------------------------------

export const ingestSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().min(1).max(50000),
});

export const bugPatchSchema = z
  .object({
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    assignee: z.string().optional(), // assuming objectId as string
  })
  .refine((data) => data.severity || data.assignee, {
    message: 'at least one field required',
  })
  .strict();

export const statusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'fixed', 'wontfix']),
  version: z.number().int(),
});

export const bugListQuery = z.object({
  status: z.enum(['open', 'in_progress', 'fixed', 'wontfix']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignee: z.string().optional(),
  search: z.string().optional(),
  skip: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
