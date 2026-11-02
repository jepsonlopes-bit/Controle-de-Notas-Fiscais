'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Building2,
  Calendar,
  AlertCircle,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Lancamento, Obra, UserProfile } from '@/lib/types';
import { formatarMoeda, formatarDataBR } from '@/lib/formatters';

interface LancamentosViewProps {
  lancamentos: Lancamento[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  somaBruto: number;
  somaLiquido: number;
  loading: boolean;
  obras: Obra[];
  selectedObraId: string;
  onSelectObra: (id: string) => void;
  currentUser: UserProfile;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  filterCategoria: string;
  onFilterCategoriaChange: (val: string) => void;
  filterStatus: string;
  onFilterStatusChange: (val: string) => void;
  dataLancInicio: string;
  onDataLancInicioChange: (val: string) => void;
  dataLancFim: string;
  onDataLancFimChange: (val: string) => void;
  dataPagInicio: string;
  onDataPagInicioChange: (val: string) => void;
  dataPagFim: string;
  onDataPagFimChange: (val: string) => void;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (column: string) => void;
  onOpenNovoLancamento: () => void;
  onEditLancamento: (l: Lancamento) => void;
  onViewLancamento: (l: Lancamento) => void;
  onDeleteLancamento: (id: string) => Promise<void>;
  onResetFilters: () => void;
}

export function LancamentosView({
  lancamentos,
  total,
  page,
  totalPages,
  limit,
  somaBruto,
  somaLiquido,
  loading,
  obras,
  selectedObraId,
  onSelectObra,
  currentUser,
  searchTerm,
  onSearchChange,
  filterCategoria,
  onFilterCategoriaChange,
  filterStatus,
  onFilterStatusChange,
  dataLancInicio,
  onDataLancInicioChange,
  dataLancFim,
  onDataLancFimChange,
  dataPagInicio,
  onDataPagInicioChange,
  dataPagFim,
  onDataPagFimChange,
  onPageChange,
  onLimitChange,
  sortBy,
  sortOrder,
  onSortChange,
  onOpenNovoLancamento,
  onEditLancamento,
  onViewLancamento,
  onDeleteLancamento,
  onResetFilters,
}: LancamentosViewProps) {
  const isAdmin = currentUser.role === 'ADMINISTRADOR';
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Exportar para Excel (.xlsx)
  function exportToExcel() {
    if (lancamentos.length === 0) return;

    const dataToExport = lancamentos.map((l) => ({
      'Obra': l.obra_nome || '',
      'Fornecedor': l.fornecedor,
      'Nº de OC': l.numero_oc,
      'Nº Medição': l.numero_medicao || '',
      'Nº NF': l.numero_nf,
      'Valor bruto': l.valor_bruto,
      'Valor líquido': l.valor_liquido,
      'Data de lançamento': formatarDataBR(l.data_lancamento),
      'Data de pagamento': formatarDataBR(l.data_pagamento),
      'Situação do Pagamento': l.status_pagamento,
      'Confirmação Quitação': formatarDataBR(l.data_confirmacao_pagamento),
      'Categoria de despesa': l.categoria_despesa || '',
      'Observação': l.observacao || '',
      'Cadastrado por': l.criado_por_nome,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lançamentos');
    XLSX.writeFile(
      workbook,
      `Controle_NFs_Medicoes_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  }

  // Exportar para CSV
  function exportToCSV() {
    if (lancamentos.length === 0) return;

    const headers = [
      'Obra',
      'Fornecedor',
      'Nº OC',
      'Nº Medicao',
      'Nº NF',
      'Valor Bruto',
      'Valor Liquido',
      'Data Lancamento',
      'Data Pagamento',
      'Situacao Pagamento',
      'Categoria',
      'Observacao',
    ];

    const rows = lancamentos.map((l) => [
      `"${l.obra_nome || ''}"`,
      `"${l.fornecedor.replace(/"/g, '""')}"`,
      `"${l.numero_oc}"`,
      `"${l.numero_medicao || ''}"`,
      `"${l.numero_nf}"`,
      l.valor_bruto.toFixed(2),
      l.valor_liquido.toFixed(2),
      l.data_lancamento,
      l.data_pagamento || '',
      `"${l.status_pagamento}"`,
      `"${(l.categoria_despesa || '').replace(/"/g, '""')}"`,
      `"${(l.observacao || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Controle_NFs_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleConfirmDelete() {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await onDeleteLancamento(deletingId);
      setDeletingId(null);
    } catch (err: any) {
      alert('Erro ao excluir lançamento: ' + (err.message || 'Falha na operação'));
    } finally {
      setIsDeleting(false);
    }
  }

  const hasActiveFilters =
    searchTerm ||
    filterCategoria !== 'todas' ||
    filterStatus !== 'todos' ||
    dataLancInicio ||
    dataLancFim ||
    dataPagInicio ||
    dataPagFim;

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Fornecedor, Nº de OC, Medição ou Nº de NF..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-4 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none sm:text-sm"
            />
          </div>

          {/* Action buttons strip */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                hasActiveFilters || showAdvancedFilters
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filtros</span>
              {hasActiveFilters && (
                <span className="ml-1 rounded-full bg-emerald-600 px-1.5 py-0.2 text-[10px] text-white">
                  Ativos
                </span>
              )}
            </button>

            {/* Export buttons */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white">
              <button
                onClick={exportToExcel}
                disabled={lancamentos.length === 0}
                className="flex items-center gap-1.5 border-r border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="Exportar para Excel (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Excel</span>
              </button>
              <button
                onClick={exportToCSV}
                disabled={lancamentos.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="Exportar para CSV"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>

            {/* New Entry Button */}
            <button
              onClick={onOpenNovoLancamento}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span>Cadastrar Lançamento</span>
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {showAdvancedFilters && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Categoria */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Categoria de Despesa
                </label>
                <select
                  value={filterCategoria}
                  onChange={(e) => onFilterCategoriaChange(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="todas">Todas as Categorias</option>
                  <option value="Material Civil">Material Civil</option>
                  <option value="Mão de Obra e Empreiteiros">Mão de Obra e Empreiteiros</option>
                  <option value="Locação de Equipamentos">Locação de Equipamentos</option>
                  <option value="Instalações Elétricas">Instalações Elétricas</option>
                  <option value="Instalações Hidráulicas">Instalações Hidráulicas</option>
                  <option value="Fundações e Estrutura">Fundações e Estrutura</option>
                  <option value="Serviços Técnicos e Projetos">Serviços Técnicos e Projetos</option>
                  <option value="Despesas Administrativas">Despesas Administrativas</option>
                </select>
              </div>

              {/* Status de Pagamento */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Situação do Pagamento
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => onFilterStatusChange(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="Pendente">Pendente de Pagamento</option>
                  <option value="Pago">Pago (Efetivado)</option>
                  <option value="A Vencer">Programado / A Vencer</option>
                  <option value="Cancelado">Cancelado / Estornado</option>
                </select>
              </div>

              {/* Data de Lançamento (De / Até) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Data de Lançamento
                </label>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="date"
                    value={dataLancInicio}
                    onChange={(e) => onDataLancInicioChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Início"
                  />
                  <span className="text-slate-400">até</span>
                  <input
                    type="date"
                    value={dataLancFim}
                    onChange={(e) => onDataLancFimChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Fim"
                  />
                </div>
              </div>

              {/* Data de Pagamento (De / Até) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Data de Pagamento
                </label>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="date"
                    value={dataPagInicio}
                    onChange={(e) => onDataPagInicioChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-slate-400">até</span>
                  <input
                    type="date"
                    value={dataPagFim}
                    onChange={(e) => onDataPagFimChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={onResetFilters}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                >
                  Limpar todos os filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Financial Summary Strip of Current Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <span>Total filtrado:</span>
          <span className="font-bold text-slate-900 font-mono tabular-nums">{total}</span>
          <span>registros</span>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Soma Bruto:</span>
            <span className="font-bold text-slate-900 font-mono tabular-nums">
              {formatarMoeda(somaBruto)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Soma Líquido:</span>
            <span className="font-bold text-emerald-700 font-mono tabular-nums">
              {formatarMoeda(somaLiquido)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Diferença/Retenções:</span>
            <span className="font-bold text-slate-700 font-mono tabular-nums">
              {formatarMoeda(Math.max(0, somaBruto - somaLiquido))}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th
                  onClick={() => onSortChange('obra_nome')}
                  className="cursor-pointer py-3.5 pl-4 pr-3 hover:text-emerald-700"
                >
                  <div className="flex items-center gap-1">
                    <span>Obra</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => onSortChange('fornecedor')}
                  className="cursor-pointer py-3.5 px-3 hover:text-emerald-700"
                >
                  <div className="flex items-center gap-1">
                    <span>Fornecedor</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => onSortChange('numero_oc')}
                  className="cursor-pointer py-3.5 px-3 hover:text-emerald-700"
                >
                  <div className="flex items-center gap-1">
                    <span>Nº OC</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-3">Nº Medição</th>
                <th
                  onClick={() => onSortChange('numero_nf')}
                  className="cursor-pointer py-3.5 px-3 hover:text-emerald-700"
                >
                  <div className="flex items-center gap-1">
                    <span>Nº NF</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => onSortChange('valor_bruto')}
                  className="cursor-pointer py-3.5 px-3 text-right hover:text-emerald-700"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Valor Bruto</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => onSortChange('valor_liquido')}
                  className="cursor-pointer py-3.5 px-3 text-right hover:text-emerald-700"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Valor Líquido</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => onSortChange('data_lancamento')}
                  className="cursor-pointer py-3.5 px-3 hover:text-emerald-700"
                >
                  <div className="flex items-center gap-1">
                    <span>Lançamento</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-3">Pagamento</th>
                <th className="py-3.5 px-3">Situação</th>
                <th className="py-3.5 pr-4 pl-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    Carregando lançamentos...
                  </td>
                </tr>
              ) : lancamentos.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Nenhum lançamento encontrado
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Tente ajustar os filtros ou cadastre um novo registro.
                    </p>
                  </td>
                </tr>
              ) : (
                lancamentos.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Obra */}
                    <td className="py-3 pl-4 pr-3 font-medium text-slate-900 whitespace-nowrap">
                      {item.obra_nome}
                    </td>

                    {/* Fornecedor */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 max-w-[200px] truncate" title={item.fornecedor}>
                        {item.fornecedor}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {item.categoria_despesa || 'Geral'}
                      </div>
                    </td>

                    {/* Nº OC */}
                    <td className="py-3 px-3 font-mono font-medium text-slate-700 tabular-nums">
                      {item.numero_oc}
                    </td>

                    {/* Nº Medição */}
                    <td className="py-3 px-3 font-mono text-slate-600">
                      {item.numero_medicao || '-'}
                    </td>

                    {/* Nº NF */}
                    <td className="py-3 px-3 font-mono font-semibold text-slate-900 tabular-nums">
                      {item.numero_nf}
                    </td>

                    {/* Valor Bruto */}
                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-900 tabular-nums whitespace-nowrap">
                      {formatarMoeda(item.valor_bruto)}
                    </td>

                    {/* Valor Líquido */}
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                      {formatarMoeda(item.valor_liquido)}
                    </td>

                    {/* Data Lançamento */}
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap font-mono">
                      {formatarDataBR(item.data_lancamento)}
                    </td>

                    {/* Data Pagamento */}
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap font-mono">
                      {formatarDataBR(item.data_pagamento)}
                    </td>

                    {/* Situação */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium ${
                          item.status_pagamento === 'Pago'
                            ? 'text-emerald-700'
                            : item.status_pagamento === 'Pendente'
                            ? 'text-amber-700'
                            : item.status_pagamento === 'A Vencer'
                            ? 'text-blue-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {item.status_pagamento}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="py-3 pr-4 pl-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {/* Visualizar (disponível para todos) */}
                        <button
                          onClick={() => onViewLancamento(item)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="Visualizar detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Editar (Apenas Administrador) */}
                        {isAdmin ? (
                          <button
                            onClick={() => onEditLancamento(item)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                            title="Editar lançamento (Admin)"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}

                        {/* Excluir (Apenas Administrador) */}
                        {isAdmin ? (
                          <button
                            onClick={() => setDeletingId(item.id)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            title="Excluir lançamento (Admin)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Exibindo</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>por página · Total: {total}</span>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Página <strong>{page}</strong> de <strong>{totalPages || 1}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal (Admin Only) */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-semibold text-slate-900">
                Confirmar Exclusão de Registro
              </h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Você está prestes a excluir este lançamento.
              Esta operação será <strong>registrada integralmente na trilha de auditoria</strong> com seus dados, data e hora.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingId(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar e Registrar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
