import { db } from "../../db/client";
import type { CustomerRow } from "../../types/db";
import type { RegisterRequest } from "../../types/http";

export async function insertOne(input: RegisterRequest) {
  const now = new Date().toISOString();

  const [created] = await db<CustomerRow[]>`
    INSERT INTO customers 
      (username, email, phone, birthdate, password, created_at, updated_at) 
    VALUES 
      (${input.username}, ${input.email}, ${input.phone}, ${input.birthdate}, ${input.password}, ${now}, ${now})
    RETURNING *
  `;

  if (!created) throw new Error("Failed to create user");

  return created;
}
export async function getByUsername(username: string) {
  const [customer] = await db`
    SELECT * FROM customers where username = ${username}`;

  return customer || null;
}
