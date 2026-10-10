import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from the server directory (one level up from src/config)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const REQUIRED_VARS = ['MONGODB_URI', 'JWT_SECRET', 'PORT', 'NODE_ENV'];

for (const varName of REQUIRED_VARS) {
  if (!process.env[varName]) {
    throw new Error(`Missing required env var: ${varName}`);
  }
}

export const MONGODB_URI = process.env.MONGODB_URI;
export const JWT_SECRET = process.env.JWT_SECRET;
export const PORT = process.env.PORT;
export const NODE_ENV = process.env.NODE_ENV;
