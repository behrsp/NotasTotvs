import { pool } from '../src/db';

export default async function handler(req: any, res: any) {
  const { method } = req;

  // Handle invoices list
  if (method === 'GET') {
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(`
        SELECT i.*, 
        COALESCE(
          json_agg(item.*) FILTER (WHERE item.id IS NOT NULL),
          '[]'
        ) as items
        FROM invoices i
        LEFT JOIN invoice_items item ON i.id = item.invoice_id
        GROUP BY i.id
        ORDER BY i.issue_date DESC
      `);
      return res.status(200).json(result.rows);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    } finally {
      if (client) client.release();
    }
  }

  // Handle invoice creation
  if (method === 'POST') {
    const { id, number, supplierName, supplierCode, issueDate, dueDate, paymentDate, expectedTotal, items } = req.body;
    let client;
    try {
      client = await pool.connect();
      await client.query(
        'INSERT INTO invoices (id, number, supplier_name, supplier_code, issue_date, due_date, payment_date, expected_total) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [id, number, supplierName, supplierCode, issueDate, dueDate, paymentDate || null, expectedTotal]
      );

      for (const item of items) {
        await client.query(
          'INSERT INTO invoice_items (id, invoice_id, description, unit_price, quantity) VALUES ($1, $2, $3, $4, $5)',
          [item.id || String(Date.now() + Math.random()), id, item.description, item.unitPrice, item.quantity]
        );
      }
      return res.status(201).json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    } finally {
      if (client) client.release();
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
