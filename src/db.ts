import pg from 'pg';
import { Invoice } from './types';

const { Pool } = pg;

// Neon Connection String from the user
const DEFAULT_DATABASE_URL = "postgresql://neondb_owner:npg_AnK9Zla0JfiQ@ep-ancient-king-acvx7r22-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require";
let connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

// Limpeza automática de parâmetros do Neon que o node-postgres não suporta
if (connectionString) {
  try {
    const urlObj = new URL(connectionString);
    urlObj.searchParams.delete("channel_binding");
    connectionString = urlObj.toString();
  } catch (e) {
    console.error("Erro ao tratar string de conexão:", e);
  }
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }, 
  max: 1, 
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
});

// Default initial invoices for Neon DB seeding if database is empty
const INITIAL_INVOICES_SEED: Invoice[] = [
  {
    id: 'mock-1',
    number: 'RPS-000149463',
    supplierName: 'TOTVS SA',
    supplierCode: '000462',
    issueDate: '2026-03-05',
    dueDate: '2026-03-20',
    paymentDate: '2026-03-18',
    expectedTotal: 15393.72,
    items: [
      { id: 'item-1-1', description: 'INTERA COMBO 4 VAR 1 AO 4', unitPrice: 1743.57, quantity: 4 },
      { id: 'item-1-2', description: 'INTERA COMBO 4 VAR 5 AO 10', unitPrice: 1403.24, quantity: 6 }
    ]
  },
  {
    id: 'mock-2',
    number: 'RPS-000149464',
    supplierName: 'TOTVS SA',
    supplierCode: '000462',
    issueDate: '2026-04-05',
    dueDate: '2026-04-20',
    paymentDate: '2026-04-20',
    expectedTotal: 15741.04,
    items: [
      { id: 'item-2-1', description: 'INTERA COMBO 4 VAR 1 AO 4', unitPrice: 1830.40, quantity: 4 },
      { id: 'item-2-2', description: 'INTERA COMBO 4 VAR 5 AO 10', unitPrice: 1403.24, quantity: 6 }
    ]
  },
  {
    id: 'mock-3',
    number: 'RPS-000149465',
    supplierName: 'TOTVS SA',
    supplierCode: '000462',
    issueDate: '2026-05-02',
    dueDate: '2026-05-18',
    paymentDate: undefined,
    expectedTotal: 16276.60,
    items: [
      { id: 'item-3-1', description: 'INTERA COMBO 4 VAR 1 AO 4', unitPrice: 1830.40, quantity: 4 },
      { id: 'item-3-2', description: 'INTERA COMBO 4 VAR 5 AO 10', unitPrice: 1492.50, quantity: 6 }
    ]
  }
];

export async function initDb() {
  const client = await pool.connect();
  try {
    console.log('--- DB INITIALIZATION started ---');
    
    // Create Invoices Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(50) PRIMARY KEY,
        number VARCHAR(100) NOT NULL,
        supplier_name VARCHAR(255) NOT NULL,
        supplier_code VARCHAR(100) NOT NULL,
        issue_date VARCHAR(10) NOT NULL,
        due_date VARCHAR(10) NOT NULL,
        payment_date VARCHAR(10),
        expected_total NUMERIC(12, 2) NOT NULL
      )
    `);

    // Create Invoice Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id VARCHAR(50) PRIMARY KEY,
        invoice_id VARCHAR(50) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        unit_price NUMERIC(12, 2) NOT NULL,
        quantity INTEGER NOT NULL
      )
    `);

    console.log('Tables verified and created successfully.');

    // Seed if empty
    const checkCount = await client.query('SELECT COUNT(*) FROM invoices');
    const invoiceCount = parseInt(checkCount.rows[0].count, 10);
    
    if (invoiceCount === 0) {
      console.log('Invoices table is empty, seeding defaults...');
      for (const inv of INITIAL_INVOICES_SEED) {
        await client.query(
          `INSERT INTO invoices (id, number, supplier_name, supplier_code, issue_date, due_date, payment_date, expected_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [inv.id, inv.number, inv.supplierName, inv.supplierCode, inv.issueDate, inv.dueDate, inv.paymentDate || null, inv.expectedTotal]
        );

        for (const item of inv.items) {
          await client.query(
            `INSERT INTO invoice_items (id, invoice_id, description, unit_price, quantity)
             VALUES ($1, $2, $3, $4, $5)`,
            [item.id, inv.id, item.description, item.unitPrice, item.quantity]
          );
        }
      }
      console.log('Default database records successfully seeded.');
    } else {
      console.log(`Database already contain ${invoiceCount} invoices.`);
    }
  } catch (err) {
    console.error('Error initializing tables:', err);
    throw err;
  } finally {
    client.release();
  }
}
