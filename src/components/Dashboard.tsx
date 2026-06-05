/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  DollarSign, Calendar, AlertTriangle, Download, Printer, Search, 
  Eye, Edit, Trash2, Filter, RotateCcw, AlertOctagon, TrendingUp, TrendingDown 
} from 'lucide-react';
import { Invoice, PriceAlert } from '../types';
import { 
  formatCurrency, formatDate, getInvoiceStatus, 
  getFilterOptions, analyzePriceIncreases, exportToCSV, getMonthYearLabel 
} from '../utils';

interface DashboardProps {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onOpenForm: () => void;
  onPrintPreview: (invoice: Invoice) => void;
  onPrintAllInvoices: (filteredInvoices: Invoice[]) => void;
  currentDateStr?: string;
}

export default function Dashboard({ 
  invoices, onEdit, onDelete, onOpenForm, onPrintPreview, onPrintAllInvoices, currentDateStr = '2026-06-05' 
}: DashboardProps) {
  // Search and Filters states
  const [searchNF, setSearchNF] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [selectedServiceForAnalysis, setSelectedServiceForAnalysis] = useState('');

  // Extract filter options dynamically from current invoices list
  const { years, months } = useMemo(() => getFilterOptions(invoices), [invoices]);

  // Clean filters
  const resetFilters = () => {
    setSearchNF('');
    setFilterMonth('');
    setFilterYear('');
  };

  // Filter application
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Filter by Invoice Number
      if (searchNF.trim() && !inv.number.toLowerCase().includes(searchNF.toLowerCase())) {
        return false;
      }
      
      // Filter by Month and Year based on Issue Date (Emissão)
      if (inv.issueDate) {
        // Garantir que temos uma string no formato YYYY-MM
        const dateStr = typeof inv.issueDate === 'string' ? inv.issueDate : String(inv.issueDate);
        const parts = dateStr.split(/[-/]/); // Aceita - ou /
        
        if (parts.length >= 2) {
          const year = parts[0];
          const month = parts[1];
          
          if (filterMonth && month !== filterMonth) return false;
          if (filterYear && year !== filterYear) return false;
        }
      } else {
        return false; 
      }
      return true;
    });
  }, [invoices, searchNF, filterMonth, filterYear]);

  // Monitor price increases chronologically
  const priceAlerts = useMemo(() => {
    return analyzePriceIncreases(invoices);
  }, [invoices]);

  // Compute overall KPI cards (all-time of current dataset)
  const kpi = useMemo(() => {
    let total = 0;
    let paid = 0;
    let outstanding = 0;
    let overdueCount = 0;

    invoices.forEach(inv => {
      total += inv.expectedTotal;
      const { status } = getInvoiceStatus(inv, currentDateStr);
      if (status === 'Paga') {
        paid += inv.expectedTotal;
      } else {
        outstanding += inv.expectedTotal;
        if (status === 'Atrasada') {
          overdueCount += 1;
        }
      }
    });

    return { total, paid, outstanding, overdueCount };
  }, [invoices, currentDateStr]);

  // Chart 1: Invoice sizes comparison (Gráfico comparativo por Nota Fiscal)
  const invoiceComparisonData = useMemo(() => {
    const data = [...filteredInvoices].sort(
      (a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()
    );
    return data.map(inv => ({
      name: inv.number,
      'Valor Declarado': inv.expectedTotal,
      'Soma Itens': inv.items.reduce((acc, c) => acc + (c.unitPrice * c.quantity), 0),
    }));
  }, [filteredInvoices]);

  // Distinct service descriptions for prices tracing
  const distinctServices = useMemo(() => {
    const servicesSet = new Set<string>();
    invoices.forEach(inv => {
      inv.items.forEach(item => {
        servicesSet.add(item.description.trim());
      });
    });
    return Array.from(servicesSet);
  }, [invoices]);

  // Pre-select service in dropdown if empty
  const activeServiceTrace = useMemo(() => {
    if (selectedServiceForAnalysis) return selectedServiceForAnalysis;
    return distinctServices[0] || '';
  }, [distinctServices, selectedServiceForAnalysis]);

  // Chart 2: Unit Price history for the selected service (Monitor de aumento de preços de um serviço)
  const servicePriceHistoryData = useMemo(() => {
    if (!activeServiceTrace) return [];
    
    // Extract unit price history for this service
    const history: { date: string; invoice: string; price: number }[] = [];
    
    // Sort all invoices chronologically to draw the correct line
    const chronoInvoices = [...invoices].sort(
      (a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()
    );

    chronoInvoices.forEach(inv => {
      inv.items.forEach(item => {
        if (item.description.trim().toUpperCase() === activeServiceTrace.trim().toUpperCase()) {
          history.push({
            date: formatDate(inv.issueDate),
            invoice: inv.number,
            price: item.unitPrice,
          });
        }
      });
    });
    
    return history;
  }, [invoices, activeServiceTrace]);

  // Chart 3: Impact Analysis - grouped expenses by service (Análise de impacto financeiro por item)
  const financialImpactData = useMemo(() => {
    const expensesMap: Record<string, number> = {};
    let totalOverallExpenses = 0;

    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const value = item.unitPrice * item.quantity;
        const key = item.description.trim();
        expensesMap[key] = (expensesMap[key] || 0) + value;
        totalOverallExpenses += value;
      });
    });

    const data = Object.keys(expensesMap).map(key => ({
      name: key,
      value: expensesMap[key],
      percent: totalOverallExpenses > 0 ? parseFloat(((expensesMap[key] / totalOverallExpenses) * 100).toFixed(1)) : 0
    }));

    // Sort from highest impact to lowest
    return data.sort((a, b) => b.value - a.value);
  }, [filteredInvoices]);

  // Recharts custom colors for impact chart
  const CHARTS_COLORS = ['#4f46e5', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  // Handle excel download
  const handleCSVDownload = () => {
    const csvContent = exportToCSV(filteredInvoices);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `notas_fiscais_totvs_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* KPI Cards section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-cards">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Lançado</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><DollarSign className="w-4 h-4" /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-black text-slate-800 font-mono">{formatCurrency(kpi.total)}</h3>
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              <span>{invoices.length} notas no prontuário geral</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Total Pago</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign className="w-4 h-4" /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-black text-emerald-850 font-mono">{formatCurrency(kpi.paid)}</h3>
            <p className="text-[10px] text-emerald-600 mt-1">Quitadas junto ao fornecedor</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Pendentes de Liquidação</span>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><DollarSign className="w-4 h-4" /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-black text-orange-850 font-mono">{formatCurrency(kpi.outstanding)}</h3>
            <p className="text-[10px] text-orange-600 mt-1">Aguardando conciliação bancária</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-150 shadow-sm hover:border-rose-300 transition-all bg-gradient-to-tr from-rose-50/20 to-white">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Notas Atropeladas (Atrasos)</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertTriangle className="w-4 h-4 animate-bounce" /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-black text-rose-800 font-mono">{kpi.overdueCount} {kpi.overdueCount === 1 ? 'Nota' : 'Notas'}</h3>
            <p className="text-[10px] text-rose-600 mt-1 font-semibold">Exigem intervenção imediata</p>
          </div>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div id="filter-panel" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-indigo-600" /> Filtros Integrados
          </h3>
          {(searchNF || filterMonth || filterYear) && (
            <button 
              onClick={resetFilters} 
              className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
              <Search className="w-3.5 h-3.5" /> Procurar Número NF
            </label>
            <input 
              type="text" 
              placeholder="Digite o número (Ex: NFT-1115)"
              value={searchNF}
              onChange={e => setSearchNF(e.target.value)}
              className="w-full text-xs bg-slate-50/50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Mês de Emissão</label>
            <select 
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="w-full text-xs bg-slate-50/50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium"
            >
              <option value="">Todos os Meses</option>
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Ano de Emissão</label>
            <select 
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="w-full text-xs bg-slate-50/50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium"
            >
              <option value="">Todos os Anos</option>
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* DASHBOARD CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="dashboard-charts">
        
        {/* GRAPH 1: COMPARATIVE VALUE BY INVOICE (Comparativos por nota fiscal) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-800">📊 Gráfico Comparativo por Nota Fiscal</h4>
            <p className="text-[10px] text-slate-500">Valores declarados vs soma total dos itens descritos</p>
          </div>
          <div className="flex-1 min-h-0">
            {invoiceComparisonData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invoiceComparisonData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    formatter={(val) => [formatCurrency(Number(val)), '']} 
                    contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Valor Declarado" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={25} />
                  <Bar dataKey="Soma Itens" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">Sem dados correspondentes aos filtros.</div>
            )}
          </div>
        </div>

        {/* GRAPH 2: DETAILED ITEM IMPACT ANALYSIS (Quais itens possuem maior impacto financeiro na nota) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-800">🎯 Análise de Impacto Financeiro por Serviço</h4>
            <p className="text-[10px] text-slate-500">Participação percentual acumulada dos serviços contratados</p>
          </div>
          <div className="flex-1 min-h-0 flex flex-col md:flex-row items-center gap-4">
            {financialImpactData.length > 0 ? (
              <>
                <div className="w-full md:w-1/2 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={financialImpactData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {financialImpactData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHARTS_COLORS[index % CHARTS_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Gasto Total']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 max-h-[190px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {financialImpactData.slice(0, 5).map((entry, i) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate max-w-[150px]">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: CHARTS_COLORS[i % CHARTS_COLORS.length] }} 
                        />
                        <span className="font-semibold text-slate-700 truncate" title={entry.name}>{entry.name}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 shrink-0">{entry.percent}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center w-full h-full text-slate-400 text-xs">Sem faturas lançadas no filtro.</div>
            )}
          </div>
        </div>

        {/* GRAPH 3: PRICE EVOLUTION OF SERVICES (Monitorar reajustes de preço) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[350px] lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800">📈 Histórico e Evolução de Preços dos Serviços</h4>
              <p className="text-[10px] text-slate-500">Selecione um serviço cadastrado para verificar variações nos custos unitários técnicos</p>
            </div>
            
            {distinctServices.length > 0 && (
              <select 
                value={activeServiceTrace}
                onChange={e => setSelectedServiceForAnalysis(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg px-2.5 py-1.5 focus:border-indigo-400 focus:bg-white outline-none"
              >
                {distinctServices.map(desc => (
                  <option key={desc} value={desc}>{desc}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex-1 min-h-0">
            {servicePriceHistoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={servicePriceHistoryData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="invoice" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    formatter={(val) => [formatCurrency(Number(val)), 'Preço Unitário']}
                    labelFormatter={(label, items) => `NF: ${label}`}
                    contentStyle={{ borderRadius: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    name="Valor Unitário Técnico BRL" 
                    stroke="#4f46e5" 
                    strokeWidth={3} 
                    dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} 
                    activeDot={{ r: 7 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                Por favor, cadastre notas fiscais para monitorar o histórico de preços.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRICE INCREASE ALERTS (Histórico de Reajustes / Fornecedor) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="price-alerts-block">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-rose-500 animate-pulse" /> Monitor de Reajustes de Preços
            </h4>
            <p className="text-[10px] text-slate-500">Histórico de aumentos aplicados sequencialmente a itens idênticos do fornecedor TOTVS</p>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100">
            Ativo (000462)
          </span>
        </div>

        {/* Highlighted section showing EXACTLY the months with price increases */}
        {priceAlerts.length > 0 && (
          <div className="bg-rose-50/70 border-b border-rose-100 p-4 px-6 flex flex-wrap items-center gap-3">
            <span className="text-xs font-extrabold text-rose-850 uppercase tracking-wide flex items-center gap-1.5 shrink-0">
              <TrendingUp className="w-4 h-4 text-rose-600 animate-bounce" /> Meses com reajuste de preço detectado:
            </span>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(priceAlerts.map(a => getMonthYearLabel(a.date)))).map((monthStr, i) => (
                <span key={i} className="text-xs font-bold bg-rose-600 text-white rounded-full px-3 py-1 shadow-sm flex items-center gap-1">
                  📅 {monthStr}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
          {priceAlerts.length > 0 ? (
            priceAlerts.map((alert, index) => (
              <div 
                key={index} 
                className="px-6 py-4 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                id={`price-alert-${index}`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800 text-xs sm:text-sm">{alert.itemDescription}</span>
                    <span className="text-[10px] bg-rose-50 text-rose-700 font-bold border border-rose-100 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                      +{alert.percentIncrease}% Reajuste
                    </span>
                    <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md shrink-0">
                      📅 {getMonthYearLabel(alert.date)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Preço anterior era <span className="font-semibold text-slate-700">{formatCurrency(alert.previousPrice)}</span> e subiu para <span className="font-extrabold text-rose-700">{formatCurrency(alert.currentPrice)}</span>
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-1 rounded-md border border-slate-200">
                    Identificado na NF {alert.invoiceNumber}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">Lançada em {formatDate(alert.date)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              👌 Fantástico! Nenhum aumento de preço foi detectado entre as compras subsequentes até o momento.
            </div>
          )}
        </div>
      </div>

      {/* DETAILED INVOICES TABLE (TABELA DETALHADA COM AÇÕES EXPORT) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="invoices-list-table">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-800">📋 Prontuário Geral de Notas Fiscais</h4>
            <p className="text-[10px] text-slate-500">Resultados filtrados: mostrando {filteredInvoices.length} de {invoices.length} notas no sistema.</p>
          </div>
          
          {/* EXPORTS AND ACTIONS */}
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={handleCSVDownload}
              disabled={filteredInvoices.length === 0}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-white bg-white hover:bg-indigo-600 border border-indigo-200 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-indigo-700 hover:border-indigo-650 rounded-lg px-3 py-2 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Exportar Planilha (Excel/CSV)
            </button>
            <button 
              onClick={() => onPrintAllInvoices(filteredInvoices)}
              disabled={filteredInvoices.length === 0}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-slate-700 rounded-lg px-3 py-2 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Imprensa / PDF Geral
            </button>
            <button 
              onClick={onOpenForm}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-750 rounded-lg px-3.5 py-2 transition-all shadow-sm cursor-pointer"
            >
              + Nova Nota
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-450 text-[10px] uppercase font-bold tracking-wider">
                <th className="px-6 py-3">Número NF</th>
                <th className="px-4 py-3">Emissão</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3 text-center">Status Pagamento</th>
                <th className="px-4 py-3 text-right">Sumário Itens</th>
                <th className="px-6 py-3 text-right">Valor Total NF</th>
                <th className="px-6 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map(inv => {
                  const { status, daysOverdue } = getInvoiceStatus(inv, currentDateStr);
                  const itemsSum = inv.items.reduce((acc, c) => acc + (c.unitPrice * c.quantity), 0);
                  const validationError = Math.abs(itemsSum - inv.expectedTotal) > 0.01;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/30 transition-colors group">
                      <td className="px-6 py-4 font-bold text-slate-900 font-sans">
                        {inv.number}
                        {validationError && (
                          <span className="block text-[9px] text-amber-600 font-normal leading-none mt-1" title="Divergência entre soma de itens e cabeçalho">
                            ⚠️ Balanço incoerente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-550">{formatDate(inv.issueDate)}</td>
                      <td className="px-4 py-4 text-slate-550 font-semibold">{formatDate(inv.dueDate)}</td>
                      <td className="px-4 py-4 text-slate-550">
                        {inv.paymentDate ? (
                          <span className="text-slate-700 font-medium">{formatDate(inv.paymentDate)}</span>
                        ) : (
                          <span className="text-slate-400">Em aberto</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {status === 'Paga' && (
                          <span className="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                            Pago
                          </span>
                        )}
                        {status === 'Pendente' && (
                          <span className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-semibold">
                            Agendado
                          </span>
                        )}
                        {status === 'Atrasada' && (
                          <span className="inline-flex items-center bg-rose-50 text-rose-700 border border-rose-150 px-2 py-0.5 rounded-full font-bold">
                            Vencida ({daysOverdue}d)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-slate-550">{formatCurrency(itemsSum)}</td>
                      <td className="px-6 py-4 text-right font-mono font-extrabold text-slate-800">
                        {formatCurrency(inv.expectedTotal)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100">
                          <button 
                            onClick={() => onPrintPreview(inv)}
                            title="Visualizar Comitê de Impressão PDF"
                            className="p-1 px-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-md transition-colors hover:bg-slate-100"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => onEdit(inv)}
                            title="Editar Nota"
                            className="p-1 px-1.5 bg-indigo-50 border border-indigo-100 text-indigo-650 hover:text-indigo-850 rounded-md transition-colors hover:bg-indigo-100"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => onDelete(inv.id)}
                            title="Deletar Nota"
                            className="p-1 px-1.5 bg-rose-50 border border-rose-100 text-rose-600 hover:text-rose-800 rounded-md transition-colors hover:bg-rose-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    Nenhuma nota fiscal encontrada aplicando os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
