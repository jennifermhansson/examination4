import { SQL } from "bun";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Provide DATABASE_URL env!");

const db = new SQL(databaseUrl);

async function seedProducts() {
  await db`
    INSERT INTO products (name, description, price)
    VALUES
      ('Cheeseburger', 'Classic cheeseburger', 7900),
      ('Hamburger', '100% beef', 8900),
      ('Fries', 'Crispy fries', 2900),
      ('Cola', '33cl soda', 1900),
      ('Milkshake', 'Vanilla', 3900)
    ON CONFLICT (name) DO NOTHING
  `;
  console.log("Products seeded");
}

async function seedUsers() {
  const bcrypt = await import("bcryptjs");

  const customerHash = await bcrypt.hash("customer123", 12);
  await db`
    INSERT INTO customers (id, username, email, password_hash, role)
    VALUES ('00000000-0000-0000-0000-000000000001', 'customer', 'customer@test.se', ${customerHash}, 'customer')
    ON CONFLICT (email) DO NOTHING
  `;
  console.log("Customer user seeded");

  const kitchenHash = await bcrypt.hash("kitchen123", 12);
  await db`
    INSERT INTO customers (id, username, email, password_hash, role)
    VALUES ('00000000-0000-0000-0000-000000000002', 'kitchen', 'kitchen@restaurant.se', ${kitchenHash}, 'kitchen')
    ON CONFLICT (email) DO NOTHING
  `;
  console.log("Kitchen user seeded");
}

async function runSeed() {
  try {
    await seedProducts();
    await seedUsers();
    console.log("Seed completed");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

await runSeed();
