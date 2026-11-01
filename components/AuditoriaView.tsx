'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Eye,
  Calendar,
  User,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { AuditLog, UserProfile } from '@/lib/types';
import { formatarDataHoraBR } from '@/lib/formatters';

interface AuditoriaViewProps {
  currentUser: UserProfile;
}

export function AuditoriaView({ currentUser }: AuditoriaViewProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [filterAcao, setFilterAcao] = useState('todas');
  const [filterEntidade, setFilterEntidade] = useState('todas');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedLog, setSelectedLog] = useState<AuditLog[] | null>(null);
  const [detailModalLog, setDetailModalLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (filterAcao !== 'todas') params.append('acao', filterAcao);
      if (filterEntidade !== 'todas') params.append('entidade', filterEntidade);
      if (searchTerm.trim()) params.append('busca', searchTerm.trim());

      const res = await fetch(`/api/audit?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.data || []);
        setTotal(data.total || 0);
        setTotalPages(data.total_paginas || 1);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, filterAcao, filterEntidade, searchTerm]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function getAcaoBadge(acao: string) {
    switch (acao) {
      case 'CRIACAO':
        return <span className="font-semibold text-emerald-700">Criação</span>;
      case 'EDICAO':
        return <span className="font-semibold text-blue-700">Correção / Edição</span>;
      case 'EXCLUSAO':
        return <span className="font-semibold text-rose-600">Exclusão</span>;
      case 'IMPORTACAO':
        return <span className="font-semibold text-purple-700">Importação Lote</span>;
      case 'EXCLUSAO_LOTE':
        return <span className="font-semibold text-amber-700">Reversão Lote</span>;
      case 'CADASTRO_OBRA':
      case 'EDICAO_OBRA':
      case 'STATUS_OBRA':
        return <span className="font-semibold text-indigo-700">Gestão Obra</span>;
      case 'CRIACAO_USUARIO':
      case 'STATUS_USUARIO':
        return <span className="font-semibold text-teal-700">Usuário / Acessos</span>;
      default:
        return <span className="font-semibold text-slate-700">{acao}</span>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span>Trilha de Auditoria e Conformidade</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
            Histórico imutável de todas as inclusões, correções, exclusões e importações no sistema.
            Cada evento registra de forma indelével o operador responsável, endereço/data-hora,
            identificador do registro e comparação entre os valores anteriores e os posteriores.
          </p>
        </div>

        {/* Filter bar */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por operador, e-mail, obra ou resumo da operação..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-4 pl-9 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterAcao}
              onChange={(e) => {
                setFilterAcao(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none"
            >
              <option value="todas">Todas as Ações</option>
              <option value="CRIACAO">Criação</option>
              <option value="EDICAO">Correção / Edição</option>
              <option value="EXCLUSAO">Exclusão</option>
              <option value="IMPORTACAO">Importação</option>
              <option value="EXCLUSAO_LOTE">Reversão de Lote</option>
              <option value="CADASTRO_OBRA">Cadastro de Obra</option>
              <option value="EDICAO_OBRA">Edição de Obra</option>
            </select>

            <select
              value={filterEntidade}
              onChange={(e) => {
                setFilterEntidade(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none"
            >
              <option value="todas">Todas as Entidades</option>
              <option value="lancamento">Lançamentos</option>
              <option value="obra">Obras</option>
              <option value="lote_importacao">Lotes de Importação</option>
              <option value="usuario">Usuários</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-3.5 pl-4 pr-3">Data e Hora</th>
                <th className="py-3.5 px-3">Operador Responsável</th>
                <th className="py-3.5 px-3">Ação</th>
                <th className="py-3.5 px-3">Entidade / Obra</th>
                <th className="py-3.5 px-3">Resumo da Modificação</th>
                <th className="py-3.5 pr-4 pl-3 text-center">Auditar Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Consultando trilha de auditoria...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Nenhum registro de auditoria encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 pl-4 pr-3 font-mono text-slate-500 whitespace-nowrap">
                      {formatarDataHoraBR(log.created_at)}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-900">{log.usuario_nome}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{log.usuario_email}</div>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">{getAcaoBadge(log.acao)}</td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="font-medium text-slate-700 capitalize">{log.entidade}</span>
                      {log.obra_nome && (
                        <div className="text-[11px] text-slate-400">{log.obra_nome}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-slate-700 max-w-md">
                      <p className="truncate" title={log.descricao_resumo}>
                        {log.descricao_resumo}
                      </p>
                    </td>
                    <td className="py-3.5 pr-4 pl-3 text-center whitespace-nowrap">
                      {(log.valores_anteriores || log.valores_novos) && (
                        <button
                          onClick={() => setDetailModalLog(log)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Inspecionar valores anteriores e posteriores"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <span>
            Total: <strong>{total}</strong> registros de auditoria
          </span>
          <div className="flex items-center gap-2">
            <span>
              Página <strong>{page}</strong> de <strong>{totalPages || 1}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Diff Inspector Modal */}
      {detailModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Inspeção de Auditoria: Valores Anteriores vs. Posteriores
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Operação: {detailModalLog.descricao_resumo} · Operador:{' '}
              {detailModalLog.usuario_nome} em {formatarDataHoraBR(detailModalLog.created_at)}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Valores Anteriores */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs font-semibold text-slate-700">Valores Anteriores</span>
                <pre className="mt-2 max-h-60 overflow-auto rounded bg-white p-2 text-[11px] font-mono text-slate-800 border border-slate-200">
                  {detailModalLog.valores_anteriores
                    ? JSON.stringify(detailModalLog.valores_anteriores, null, 2)
                    : '(Nenhum / Novo Registro)'}
                </pre>
              </div>

              {/* Valores Novos */}
              <div className="rounded-lg border border-slate-200 bg-emerald-50/50 p-3">
                <span className="text-xs font-semibold text-emerald-900">Valores Posteriores (Gravados)</span>
                <pre className="mt-2 max-h-60 overflow-auto rounded bg-white p-2 text-[11px] font-mono text-slate-800 border border-emerald-200">
                  {detailModalLog.valores_novos
                    ? JSON.stringify(detailModalLog.valores_novos, null, 2)
                    : '(Registro Excluído)'}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDetailModalLog(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
