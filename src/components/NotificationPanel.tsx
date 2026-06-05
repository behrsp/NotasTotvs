/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, Bell, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { Invoice } from '../types';
import { getInvoiceStatus, formatCurrency, formatDate } from '../utils';

interface NotificationPanelProps {
  invoices: Invoice[];
  currentDateStr?: string;
}

export default function NotificationPanel({ invoices, currentDateStr = '2026-06-05' }: NotificationPanelProps) {
  // Find overdue invoices
  const overdueInvoices = invoices.filter(inv => {
    const { status } = getInvoiceStatus(inv, currentDateStr);
    return status === 'Atrasada';
  });

  // Find unpaid near due invoices (due within 7 days from current date)
  const dueSoonInvoices = invoices.filter(inv => {
    const { status } = getInvoiceStatus(inv, currentDateStr);
    if (status !== 'Pendente') return false;
    
    const dueDate = new Date(inv.dueDate + 'T00:00:00');
    const today = new Date(currentDateStr + 'T00:00:00');
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 0 && diffDays <= 7;
  });

  const totalNotificationsCount = overdueInvoices.length + dueSoonInvoices.length;

  if (totalNotificationsCount === 0) {
    return (
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-150 rounded-xl p-4 text-slate-600 transition-all duration-300">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Pagamentos em dia</h4>
          <p className="text-xs text-slate-550 mt-0.5">Nenhuma fatura atrasada ou com vencimento próximo identificada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-800">Mensagens e Alertas de Controle</h3>
        </div>
        <span className="bg-rose-50 text-rose-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-rose-100">
          {totalNotificationsCount} {totalNotificationsCount === 1 ? 'alerta' : 'alertas'}
        </span>
      </div>

      <div className="space-y-2">
        {/* Overdue Alerts */}
        {overdueInvoices.map(inv => {
          const { daysOverdue } = getInvoiceStatus(inv, currentDateStr);
          return (
            <div 
              key={inv.id} 
              id={`alert-overdue-${inv.id}`} 
              className="group flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 rounded-xl p-4 hover:border-rose-300 transition-all duration-200"
            >
              <div className="flex gap-3 items-start">
                <div className="p-2 bg-rose-100 rounded-lg text-rose-700 mt-0.5">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-rose-950">Atraso Crítico</span>
                    <span className="text-xs bg-rose-250 text-rose-800 px-2 py-0.5 rounded-md font-medium border border-rose-300">
                      Vencido há {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'}
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 mt-1">
                    A NF-e <span className="font-semibold text-rose-950">{inv.number}</span> idealizada para o fornecedor <span className="font-semibold text-rose-950">TOTVS SA</span> já ultrapassou a data limite de vencimento técnico.
                  </p>
                  <div className="flex gap-4 mt-2 text-xs text-rose-700">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Venceu em {formatDate(inv.dueDate)}</span>
                    <span className="flex items-center gap-1 leading-none font-bold text-rose-900">Total: {formatCurrency(inv.expectedTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Near Due Alerts */}
        {dueSoonInvoices.map(inv => {
          const dueDate = new Date(inv.dueDate + 'T00:00:00');
          const today = new Date(currentDateStr + 'T00:00:00');
          const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          return (
            <div 
              key={inv.id} 
              id={`alert-due-soon-${inv.id}`} 
              className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 hover:border-amber-300 transition-all duration-200"
            >
              <div className="flex gap-3 items-start">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-700 mt-0.5">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-amber-950">Aviso Tempesitvo</span>
                    <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-md font-medium">
                      Vence {diffDays === 0 ? 'hoje!' : `em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`}
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-1">
                    NF <span className="font-semibold text-amber-950">{inv.number}</span> programada para vencer brevemente. Favor certificar fluxo de aprovação e provisão de caixa.
                  </p>
                  <div className="flex gap-4 mt-2 text-xs text-amber-700">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Vencimento em {formatDate(inv.dueDate)}</span>
                    <span className="flex items-center gap-1 leading-none font-semibold text-amber-900">Total: {formatCurrency(inv.expectedTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
