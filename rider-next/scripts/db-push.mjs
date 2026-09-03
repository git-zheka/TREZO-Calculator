// Застосовує db/schema.sql до бази з DATABASE_URL.
// Ідемпотентно: усі create ... if not exists, тож можна ганяти скільки завгодно разів.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не заданий. Створи .env.local за зразком .env.example");
  process.exit(1);
}

const sql = neon(url);
const text = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

// У схемі немає функцій із тілом, тож поділ по ';' наприкінці рядка безпечний.
const statements = text
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter((s) => s && !s.split("\n").every((l) => l.trim().startsWith("--") || !l.trim()));

for (const statement of statements) {
  await sql.query(statement);
  const head = statement.split("\n").find((l) => l.trim() && !l.trim().startsWith("--")) ?? "";
  console.log("✓", head.slice(0, 72));
}
console.log("Схема застосована.");
