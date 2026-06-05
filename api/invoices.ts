import pg from 'pg';
const { Pool } = pg;

const DEFAULT_DATABASE_URL = "postgresql://neondb_owner:npg_AnK9Zla0JfiQ@ep-ancient-king-acvx7r22-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require";

export default async function handler(req: any, res: any) {
  let connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  try {
    const urlObj = new URL(connectionString);
    urlObj.searchParams.delete("channel_binding");
    connectionString = urlObj.toString();
  } catch(e) {}

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1
  });

  const { id: queryId } = req.query;
  const pathParts = req.url.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  const id = queryId || (lastPart !== 'invoices' ? lastPart : null);
  const { method } = req;

  let client;
  try {
    client = await pool.connect();
    
    if (method === 'GET' && !id) {
       // Mapeando nomes do Banco (snake_case) para o Frontend (camelCase)
       const result = await client.query(`
        SELECT 
          i.id, 
          i.number, 
          i.supplier_name as "supplierName", 
          i.supplier_code as "supplierCode", 
          i.issue_date as "issueDate", 
          i.due_date as "dueDate", 
          i.payment_date as "paymentDate", 
          CAST(i.expected_total AS FLOAT) as "expectedTotal",
          COALESCE(
            (
              SELECT json_agg(json_build_object(
                'id', item.id,
                'description', item.description,
                'unitPrice', CAST(item.unit_price AS FLOAT),
                'quantity', item.quantity
              ))
              FROM invoice_items item
              WHERE item.invoice_id = i.id
            ), 
            '[]'
          ) as items
        FROM invoices i
        ORDER BY i.issue_date DESC
      `);
      return res.status(200).json(result.rows);
    }

    if (method === 'DELETE' && id) {
      await client.query("DELETE FROM invoices WHERE id = $1", [id]);
      return res.status(200).json({ success: true });
    }

    if (method === 'POST') {
      const { id: newId, number, supplierName, supplierCode, issueDate, dueDate, paymentDate, expectedTotal, items } = req.body;
      await client.query(
        'INSERT INTO invoices (id, number, supplier_name, supplier_code, issue_date, due_date, payment_date, expected_total) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [newId, number, supplierName, supplierCode, issueDate, dueDate, paymentDate || null, expectedTotal]
      );
      for (const item of items) {
        await client.query(
          'INSERT INTO invoice_items (id, invoice_id, description, unit_price, quantity) VALUES ($1, $2, $3, $4, $5)',
          [item.id || String(Date.now() + Math.random()), newId, item.description, item.unitPrice, item.quantity]
        );
      }
      return res.status(201).json({ success: true });
    }

    if (method === 'PUT' && id) {
      const { number, supplierName, supplierCode, issueDate, dueDate, paymentDate, expectedTotal, items } = req.body;
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
    }

    return res.status(404).json({ error: 'Not found' });

  } catch (error: any) {
    if (client && (method === 'PUT' || method === 'POST')) {
      try { await client.query("ROLLBACK"); } catch(e) {}
    }
    return res.status(500).json({ error: error.message });
  } finally {
    if (client) client.release();
    await pool.end();
  }
}
