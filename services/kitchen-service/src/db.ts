import { SQL } from "bun";

// Single shared Postgres connection for this service, built from DATABASE_URL.
// Tagged-template queries (db`...`) are automatically parameterized.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Provide DATABASE_URL env!");

export const db = new SQL(databaseUrl);
