import { db } from "./client";

async function seedProducts() {
  await db`
    INSERT INTO products (
      id,
      name,
      description,
      price
    )
    VALUES
(
  gen_random_uuid(),
  'Cheeseburgare',
  'Klassisk cheeseburgare',
  7900
),
(
  gen_random_uuid(),
  'Hamburgare',
  '100% nötkött',
  8900
),
(
  gen_random_uuid(),
  'Pommes',
  'Krispiga pommes',
  2900
),
(
  gen_random_uuid(),
  'Cola',
  '33cl läsk',
  1900
),
(
  gen_random_uuid(),
  'Milkshake',
  'Vanilj',
  3900
)

    ON CONFLICT (name) DO NOTHING;
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
