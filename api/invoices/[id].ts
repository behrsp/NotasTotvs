import { pool } from '../src/db';

export default async function handler(req: any, res: any) {
  const { id } = req.query;
  const { method } = req;

  if (method === 'DELETE') {
    let client;
    try {
      client = await pool.connect();
      const result = await client.query("DELETE FROM invoices WHERE id = $1", [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Nota não encontrada." });
      }
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    } finally {
      if (client) client.release();
    }
  }

  if (method === 'PUT') {
    const { number, supplierName, supplierCode, issueDate, dueDate, paymentDate, expectedTotal, items } = req.body;
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      
      await client.query(
        "UPDATE invoices SET number = $1, supplier_name = $2, supplier_code = $3, issue_date = $4, due_date = $5, payment_date = $6, expected_total = $7 WHERE id = $8",
        [number, supplierName, supplierCode, issueDate, dueDate, paymentDate || null, expectedTotal, id]
      );

      await client.query("DELETE FROM invoice_items WHERE invoice_id = $1", [id]);

      for (const item of items) {
        await client.query(
          "INSERT INTO invoice_items (id, invoice_id, description, unit_price, quantity) VALUES ($1, $2, $3, $4, $5)",
          [item.id || String(Date.now() + Math.random()), id, item.description, item.unitPrice, item.quantity]
        );
      }

      await client.query("COMMIT");
      return res.status(200).json({ success: true });
    } catch (error: any) {
      if (client) await client.query("ROLLBACK");
      return res.status(500).json({ error: error.message });
    } finally {
      if (client) client.release();
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
