import { SQL } from "bun";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Provide DATABASE_URL env!");

const db = new SQL(databaseUrl);

async function seedProducts() {
  await db`
    INSERT INTO products (name, description, price)
    VALUES
      ('Cheeseburgare', 'Klassisk cheeseburgare', 7900),
      ('Hamburgare', '100% nötkött', 8900),
      ('Pommes', 'Krispiga pommes', 2900),
      ('Cola', '33cl läsk', 1900),
      ('Milkshake', 'Vanilj', 3900)
    ON CONFLICT (name) DO NOTHING
  `;
  console.log("Products seeded");
}

async function seedKitchenUser() {
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("kitchen123", 12);

  await db`
    INSERT INTO customers (username, role, email, phone, birthdate, password_hash)
    VALUES (
      'kitchen',
      'kitchen',
      'kitchen@restaurant.se',
      '+46701234567',
      '1990-01-01',
      ${passwordHash}
    )
    ON CONFLICT (email) DO NOTHING
  `;
  console.log("Kitchen user seeded");
}

async function runSeed() {
  try {
    await seedProducts();
    await seedKitchenUser();
    console.log("Seed completed");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

await runSeed();
