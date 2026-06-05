import { pool } from '../src/db';

export default async function handler(req: any, res: any) {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    return res.status(200).json({ 
      success: true, 
      message: "Conexão com Neon OK!", 
      database_time: result.rows[0].now 
    });
  } catch (error: any) {
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
}
