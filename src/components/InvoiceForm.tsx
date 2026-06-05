/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, AlertCircle, FileText, Calendar, DollarSign, RefreshCw } from 'lucide-react';
import { Invoice, InvoiceItem } from '../types';
import { formatCurrency } from '../utils';

interface InvoiceFormProps {
  onSave: (invoice: Invoice) => void;
  onCancel: () => void;
  editInvoice?: Invoice | null;
}

export default function InvoiceForm({ onSave, onCancel, editInvoice }: InvoiceFormProps) {
  const [number, setNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [expectedTotal, setExpectedTotal] = useState<number>(0);
  const [expectedTotalInput, setExpectedTotalInput] = useState('0');
  
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: '', unitPrice: 0, quantity: 1 }
  ]);

  // If editing an existing invoice, pre-fill all the fields
  useEffect(() => {
    if (editInvoice) {
      setNumber(editInvoice.number);
      setIssueDate(editInvoice.issueDate);
      setDueDate(editInvoice.dueDate);
      setPaymentDate(editInvoice.paymentDate || '');
      setExpectedTotal(editInvoice.expectedTotal);
      setExpectedTotalInput(String(editInvoice.expectedTotal));
      setItems(editInvoice.items.length > 0 ? [...editInvoice.items] : [{ id: '1', description: '', unitPrice: 0, quantity: 1 }]);
    }
  }, [editInvoice]);

  // Real-time calculations of the items sum total
  const itemsSumTotal = items.reduce((acc, curr) => acc + (curr.unitPrice * curr.quantity), 0);
  const isMatching = Math.abs(itemsSumTotal - expectedTotal) < 0.01;
  const discrepancy = Math.abs(itemsSumTotal - expectedTotal);

  // Manage expected total changes
  const handleExpectedTotalChange = (val: string) => {
    setExpectedTotalInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0) {
      setExpectedTotal(parsed);
    } else {
      setExpectedTotal(0);
    }
  };

  // Manage items helper functions
  const handleAddItem = () => {
    const newItemId = String(Date.now() + Math.random());
    setItems([...items, { id: newItemId, description: '', unitPrice: 0, quantity: 1 }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return; // Must keep at least one
    setItems(items.filter(item => item.id !== id));
  };

  const handleAddTemplateItem = (description: string, unitPrice: number, quantity: number = 1) => {
    const newItemId = String(Date.now() + Math.random());
    // If we only have 1 single default blank item, replace it
    if (items.length === 1 && items[0].description.trim() === '' && items[0].unitPrice === 0) {
      setItems([{ id: newItemId, description, unitPrice, quantity }]);
    } else {
      setItems([...items, { id: newItemId, description, unitPrice, quantity }]);
    }
  };

  const handleApplyFullTemplate = () => {
    setItems([
      { id: String(Date.now() + 1), description: 'INTERA COMBO 4 VAR 1 AO 4', unitPrice: 1743.57, quantity: 4 },
      { id: String(Date.now() + 2), description: 'INTERA COMBO 4 VAR 5 AO 10', unitPrice: 1403.24, quantity: 6 }
    ]);
  };

  const handleItemFieldChange = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        let updatedValue = value;
        if (field === 'unitPrice') {
          updatedValue = parseFloat(value) || 0;
        } else if (field === 'quantity') {
          updatedValue = parseInt(value, 10) || 1;
        }
        return { ...item, [field]: updatedValue };
      }
      return item;
    }));
  };

  // Copy total items directly to Invoice Expected Total (for convenience)
  const syncTotals = () => {
    setExpectedTotal(itemsSumTotal);
    setExpectedTotalInput(itemsSumTotal.toFixed(2));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // validations
    if (!number.trim()) {
      alert('Por favor, insira o número da nota fiscal.');
      return;
    }
    if (!issueDate) {
      alert('Por favor, selecione a data de emissão.');
      return;
    }
    if (!dueDate) {
      alert('Por favor, selecione a data de vencimento.');
      return;
    }

    // Verify empty items description
    const hasEmptyItem = items.some(item => !item.description.trim());
    if (hasEmptyItem) {
      alert('Por favor, insira a descrição do serviço para todos os itens.');
      return;
    }

    const payload: Invoice = {
      id: editInvoice ? editInvoice.id : String(Date.now()),
      number: number.trim(),
      supplierName: 'TOTVS SA',
      supplierCode: '000462',
      issueDate,
      dueDate,
      paymentDate: paymentDate.trim() || undefined,
      expectedTotal,
      items
    };

    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} id="invoice-form" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
      <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">
            {editInvoice ? '✏️ Editar Nota Fiscal' : '➕ Lançar Nova Nota Fiscal'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">Lançamento de compras para TOTVS SA.</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Supplier details - READ ONLY and Pre-filled as requested */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold tracking-wider text-indigo-750 uppercase">Fornecedor Conveniado</label>
            <input 
              type="text" 
              value="TOTVS SA" 
              disabled 
              className="mt-1 w-full text-sm font-semibold bg-white border border-indigo-200 text-indigo-900 rounded-lg px-3 py-2 cursor-not-allowed outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold tracking-wider text-indigo-750 uppercase font-mono">Código Cadastro Fornecedor</label>
            <input 
              type="text" 
              value="000462" 
              disabled 
              className="mt-1 w-full text-sm font-mono font-semibold bg-white border border-indigo-200 text-indigo-900 rounded-lg px-3 py-2 cursor-not-allowed outline-none"
            />
          </div>
        </div>

        {/* Invoice Header Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-650 flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" /> Número da NF
            </label>
            <input 
              type="text" 
              required
              id="field-nf-number"
              value={number} 
              onChange={e => setNumber(e.target.value)}
              placeholder="Ex: NFT-1132"
              className="w-full text-sm bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-650 flex items-center gap-1.5 mb-1.5">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" /> Valor Declarado na NF (R$)
            </label>
            <input 
              type="number" 
              step="0.01"
              required
              id="field-expected-total"
              value={expectedTotalInput} 
              onChange={e => handleExpectedTotalChange(e.target.value)}
              className="w-full text-sm bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-2 font-mono font-semibold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
            />
            <p className="text-[10px] text-slate-400 mt-1">Valor estampado no cabeçalho físico da nota.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-650 flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Data de Emissão
            </label>
            <input 
              type="date" 
              required
              id="field-issue-date"
              value={issueDate} 
              onChange={e => setIssueDate(e.target.value)}
              className="w-full text-sm bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-650 flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 font-bold" /> Data de Vencimento
            </label>
            <input 
              type="date" 
              required
              id="field-due-date"
              value={dueDate} 
              onChange={e => setDueDate(e.target.value)}
              className="w-full text-sm bg-white border border-slate-250 text-slate-800 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-650 flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Data do Pagamento (Opcional)
            </label>
            <input 
              type="date" 
              id="field-payment-date"
              value={paymentDate} 
              onChange={e => setPaymentDate(e.target.value)}
              className="w-full text-sm bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all"
            />
            <p className="text-[10px] text-slate-400 mt-1">Preencha quando o financeiro quitar esta nota.</p>
          </div>
        </div>

        {/* Dynamic Items / Services List */}
        <div>
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1">
              💼 Composição da Nota (Itens e Serviços)
            </h3>
            <button 
              type="button" 
              onClick={handleAddItem}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-650 hover:text-indigo-850 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-150"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Item
            </button>
          </div>

          {/* Quick-add templates for TOTVS services */}
          <div className="mb-4 bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              ✨ Modelos de Serviços Comuns (TOTVS SA):
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              <button
                type="button"
                onClick={() => handleAddTemplateItem('INTERA COMBO 4 VAR 1 AO 4', 1743.57, 1)}
                className="text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors shadow-2xs cursor-pointer"
              >
                ➕ COMBO VAR 1-4 (R$ 1.743,57)
              </button>
              <button
                type="button"
                onClick={() => handleAddTemplateItem('INTERA COMBO 4 VAR 5 AO 10', 1403.24, 1)}
                className="text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors shadow-2xs cursor-pointer"
              >
                ➕ COMBO VAR 5-10 (R$ 1.403,24)
              </button>
              <button
                type="button"
                onClick={() => handleAddTemplateItem('Licenciamento de Software PROTHEUS', 4800.00, 1)}
                className="text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors shadow-2xs cursor-pointer"
              >
                ➕ Licenciamento PROTHEUS
              </button>
              <button
                type="button"
                onClick={() => handleAddTemplateItem('Suporte Técnico Mensal', 1200.00, 1)}
                className="text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors shadow-2xs cursor-pointer"
              >
                ➕ Suporte Mensal
              </button>
            </div>
            <div className="border-t border-slate-200/60 pt-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <span className="text-[10px] text-slate-400">Atalho rápido: clique para colar o faturamento completo no padrão</span>
              <button
                type="button"
                onClick={handleApplyFullTemplate}
                className="text-xs font-bold text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-650 px-3 py-1 rounded-lg border border-indigo-200 transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                📂 Aplicar Gabarito Completo (RPS 00149463)
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const itemTotal = item.unitPrice * item.quantity;
              return (
                <div 
                  key={item.id} 
                  id={`form-item-row-${index}`}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-150 items-center animate-fade-in"
                >
                  <div className="md:col-span-5">
                    <label className="block md:hidden text-[11px] text-slate-500 font-medium mb-1">Serviço/Item</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Descrição do serviço (ex: Suporte Técnico)"
                      value={item.description}
                      onChange={e => handleItemFieldChange(item.id, 'description', e.target.value)}
                      className="w-full text-sm bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 focus:border-indigo-400 outline-none"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block md:hidden text-[11px] text-slate-500 font-medium mb-1">Preço Unitário (R$)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required
                      placeholder="Preço R$"
                      value={item.unitPrice || ''}
                      onChange={e => handleItemFieldChange(item.id, 'unitPrice', e.target.value)}
                      className="w-full text-sm bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 focus:border-indigo-400 outline-none font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block md:hidden text-[11px] text-slate-500 font-medium mb-1">Qtd</label>
                    <input 
                      type="number" 
                      min="1" 
                      required
                      placeholder="Qtd"
                      value={item.quantity || ''}
                      onChange={e => handleItemFieldChange(item.id, 'quantity', e.target.value)}
                      className="w-full text-sm bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 focus:border-indigo-400 outline-none text-center font-semibold"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center justify-between gap-2 pl-1">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400">Total Item</p>
                      <p className="text-xs font-bold text-slate-700 font-mono">{formatCurrency(itemTotal)}</p>
                    </div>

                    <button 
                      type="button" 
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={items.length === 1}
                      className={`p-1.5 rounded-lg border transition-all ${
                        items.length === 1 
                        ? 'text-slate-300 border-slate-100 bg-transparent cursor-not-allowed' 
                        : 'text-rose-500 border-rose-100 bg-rose-50 hover:bg-rose-100 hover:border-rose-200'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Validation Block: Sum of items vs expected invoice total */}
        <div id="validation-panel" className={`p-4 rounded-xl border transition-all duration-300 ${
          isMatching 
          ? 'bg-emerald-50/50 border-emerald-100 text-emerald-850' 
          : 'bg-amber-50/70 border-amber-200 text-amber-900'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex gap-2.5 items-start">
              <div className={`p-1.5 rounded-lg mt-0.5 ${isMatching ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-150 text-amber-700'}`}>
                {isMatching ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">Verificação de Conformidade</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-1.5 text-xs">
                  <div>Soma dos Itens: <span className="font-bold text-slate-800 font-mono">{formatCurrency(itemsSumTotal)}</span></div>
                  <div>Cabeçalho da NF: <span className="font-bold text-slate-800 font-mono">{formatCurrency(expectedTotal)}</span></div>
                </div>
                {!isMatching && (
                  <p className="text-[11px] text-amber-800 mt-2 font-medium">
                    ⚠️ Atenção: Há uma diferença de <span className="font-extrabold font-mono">{formatCurrency(discrepancy)}</span> entre os itens descritos e o cabeçalho.
                  </p>
                )}
              </div>
            </div>
            
            {!isMatching && (
              <button
                type="button"
                onClick={syncTotals}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 rounded-lg px-3 py-2 transition-all shadow-sm shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Ajustar Cabeçalho
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3">
        <button 
          type="button" 
          onClick={onCancel}
          className="text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg px-4 py-2 transition-all hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          className="text-xs font-bold text-white bg-gradient-to-r from-indigo-630 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-lg px-5 py-2 transition-all shadow-sm"
        >
          {editInvoice ? 'Salvar Alterações' : 'Salvar Nota'}
        </button>
      </div>
    </form>
  );
}
