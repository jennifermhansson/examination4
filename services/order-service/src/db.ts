import { SQL } from "bun";

// Single shared Postgres connection pool for this service, created from the
// DATABASE_URL environment variable. Tagged-template queries (db`...`) are
// automatically parameterized, which prevents SQL injection.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Provide DATABASE_URL env!");

export const db = new SQL(databaseUrl);
