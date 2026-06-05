/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, Database, Upload, Download, AlertCircle, FileText, 
  HelpCircle, Sparkles, CheckCircle2, ChevronRight, ArrowUpDown 
} from 'lucide-react';
import NotificationPanel from './components/NotificationPanel';
import InvoiceForm from './components/InvoiceForm';
import Dashboard from './components/Dashboard';
import PrintReport from './components/PrintReport';
import { Invoice } from './types';
import { INITIAL_INVOICES } from './utils';

const CACHE_KEY = 'totvs_invoices_db_cache';

export default function App() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceForPrinting, setSelectedInvoiceForPrinting] = useState<Invoice[] | null>(null);
  const [printTitle, setPrintTitle] = useState('');
  
  // Navigation & database sync states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [showBackupInfo, setShowBackupInfo] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  // Load invoices directly from Neon Database
  const loadInvoicesFromDb = async (silent = false) => {
    if (!silent) setIsDbLoading(true);
    setDbError(null);
    try {
      const res = await fetch('/api/invoices');
      if (!res.ok) {
        throw new Error('Falha ao obter dados do banco de dados na rede.');
      }
      const data = await res.json();
      setInvoices(data);
    } catch (err: any) {
      console.error('Erro de conexão com o banco Neon SQL:', err);
      setDbError('Não foi possível conectar ao banco de dados Neon no momento. Exibindo cópia local cache.');
      
      // Load offline cache copy representation
      const cache = localStorage.getItem(CACHE_KEY);
      if (cache) {
        try {
          setInvoices(JSON.parse(cache));
        } catch {
          setInvoices(INITIAL_INVOICES);
        }
      } else {
        setInvoices(INITIAL_INVOICES);
      }
    } finally {
      if (!silent) setIsDbLoading(false);
    }
  };

  useEffect(() => {
    loadInvoicesFromDb();
  }, []);

  // Cache changes locally to prevent any direct loss of data on network hiccups
  useEffect(() => {
    if (invoices.length > 0) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(invoices));
    }
  }, [invoices]);

  // Create or Update
  const handleSaveInvoice = async (newInvoice: Invoice) => {
    const exists = invoices.some(inv => inv.id === newInvoice.id);
    setIsDbLoading(true);
    try {
      let res;
      if (exists) {
        res = await fetch(`/api/invoices/${newInvoice.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newInvoice),
        });
      } else {
        res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newInvoice),
        });
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao salvar nota fiscal no Neon.');
      }

      await loadInvoicesFromDb(true);
      setIsFormOpen(false);
      setInvoiceToEdit(null);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar no banco Neon: ' + err.message);
    } finally {
      setIsDbLoading(false);
    }
  };

  // Delete
  const handleDeleteInvoice = (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (inv) {
      setInvoiceToDelete(inv);
    }
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    setIsDbLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        let errorInfo = `Status: ${res.status}`;
        try {
          const errorData = await res.json();
          errorInfo += ` - ${errorData.error || errorData.details || 'Erro desconhecido'}`;
        } catch {
          const text = await res.text().catch(() => '');
          if (text) errorInfo += ` - ${text.slice(0, 100)}`;
        }
        throw new Error(errorInfo);
      }
      setInvoiceToDelete(null);
      await loadInvoicesFromDb(true);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir do banco Neon: ' + err.message);
    } finally {
      setIsDbLoading(false);
    }
  };

  // Open Edit Form
  const handleEditOpen = (invoice: Invoice) => {
    setInvoiceToEdit(invoice);
    setIsFormOpen(true);
    // Smooth scroll to form container
    setTimeout(() => {
      document.getElementById('invoice-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Print single invoice
  const triggerSinglePrint = (invoice: Invoice) => {
    setSelectedInvoiceForPrinting([invoice]);
    setPrintTitle(`Relatório da Nota Fiscal ${invoice.number}`);
  };

  // Print list of (filtered) invoices
  const triggerBatchPrint = (filteredList: Invoice[]) => {
    setSelectedInvoiceForPrinting(filteredList);
    setPrintTitle('Relatório Comparativo Consolidado de Notas');
  };

  // Backup Features: Export JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(invoices, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `totvs_nf_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Backup Features: Import JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          // simple validation for invoice fields
          const isValid = parsed.every(item => item.number && item.supplierName && item.items);
          if (isValid) {
            setIsDbLoading(true);
            const res = await fetch('/api/invoices/restore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(parsed),
            });
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              throw new Error(errorData.error || 'Erro ao carregar registros no Neon.');
            }
            await loadInvoicesFromDb(false);
            alert('Banco de dados Neon restaurado e sincronizado com sucesso! ' + parsed.length + ' faturas carregadas.');
          } else {
            alert('Arquivo inválido. Formato incompatível com o banco da aplicação.');
          }
        } else {
          alert('Conteúdo do arquivo não é uma lista válida de faturas.');
        }
      } catch (err: any) {
        console.error(err);
        alert('Erro ao restaurar banco no Neon: ' + err.message);
      } finally {
        setIsDbLoading(false);
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  // Render Print view if active
  if (selectedInvoiceForPrinting) {
    return (
      <PrintReport 
        invoicesToPrint={selectedInvoiceForPrinting}
        title={printTitle}
        onBack={() => setSelectedInvoiceForPrinting(null)}
        currentDateStr="2026-06-05"
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-indigo-150 selection:text-indigo-900 pb-12">
      
      {/* HEADER SECTION WITH SUPPLIER CREDENTIALS */}
      <header className="bg-slate-900 text-white relative overflow-hidden border-b border-indigo-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-900/30 via-slate-900 to-slate-950 -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Logo and title */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-650 p-2 rounded-xl text-white shadow-lg shadow-indigo-700/20">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight leading-none text-white sm:text-2xl">
                    Controle de Compras TOTVS
                  </h1>
                  <div className="text-[10px] sm:text-xs text-indigo-200 mt-1.5 font-semibold tracking-wider uppercase font-mono flex items-center gap-2.5 flex-wrap">
                    <span>Fornecedor: TOTVS SA &nbsp;|&nbsp; Código: 000462</span>
                    {isDbLoading ? (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-[9px] normal-case animate-pulse flex items-center gap-1 font-sans">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"></span>
                        Sincronizando...
                      </span>
                    ) : dbError ? (
                      <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full text-[9px] normal-case flex items-center gap-1 font-sans">
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                        Modo Offline
                      </span>
                    ) : (
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[9px] normal-case flex items-center gap-1 font-sans">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                        Nuvem Neon DB 100% Sincronizado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Sync */}
            <div className="flex items-center gap-3 flex-wrap">
              <button 
                onClick={handleExportJSON}
                title="Fazer backup de todas as notas fiscais em disco como JSON"
                className="flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white px-3 py-2 rounded-lg transition-all border border-slate-700 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Backup Local
              </button>
              
              <label 
                title="Restaurar dados de compras a partir de um arquivo JSON"
                className="flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white px-3 py-2 rounded-lg transition-all border border-slate-700 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Restaurar Backup
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleImportJSON} 
                  className="hidden" 
                />
              </label>

              <button 
                onClick={() => {
                  setInvoiceToEdit(null);
                  setIsFormOpen(!isFormOpen);
                }}
                className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-all shadow-md cursor-pointer"
              >
                {isFormOpen ? 'Fechar Cadastro' : '+ Lançar Nota'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        
        {/* WARNINGS & SYSTEM NOTIFICATIONS */}
        <section id="notification-section">
          <NotificationPanel invoices={invoices} currentDateStr="2026-06-05" />
        </section>

        {/* INPUT FORM CONTAINER - Toggled dynamically */}
        {isFormOpen && (
          <section id="form-section">
            <InvoiceForm 
              onSave={handleSaveInvoice}
              onCancel={() => {
                setIsFormOpen(false);
                setInvoiceToEdit(null);
              }}
              editInvoice={invoiceToEdit}
            />
          </section>
        )}

        {/* ANALYTICS DASHBOARD - Primary central interface */}
        <section id="dashboard-section">
          <Dashboard 
            invoices={invoices}
            onEdit={handleEditOpen}
            onDelete={handleDeleteInvoice}
            onOpenForm={() => {
              setInvoiceToEdit(null);
              setIsFormOpen(true);
            }}
            onPrintPreview={triggerSinglePrint}
            onPrintAllInvoices={triggerBatchPrint}
            currentDateStr="2026-06-05"
          />
        </section>

        {/* OPTIONAL BACKUP/SECURITY INFORMATION CARD */}
        <section id="info-footer-card">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-3 items-start">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg mt-0.5"><Database className="w-5 h-5" /></div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">🔒 Banco de Dados Nuvem Neon PostgreSQL Sincronizado</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                  Os dados estão salvos de forma persistente e segura no seu banco **Neon PostgreSQL**. 
                  Dessa forma, você pode acessar e lançar novas notas fiscais de qualquer dispositivo ou lugar do mundo com sincronização em tempo real!
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowBackupInfo(!showBackupInfo)}
              className="text-xs font-bold text-indigo-650 hover:text-indigo-850 shrink-0 cursor-pointer"
            >
              {showBackupInfo ? 'Ocultar Instruções' : 'Ver Instruções'}
            </button>
          </div>

          {showBackupInfo && (
            <div className="mt-3 bg-indigo-50/40 border border-indigo-100 rounded-xl p-5 text-xs text-indigo-900 space-y-2 animate-fade-in">
              <p className="font-bold">Como manter seu dados de faturamento e auditoria seguros em nuvem?</p>
              <ol className="list-decimal pl-5 space-y-1.5 text-indigo-950 font-medium leading-relaxed">
                <li>Todas as alterações (cadastrar faturas, editar preços ou deletar) são salvas em tempo real no servidor na nuvem da <strong>Neon.tech</strong>.</li>
                <li>Caso mude de computador ou limpe o cache do dispositivo, seus dados continuarão sãos e salvos no servidor remoto.</li>
                <li>Por segurança, você ainda pode baixar um <strong>Backup Local</strong> no formato JSON no cabeçalho e restaurá-lo diretamente no Neon se desejar mover ou clonar os dados para outro banco de dados.</li>
              </ol>
            </div>
          )}
        </section>

      </main>

      {/* CONFIRMATION MODAL - Fully compatible with iframe */}
      {invoiceToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden transform scale-100 transition-all">
            {/* Header */}
            <div className="bg-rose-50 p-6 pb-4 flex items-start gap-4 border-b border-rose-100">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                <AlertCircle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Excluir Nota Fiscal</h3>
                <p className="text-xs text-slate-500 font-medium">Esta ação é permanente e irreversível no banco Neon DB.</p>
              </div>
            </div>

            {/* Content Details */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Você tem certeza que deseja remover esta nota fiscal de forma definitiva do banco de dados na nuvem?
              </p>
              
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 text-xs text-slate-700 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium font-mono">Nº NOTA:</span>
                  <span className="font-bold text-slate-900">{invoiceToDelete.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium font-mono">FORNECEDOR:</span>
                  <span className="font-semibold text-slate-800">{invoiceToDelete.supplierName}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-400 font-medium font-mono">VALOR TOTAL:</span>
                  <span className="font-black text-rose-700">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoiceToDelete.expectedTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-100">
              <button
                onClick={() => setInvoiceToDelete(null)}
                className="py-2.5 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteInvoice}
                disabled={isDbLoading}
                className="py-2.5 px-5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-xs transition-colors shadow-sm shadow-rose-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDbLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
