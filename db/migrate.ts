// Idempotent migration (CREATE TABLE IF NOT EXISTS) for the tables not created
// by db/01-init.sql: kitchen_orders and notifications. Runs once at startup via
// the seed service, before 02-seed.ts.
import { SQL } from "bun";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Provide DATABASE_URL env!");

const db = new SQL(databaseUrl);

async function migrate() {
  await db`
    CREATE TABLE IF NOT EXISTS kitchen_orders (
      id UUID PRIMARY KEY,
      customer_id UUID NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_price INTEGER NOT NULL,
      items JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL,
      order_id UUID,
      message TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  console.log("Migration completed");
}

await migrate();
