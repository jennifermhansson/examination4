import { SQL } from "bun";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Provide DATABASE_URL env!");

const db = new SQL(databaseUrl);

// Insert the menu products. ON CONFLICT (name) DO NOTHING makes this
// idempotent, so running the seed repeatedly will not create duplicates.
// Customers are no longer seeded here: authentication was removed and
// customers are created on demand from the order form instead.
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

async function runSeed() {
  try {
    await seedProducts();
    console.log("Seed completed");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

await runSeed();
