/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useEffect } from 'react';
import { ArrowLeft, Printer, FileText } from 'lucide-react';
import { Invoice } from '../types';
import { formatCurrency, formatDate, getInvoiceStatus } from '../utils';

interface PrintReportProps {
  invoicesToPrint: Invoice[];
  onBack: () => void;
  title?: string;
  currentDateStr?: string;
}

export default function PrintReport({ 
  invoicesToPrint, onBack, title = 'Relatório de Compras Detalhado', currentDateStr = '2026-06-05' 
}: PrintReportProps) {
  // Automatically trigger print on load (optional but friendly)
  const triggerPrint = () => {
    window.print();
  };

  const totalSumExpected = invoicesToPrint.reduce((acc, c) => acc + c.expectedTotal, 0);
  const totalItemsSum = invoicesToPrint.reduce((acc, inv) => {
    return acc + inv.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 md:px-8 print:bg-white print:p-0">
      
      {/* Printable page controls - HIDDEN in standard browser print */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-slate-650 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </button>
        
        <div className="flex items-center gap-2">
          <p className="text-xs text-slate-500 mr-2">Pressione Ctrl+P ou clique no botão para gerar o PDF.</p>
          <button 
            onClick={triggerPrint}
            className="flex items-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-750 px-4 py-2 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Imprimir / Exportar PDF
          </button>
        </div>
      </div>

      {/* DOCUMENT SHEET */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-250 p-8 sm:p-12 shadow-md rounded-2xl print:shadow-none print:border-none print:p-0 font-sans text-slate-800">
        
        {/* UPPER DOCUMENT HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-900 pb-5 mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 bg-slate-950 text-white rounded text-xs font-black tracking-widest font-mono">REPORT</span>
              <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">Auditório Contábil e de Compras</h1>
            </div>
            <h2 className="text-xs font-mono text-slate-500 mt-1 uppercase tracking-wider">Fornecedor Técnico Exclusivo: TOTVS SA</h2>
          </div>
          
          <div className="text-left sm:text-right text-xs">
            <p className="font-semibold text-slate-900">Emissor: Sistema de Controle Interno</p>
            <p className="text-slate-500">Geração: {formatDate(currentDateStr)}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">Registo Cadastral: #000462</p>
          </div>
        </div>

        {/* TITLE SHEET */}
        <div className="mb-6">
          <h3 className="text-base font-black text-slate-950 uppercase tracking-widest border-b border-slate-150 pb-2 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-700" /> {title}
          </h3>
        </div>

        {/* CUMULATIVE GENERAL SUMMARY INFO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150 mb-7 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Faturado</span>
            <span className="font-mono font-bold text-sm text-slate-900">{formatCurrency(totalSumExpected)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Soma dos Itens</span>
            <span className="font-mono font-bold text-sm text-slate-900">{formatCurrency(totalItemsSum)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Quantidade Notas</span>
            <span className="font-mono font-bold text-sm text-slate-900">{invoicesToPrint.length} unidades</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Status Geral</span>
            <span className="font-semibold text-slate-950">Auditado para Conciliação</span>
          </div>
        </div>

        {/* DETAILED INVOICE BREAKDOWNS */}
        <div className="space-y-8">
          {invoicesToPrint.map((inv, index) => {
            const { status } = getInvoiceStatus(inv, currentDateStr);
            const itemsSum = inv.items.reduce((acc, c) => acc + (c.unitPrice * c.quantity), 0);
            const valDiscrepancy = Math.abs(itemsSum - inv.expectedTotal);

            return (
              <div key={inv.id} className="border border-slate-200 rounded-xl p-5 space-y-4 break-inside-avoid">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-150 gap-2">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Fatura {index + 1}: <span className="font-mono text-indigo-850">{inv.number}</span>
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Emissão: {formatDate(inv.issueDate)} | Vencimento: {formatDate(inv.dueDate)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                      status === 'Paga' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                      : status === 'Atrasada'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                      Status: {status}
                    </span>
                    {inv.paymentDate && (
                      <p className="text-[10px] text-slate-400 mt-1">Pago em: {formatDate(inv.paymentDate)}</p>
                    )}
                  </div>
                </div>

                {/* Items contained list */}
                <div>
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold uppercase text-[9px]">
                        <th className="px-3 py-1.5">Descrição do Serviço / Item</th>
                        <th className="px-3 py-1.5 text-right font-mono">Qtd</th>
                        <th className="px-3 py-1.5 text-right font-mono">Preço Unitário</th>
                        <th className="px-3 py-1.5 text-right font-mono">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inv.items.map(item => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 font-medium text-slate-800">{item.description}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600">{item.quantity}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-900 font-bold">
                            {formatCurrency(item.unitPrice * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 font-bold bg-slate-50/50">
                        <td colSpan={3} className="px-3 py-2 text-right text-slate-600 uppercase text-[9px]">Subtotal Itens:</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-900">{formatCurrency(itemsSum)}</td>
                      </tr>
                      {valDiscrepancy > 0.01 && (
                        <tr className="text-amber-700 bg-amber-50/40">
                          <td colSpan={3} className="px-3 py-1.5 text-right text-[10px] font-semibold">⚠️ Diferença Ajuste Cabeçalho:</td>
                          <td className="px-3 py-1.5 text-right font-mono text-[10px] font-bold">{formatCurrency(inv.expectedTotal - itemsSum)}</td>
                        </tr>
                      )}
                      <tr className="border-t-2 border-slate-800 font-black">
                        <td colSpan={3} className="px-3 py-2 text-right text-slate-800 uppercase text-[10px]">Total Geral Declarado na NF:</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-950 text-sm">{formatCurrency(inv.expectedTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {/* AUDITING SIGNATURE BLOCK */}
        <div className="mt-14 border-t border-slate-350 pt-10 break-inside-avoid">
          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            Relatório gerado em ambiente automatizado de auditoria interna para controle financeiro.<br />
            Todas as compras registradas estão vinculadas exclusivamente à TOTVS SA (CNPJ/Registro: 000462).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 mt-12 gap-8 text-center text-xs">
            <div className="space-y-1">
              <div className="w-[180px] mx-auto border-t border-slate-400" />
              <p className="font-bold text-slate-800">Departamento de Compras / TI</p>
              <p className="text-[10px] text-slate-400">Responsável pela Verificação Física</p>
            </div>
            
            <div className="space-y-1">
              <div className="w-[180px] mx-auto border-t border-slate-400" />
              <p className="font-bold text-slate-800">Diretoria Financeira / CFO</p>
              <p className="text-[10px] text-slate-400">Aprovador de Pagamentos e Conciliação</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
