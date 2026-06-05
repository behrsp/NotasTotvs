import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { initDb, pool } from "./src/db";

const app = express();
const PORT = 3000;

// JSON request limit increased to support large backup restorations
app.use(express.json({ limit: "15mb" }));

// Lazy Database Initialization Middleware
let isDbInitialized = false;
async function ensureDb() {
  if (!isDbInitialized) {
    await initDb();
    isDbInitialized = true;
  }
}

app.use(async (req, res, next) => {
  if (req.path.startsWith("/api")) {
    try {
      await ensureDb();
    } catch (err: any) {
      console.error("Failed lazy db connection:", err);
    }
  }
  next();
});

// --- API ROUTES ---

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

app.get("/api/invoices", async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const invoicesQuery = `
      SELECT 
        id, number, supplier_name as "supplierName", supplier_code as "supplierCode", 
        issue_date as "issueDate", due_date as "dueDate", payment_date as "paymentDate", 
        expected_total::float as "expectedTotal" 
      FROM invoices 
      ORDER BY issue_date DESC
    `;
    const invoicesResult = await client.query(invoicesQuery);

    const itemsQuery = `
      SELECT 
        id, invoice_id as "invoiceId", description, 
        unit_price::float as "unitPrice", quantity 
      FROM invoice_items
    `;
    const itemsResult = await client.query(itemsQuery);

    const itemsByInvoice: Record<string, any[]> = {};
    itemsResult.rows.forEach(item => {
      const invId = item.invoiceId;
      if (!itemsByInvoice[invId]) {
        itemsByInvoice[invId] = [];
      }
      itemsByInvoice[invId].push({
        id: item.id,
        description: item.description,
        unitPrice: item.unitPrice,
        quantity: item.quantity
      });
    });

    const invoices = invoicesResult.rows.map(inv => ({
      id: inv.id,
      number: inv.number,
      supplierName: inv.supplierName,
      supplierCode: inv.supplierCode,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      paymentDate: inv.paymentDate || undefined,
      expectedTotal: inv.expectedTotal,
      items: itemsByInvoice[inv.id] || []
    }));

    res.json(invoices);
  } catch (err: any) {
    console.error("Error executing database query:", err);
    res.status(500).json({ error: "Failed to fetch invoices from the database.", details: err.message });
  } finally {
    if (client) client.release();
  }
});

app.post("/api/invoices", async (req, res) => {
  const { id, number, supplierName, supplierCode, issueDate, dueDate, paymentDate, expectedTotal, items } = req.body;
  if (!id || !number || !supplierName || !supplierCode || !issueDate || !dueDate || expectedTotal === undefined) {
    return res.status(400).json({ error: "Required invoice fields are missing." });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO invoices (id, number, supplier_name, supplier_code, issue_date, due_date, payment_date, expected_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, number, supplierName, supplierCode, issueDate, dueDate, paymentDate || null, expectedTotal]
    );
    if (Array.isArray(items)) {
      for (const item of items) {
        await client.query(
          `INSERT INTO invoice_items (id, invoice_id, description, unit_price, quantity)
           VALUES ($1, $2, $3, $4, $5)`,
          [item.id || String(Date.now() + Math.random()), id, item.description, item.unitPrice, item.quantity]
        );
      }
    }
    await client.query("COMMIT");
    res.status(201).json({ success: true, message: "Invoice successfully created." });
  } catch (err: any) {
    if (client) await client.query("ROLLBACK");
    console.error("Error creating invoice:", err);
    res.status(500).json({ error: "Failed to persist invoice into Neon DB.", details: err.message });
  } finally {
    if (client) client.release();
  }
});

