import { pool } from '../src/db';

export default async function handler(req: any, res: any) {
  // Pega o ID tanto da query ?id= quanto do final da URL
  const { id: queryId } = req.query;
  const pathParts = req.url.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  const id = queryId || (lastPart !== 'invoices' ? lastPart : null);
  
  const { method } = req;

  try {
    const client = await pool.connect();
    
    // LISTAR
    if (method === 'GET' && !id) {
       const result = await client.query(`
        SELECT i.*, 
        COALESCE(json_agg(item.*) FILTER (WHERE item.id IS NOT NULL), '[]') as items
        FROM invoices i
        LEFT JOIN invoice_items item ON i.id = item.invoice_id
        GROUP BY i.id
        ORDER BY i.issue_date DESC
      `);
      client.release();
      return res.status(200).json(result.rows);
    }

    // EXCLUIR
    if (method === 'DELETE' && id) {
      const result = await client.query("DELETE FROM invoices WHERE id = $1", [id]);
      client.release();
      return res.status(200).json({ success: true });
    }

    // CRIAR
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
      client.release();
      return res.status(201).json({ success: true });
    }

    // ALTERAR (PUT)
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
      client.release();
      return res.status(200).json({ success: true });
    }

    client.release();
    return res.status(404).json({ error: 'Rota ou ID não encontrado' });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
