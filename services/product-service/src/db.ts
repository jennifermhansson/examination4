import { SQL } from "bun";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Provide DATABASE_URL env!");

export const db = new SQL(databaseUrl);
