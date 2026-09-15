// Applies pending SQL files from supabase/migrations to the database in
// DATABASE_URL (.env.local), each in its own transaction, and records them
// in private.schema_migrations.
//
//   npm run db:migrate                 apply every pending migration
//   npm run db:migrate -- --status     list applied / pending
//   npm run db:migrate -- --mark FILE  record FILE as applied without running it

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "supabase", "migrations");

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
  const match = env.match(/^DATABASE_URL=(.*)$/m);
  if (!match) throw new Error("DATABASE_URL is not set in .env.local");
  return match[1].trim().replace(/^["']|["']$/g, "");
}

async function main() {
  const args = process.argv.slice(2);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({
    connectionString: databaseUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query(`
      create schema if not exists private;
      create table if not exists private.schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);
    const { rows } = await client.query(
      "select name from private.schema_migrations",
    );
    const applied = new Set(rows.map((r) => r.name));

    if (args[0] === "--mark") {
      for (const name of args.slice(1)) {
        if (!files.includes(name)) throw new Error(`No migration named ${name}`);
        await client.query(
          "insert into private.schema_migrations (name) values ($1) on conflict do nothing",
          [name],
        );
        console.log(`marked  ${name}`);
      }
      return;
    }

    const pending = files.filter((f) => !applied.has(f));

    if (args[0] === "--status") {
      for (const f of files)
        console.log(`${applied.has(f) ? "applied" : "pending"}  ${f}`);
      return;
    }

    if (pending.length === 0) {
      console.log("Database is up to date.");
      return;
    }

    for (const name of pending) {
      const sql = fs.readFileSync(path.join(dir, name), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into private.schema_migrations (name) values ($1)",
          [name],
        );
        await client.query("commit");
        console.log(`applied ${name}`);
      } catch (error) {
        await client.query("rollback");
        throw new Error(`${name} failed: ${error.message}`);
      }
    }

    // Let the Supabase API see new tables and columns right away
    await client.query("notify pgrst, 'reload schema'");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
