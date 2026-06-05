import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { initDb, pool } from "./src/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON request limit increased to support large backup restorations
  app.use(express.json({ limit: "15mb" }));

  // Initialize DB tables and seed if empty
  try {
    await initDb();
    console.log("Neon PostgreSQL connected and configured successfully.");
  } catch (err) {
    console.error("Critical: Failed to connect or initialize PostgreSQL database:", err);
  }

  // --- API ROUTES ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date() });
  });

  // Fetch all invoices mapped with their items
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

      // Group items by invoice_id
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

      // Assemble full invoice models compatible with Frontend
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

  // Save a new invoice (along with nested items)
  app.post("/api/invoices", async (req, res) => {
    const { id, number, supplierName, supplierCode, issueDate, dueDate, paymentDate, expectedTotal, items } = req.body;
    
    if (!id || !number || !supplierName || !supplierCode || !issueDate || !dueDate || expectedTotal === undefined) {
      return res.status(400).json({ error: "Required invoice fields are missing." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      // Insert invoice header
      await client.query(
        `INSERT INTO invoices (id, number, supplier_name, supplier_code, issue_date, due_date, payment_date, expected_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, number, supplierName, supplierCode, issueDate, dueDate, paymentDate || null, expectedTotal]
      );

      // Insert items
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

  // Update an existing invoice (along with updating items list)
  app.put("/api/invoices/:id", async (req, res) => {
    const invoiceId = req.params.id;
    const { number, supplierName, supplierCode, issueDate, dueDate, paymentDate, expectedTotal, items } = req.body;

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      // Check if invoice exists
      const checkExist = await client.query("SELECT id FROM invoices WHERE id = $1", [invoiceId]);
      if (checkExist.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Invoice not found or deleted." });
      }

      // Update invoice header
      await client.query(
        `UPDATE invoices 
         SET number = $1, supplier_name = $2, supplier_code = $3, issue_date = $4, due_date = $5, payment_date = $6, expected_total = $7
         WHERE id = $8`,
        [number, supplierName, supplierCode, issueDate, dueDate, paymentDate || null, expectedTotal, invoiceId]
      );

      // Delete old items and insert fresh current list (Clean replacement strategy)
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

  // Delete invoice
  app.delete("/api/invoices/:id", async (req, res) => {
    const invoiceId = req.params.id;
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      
      // Explicitly delete invoice_items first to cover cases where ON DELETE CASCADE is missing
      await client.query("DELETE FROM invoice_items WHERE invoice_id = $1", [invoiceId]);
      
      // Now delete the invoice itself
      await client.query("DELETE FROM invoices WHERE id = $1", [invoiceId]);
      
      await client.query("COMMIT");
      res.json({ success: true, message: "Invoice deleted." });
    } catch (err: any) {
      if (client) await client.query("ROLLBACK");
      console.error("Error deleting invoice:", err);
      res.status(500).json({ error: "Failed to delete invoice from Neon DB.", details: err.message });
    } finally {
      if (client) client.release();
    }
  });

  // Batch restore backup from JSON
  app.post("/api/invoices/restore", async (req, res) => {
    const invoices = req.body;
    if (!Array.isArray(invoices)) {
      return res.status(400).json({ error: "Invalid backup data layout." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      // Step 1: Wipe existing records (Explicit delete to handle lack of cascade delete)
      await client.query("DELETE FROM invoice_items");
      await client.query("DELETE FROM invoices");

      // Step 2: Insert backup
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

  // --- VITE DEV INTERFACE OR PRODUCTION COMPILED CLIENT MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server currently listening on port ${PORT}`);
  });
}

startServer();
