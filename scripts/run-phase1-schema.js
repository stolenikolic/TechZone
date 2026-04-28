/**
 * Run Tech Zone Phase 1 schema against Supabase.
 * Requires DATABASE_URL in .env.local (Supabase Dashboard > Project Settings > Database > Connection string, URI).
 */
const { readFileSync, existsSync } = require("fs");
const { join } = require("path");
const { Client } = require("pg");

const root = join(__dirname, "..");
const envPath = join(root, ".env.local");
if (existsSync(envPath)) {
  const env = readFileSync(envPath, "utf8");
  env.split("\n").forEach((line) => {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) {
      const key = line.slice(0, i).trim();
      const val = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (key && val) process.env[key] = val;
    }
  });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "DATABASE_URL is not set. Add it to .env.local from Supabase Dashboard > Project Settings > Database > Connection string (URI), then run: node scripts/run-phase1-schema.js"
  );
  process.exit(1);
}

const sqlPath = join(root, "supabase", "migrations", "00001_tech_zone_phase1_schema.sql");
const sql = readFileSync(sqlPath, "utf8");

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(sql);
    console.log("Phase 1 schema executed successfully.");
    const r = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log("Tables in public schema:", r.rows.map((x) => x.table_name).join(", "));
  } catch (e) {
    console.error("Execution failed:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
