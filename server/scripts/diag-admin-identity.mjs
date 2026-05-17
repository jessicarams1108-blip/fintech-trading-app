import "dotenv/config";
import pg from "pg";
import jwt from "jsonwebtoken";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = process.argv[2] || "http://127.0.0.1:4000";

console.log("API base:", base);

const health = await fetch(`${base}/health`);
console.log("GET /health", health.status, await health.text());

const adminEmail = (process.env.ADMIN_PRIMARY_EMAIL ?? "Hardewusi@gmail.com").toLowerCase();
const { rows: admins } = await pool.query(
  "SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1",
  [adminEmail],
);
if (!admins[0]) {
  console.error("No admin user for", adminEmail);
  process.exit(1);
}

const token = jwt.sign(
  { sub: admins[0].id, email: admins[0].email },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

const res = await fetch(`${base}/api/admin/identity-verifications/pending`, {
  headers: { Authorization: `Bearer ${token}` },
});
const text = await res.text();
console.log("GET /api/admin/identity-verifications/pending", res.status);
console.log(text.slice(0, 1200));

try {
  const { rows } = await pool.query(
    `SELECT s.id, (s.id_document_base64 IS NOT NULL) AS has_inline_document,
            s.vendor_fields, s.created_at
     FROM identity_verification_submissions s
     WHERE s.status = 'pending' LIMIT 3`,
  );
  console.log("DB pending sample:", JSON.stringify(rows, null, 2).slice(0, 800));
  JSON.stringify(rows);
  console.log("JSON.stringify(rows) OK");
} catch (e) {
  console.error("DB/JSON error:", e);
}

await pool.end();