app.put("/api/invoices/:id", async (req, res) => {
  const invoiceId = req.params.id;
  const { number, supplierName, supplierCode, issueDate, dueDate, paymentDate, expectedTotal, items } = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const checkExist = await client.query("SELECT id FROM invoices WHERE id = $1", [invoiceId]);
    if (checkExist.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Invoice not found or deleted." });
    }
    await client.query(
      `UPDATE invoices 
       SET number = $1, supplier_name = $2, supplier_code = $3, issue_date = $4, due_date = $5, payment_date = $6, expected_total = $7
       WHERE id = $8`,
      [number, supplierName, supplierCode, issueDate, dueDate, paymentDate || null, expectedTotal, invoiceId]
    );
    await client.query("DELETE FROM invoice_items WHERE invoice_id = $1", [invoiceId]);
    if (Array.isArray(items)) {
      for (const item of items) {
        await client.query(
          `INSERT INTO invoice_items (id, invoice_id, description, unit_price, quantity)
           VALUES ($1, $2, $3, $4, $5)`,
          [item.id || String(Date.now() + Math.random()), invoiceId, item.description, item.unitPrice, item.quantity]
        );
      }
    }
    await client.query("COMMIT");
    res.json({ success: true, message: "Invoice successfully updated." });
  } catch (err: any) {
    if (client) await client.query("ROLLBACK");
    console.error("Error updating invoice:", err);
    res.status(500).json({ error: "Failed to update invoice in Neon DB.", details: err.message });
  } finally {
    if (client) client.release();
  }
});

app.delete("/api/invoices/:id", async (req, res) => {
  const invoiceId = req.params.id;
  let client;
  try {
    client = await pool.connect();
    // O banco já possui ON DELETE CASCADE, então deletar da 'invoices' remove os itens automaticamente.
    // Deletamos em uma transação para garantir consistência.
    await client.query("BEGIN");
    const result = await client.query("DELETE FROM invoices WHERE id = $1", [invoiceId]);
    await client.query("COMMIT");

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Nota fiscal não encontrada no banco de dados." });
    }

    res.json({ success: true, message: "Nota fiscal excluída com sucesso." });
  } catch (err: any) {
    if (client) await client.query("ROLLBACK");
    console.error("ERRO CRITICAL NO NEON DB (DELETE):", err);
    res.status(500).json({ 
      error: "Erro interno ao excluir do banco Neon.", 
      details: err.message,
      code: err.code // O Postgres envia códigos de erro úteis
    });
  } finally {
    if (client) client.release();
  }
});

app.post("/api/invoices/restore", async (req, res) => {
  const invoices = req.body;
  if (!Array.isArray(invoices)) {
    return res.status(400).json({ error: "Invalid backup data layout." });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("DELETE FROM invoice_items");
    await client.query("DELETE FROM invoices");
    for (const inv of invoices) {
      await client.query(
        `INSERT INTO invoices (id, number, supplier_name, supplier_code, issue_date, due_date, payment_date, expected_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [inv.id, inv.number, inv.supplierName, inv.supplierCode, inv.issueDate, inv.dueDate, inv.paymentDate || null, inv.expectedTotal]
      );
      if (Array.isArray(inv.items)) {
        for (const item of inv.items) {
          await client.query(
            `INSERT INTO invoice_items (id, invoice_id, description, unit_price, quantity)
             VALUES ($1, $2, $3, $4, $5)`,
            [item.id, inv.id, item.description, item.unitPrice, item.quantity]
          );
        }
      }
    }
    await client.query("COMMIT");
    res.json({ success: true, count: invoices.length });
  } catch (err: any) {
    if (client) await client.query("ROLLBACK");
    console.error("Error restoring database backup:", err);
    res.status(500).json({ error: "Failed to restore database backup into Neon DB.", details: err.message });
  } finally {
    if (client) client.release();
  }
});

// Wrap async startup and middleware loading in a function to avoid active top-level awaits in CJS compilation target
async function setupViteOrStaticAndListen() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // ESM/CJS relative path resolution for static assets directory
    let currentDirname = "";
    try {
      currentDirname = path.dirname(fileURLToPath(import.meta.url));
    } catch {
      currentDirname = __dirname;
    }
    const distPath = path.join(currentDirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server currently listening on port ${PORT}`);
    });
  }
}

setupViteOrStaticAndListen().catch((err) => {
  console.error("Initialization of Vite/static handling failed:", err);
});

export default app;
