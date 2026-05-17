import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const t = await pool.query(
    "SELECT to_regclass('public.identity_verification_submissions') AS tbl",
  );
  console.log("table:", t.rows[0]?.tbl);

  const user = await pool.query("SELECT id, email FROM users LIMIT 1");
  if (!user.rows[0]) {
    console.log("no users");
    process.exit(0);
  }
  const userId = user.rows[0].id;
  console.log("test user:", user.rows[0].email, userId);

  const ins = await pool.query(
    `INSERT INTO identity_verification_submissions (
       user_id, status, id_doc_type, id_storage_key, id_content_type, id_file_name,
       id_document_base64, ssn_last4, phone_country_code, phone_number, email,
       street, city, state_province, postal_code, country, vendor_fields
     ) VALUES (
       $1::uuid, 'pending', 'passport', 'inline:test', 'image/png', 'test.png',
       'dGVzdA==', '1234', '+1', '5551234567', $2,
       '1 Main', 'City', 'ST', '12345', 'US', $3::jsonb
     )
     RETURNING id`,
    [userId, user.rows[0].email, JSON.stringify({})],
  );
  console.log("insert ok:", ins.rows[0].id);
  await pool.query("DELETE FROM identity_verification_submissions WHERE id = $1", [
    ins.rows[0].id,
  ]);
  console.log("cleanup ok");

  const pending = await pool.query(
    `SELECT s.id FROM identity_verification_submissions s
     JOIN users u ON u.id = s.user_id WHERE s.status = 'pending' LIMIT 1`,
  );
  console.log("pending join ok, count sample:", pending.rowCount);
} catch (e) {
  console.error("FAIL:", e.message);
  console.error(e);
  process.exit(1);
} finally {
  await pool.end();
}
