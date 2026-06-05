/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface InvoiceItem {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
}

export interface Invoice {
  id: string;
  number: string;
  supplierName: string; // Fixed to "TOTVS SA"
  supplierCode: string; // Fixed to "000462"
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  paymentDate?: string; // YYYY-MM-DD (optional, undefined if unpaid)
  expectedTotal: number; // Total value specified on invoice header
  items: InvoiceItem[];
}

export interface PriceHistoryEntry {
  date: string;
  invoiceNumber: string;
  unitPrice: number;
}

export interface PriceAlert {
  itemDescription: string;
  previousPrice: number;
  currentPrice: number;
  percentIncrease: number;
  invoiceNumber: string;
  date: string;
}
