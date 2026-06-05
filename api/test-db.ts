import pg from 'pg';
const { Pool } = pg;

const DEFAULT_DATABASE_URL = "postgresql://neondb_owner:npg_AnK9Zla0JfiQ@ep-ancient-king-acvx7r22-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require";

export default async function handler(req: any, res: any) {
  let connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  
  // Limpeza de segurança para Vercel
  try {
    const urlObj = new URL(connectionString);
    urlObj.searchParams.delete("channel_binding");
    connectionString = urlObj.toString();
  } catch(e) {}

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    await pool.end();
    return res.status(200).json({ success: true, message: "Conexão direta OK!", time: result.rows[0].now });
  } catch (error: any) {
    await pool.end();
    return res.status(500).json({ success: false, error: error.message });
  }
}
