/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Invoice, PriceAlert, PriceHistoryEntry } from './types';

// Initial high-quality mock data for TOTVS SA (Supplier 000462)
export const INITIAL_INVOICES: Invoice[] = [
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
      { id: 'item-2-1', description: 'INTERA COMBO 4 VAR 1 AO 4', unitPrice: 1830.40, quantity: 4 }, // Price increased in April from 1743.57 to 1830.40!!
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
    paymentDate: undefined, // Overdue since current date is June 5, 2026
    expectedTotal: 16276.60,
    items: [
      { id: 'item-3-1', description: 'INTERA COMBO 4 VAR 1 AO 4', unitPrice: 1830.40, quantity: 4 },
      { id: 'item-3-2', description: 'INTERA COMBO 4 VAR 5 AO 10', unitPrice: 1492.50, quantity: 6 } // Price increased in May from 1403.24 to 1492.50!!
    ]
  }
];

// Helper to get formatted Portuguese Month and Year from a date string (YYYY-MM-DD or YYYY-MM)
export function getMonthYearLabel(dateStr: string): string {
  if (!dateStr) return 'Data não informada';
  const parts = dateStr.split('-');
  if (parts.length < 2) return dateStr;
  const year = parts[0];
  const month = parts[1];
  
  const monthNames: Record<string, string> = {
    '01': 'Janeiro',
    '02': 'Fevereiro',
    '03': 'Março',
    '04': 'Abril',
    '05': 'Maio',
    '06': 'Junho',
    '07': 'Julho',
    '08': 'Agosto',
    '09': 'Setembro',
    '10': 'Outubro',
    '11': 'Novembro',
    '12': 'Dezembro'
  };
  return `${monthNames[month] || month} de ${year}`;
}

// Formatting helper: currency (Brazilian Real)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Formatting helper: Date (Brazilian style: DD/MM/AAAA)
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// Get current date in YYYY-MM-DD format (local time)
export function getCurrentDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Calculate the payment status, checking for delays based on current real-world date context
export function getInvoiceStatus(invoice: Invoice, currentDateStr = getCurrentDateStr()): {
  status: 'Paga' | 'Pendente' | 'Atrasada';
  daysOverdue: number;
} {
  if (invoice.paymentDate && invoice.paymentDate.trim() !== '') {
    return { status: 'Paga', daysOverdue: 0 };
  }

  const dueDate = new Date(invoice.dueDate + 'T00:00:00');
  const current = new Date(currentDateStr + 'T00:00:00');

  if (current > dueDate) {
    const diffTime = Math.abs(current.getTime() - dueDate.getTime());
    const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { status: 'Atrasada', daysOverdue };
  }

  return { status: 'Pendente', daysOverdue: 0 };
}

// Extract unique months and years from all invoices
export function getFilterOptions(invoices: Invoice[]): {
  years: string[];
  months: { value: string; label: string }[];
} {
  const yearsSet = new Set<string>();
  const monthsSet = new Set<string>();

  invoices.forEach(inv => {
    if (inv.issueDate) {
      const [year, month] = inv.issueDate.split('-');
      yearsSet.add(year);
      monthsSet.add(month);
    }
  });

  const monthNames: Record<string, string> = {
    '01': 'Janeiro',
    '02': 'Fevereiro',
    '03': 'Março',
    '04': 'Abril',
    '05': 'Maio',
    '06': 'Junho',
    '07': 'Julho',
    '08': 'Agosto',
    '09': 'Setembro',
    '10': 'Outubro',
    '11': 'Novembro',
    '12': 'Dezembro'
  };

  const years = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  const months = Array.from(monthsSet)
    .sort((a, b) => Number(a) - Number(b))
    .map(m => ({ value: m, label: monthNames[m] || m }));

  return { years, months };
}

// Monitor price increases over time
export function analyzePriceIncreases(invoices: Invoice[]): PriceAlert[] {
  // Sort invoices chronologically by issue date
  const sortedInvoices = [...invoices].sort(
    (a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()
  );

  const priceHistory: Record<string, PriceHistoryEntry[]> = {};
  const alerts: PriceAlert[] = [];

  sortedInvoices.forEach(invoice => {
    invoice.items.forEach(item => {
      const normalizedDesc = item.description.trim().toUpperCase();
      if (!priceHistory[normalizedDesc]) {
        priceHistory[normalizedDesc] = [];
      }

      const history = priceHistory[normalizedDesc];
      if (history.length > 0) {
        // Compare with the most recent previous price in history
        const lastEntry = history[history.length - 1];
        if (item.unitPrice > lastEntry.unitPrice) {
          const increase = item.unitPrice - lastEntry.unitPrice;
          const percent = (increase / lastEntry.unitPrice) * 100;

          alerts.push({
            itemDescription: item.description,
            previousPrice: lastEntry.unitPrice,
            currentPrice: item.unitPrice,
            percentIncrease: parseFloat(percent.toFixed(1)),
            invoiceNumber: invoice.number,
            date: invoice.issueDate
          });
        }
      }

      // Add to history
      history.push({
        date: invoice.issueDate,
        invoiceNumber: invoice.number,
        unitPrice: item.unitPrice
      });
    });
  });

  // Return alerts sorted by date descending (most recent first)
  return alerts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Generate CSV data for all invoices
export function exportToCSV(invoices: Invoice[]): string {
  // Column definitions with UTF-8 support
  const headers = [
    'NF Número',
    'CNPJ Fornecedor',
    'Fornecedor',
    'Data Emissão',
    'Data Vencimento',
    'Data Pagamento',
    'Valor NF Informado',
    'Valor Itens Somatório',
    'Status',
    'Dias de Atraso',
    'Descrição do Serviço',
    'Preço Unitário',
    'Quantidade',
    'Valor Total Item'
  ];

  const rows: string[][] = [];

  invoices.forEach(inv => {
    const { status, daysOverdue } = getInvoiceStatus(inv);
    const sumTotalItems = inv.items.reduce((acc, curr) => acc + (curr.unitPrice * curr.quantity), 0);
    
    inv.items.forEach(item => {
      rows.push([
        inv.number,
        inv.supplierCode,
        inv.supplierName,
        inv.issueDate,
        inv.dueDate,
        inv.paymentDate || 'Pendente',
        inv.expectedTotal.toFixed(2),
        sumTotalItems.toFixed(2),
        status,
        daysOverdue.toString(),
        item.description.replace(/"/g, '""'), // Escape quotes
        item.unitPrice.toFixed(2),
        item.quantity.toString(),
        (item.unitPrice * item.quantity).toFixed(2)
      ]);
    });
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map(r => r.map(cell => `"${cell}"`).join(';'))
  ].join('\n');

  // Excel needs BOM prefix for UTF-8 and semicolons represent columns in typical European/LatAm systems
  return '\uFEFF' + csvContent;
}
