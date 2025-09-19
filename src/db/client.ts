// lib/db/client.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import * as creatorSchema from './creator-schema';

const connectionString = process.env.DATABASE_URL!;
export const sql = neon(connectionString);

export const db = drizzle(sql, { schema: { ...schema, ...creatorSchema } });