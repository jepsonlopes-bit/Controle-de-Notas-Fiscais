'use client';

import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Power,
  RotateCcw,
  Receipt,
  X,
} from 'lucide-react';
import { Obra, UserProfile } from '@/lib/types';
import { formatarDataHoraBR, formatarMoeda } from '@/lib/formatters';

interface ObraWithStats extends Obra {
  total_lancamentos?: number;
  total_bruto?: number;
}

interface ObrasViewProps {
  obras: ObraWithStats[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

export function ObrasView({ obras, currentUser, onRefresh }: ObrasViewProps) {
  const isAdmin = currentUser.role === 'ADMINISTRADOR';

  // Modal de Criação / Edição
  const [modalOpen, setModalOpen] = useState(false);
  const [editingObra, setEditingObra] = useState<Obra | null>(null);

  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal de Exclusão / Inativação de Obra
  const [deletingObra, setDeletingObra] = useState<ObraWithStats | null>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [reassignOption, setReassignOption] = useState(true);

  function openCreateModal() {
    setEditingObra(null);
    setCodigo(`OBR-${String(obras.length + 1).padStart(3, '0')}`);
    setNome('');
    setDescricao('');
    setStatus('ativo');
    setErrorMsg('');
    setModalOpen(true);
  }

  function openEditModal(obra: Obra) {
    setEditingObra(obra);
    setCodigo(obra.codigo);
    setNome(obra.nome);
    setDescricao(obra.descricao || '');
    setStatus(obra.status);
    setErrorMsg('');
    setModalOpen(true);
  }

  // Alternar rapidamente entre Ativa e Inativa
  async function handleToggleStatus(obra: Obra) {
    if (!isAdmin) return;
    const novoStatus = obra.status === 'ativo' ? 'inativo' : 'ativo';
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/obras', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: obra.id,
          status: novoStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessMsg(data.message || `Obra alterada para ${novoStatus === 'ativo' ? 'Ativa' : 'Inativa'}.`);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao alterar status da obra.');
    }
  }

  // Criar ou Editar Obra
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const isEdit = !!editingObra;
      const url = '/api/obras';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = isEdit
        ? { id: editingObra.id, nome, descricao, status }
        : { codigo, nome, descricao };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar obra.');
      }

      setSuccessMsg(data.message);
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar obra.');
    } finally {
      setLoading(false);
    }
  }

  // Excluir Obra
  async function handleConfirmDelete() {
    if (!deletingObra || !isAdmin) return;
    setIsProcessingDelete(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const url = `/api/obras?id=${deletingObra.id}&reassign=${reassignOption}`;
      const res = await fetch(url, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir obra.');
      }

      setSuccessMsg(data.message);
      setDeletingObra(null);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir obra.');
    } finally {
      setIsProcessingDelete(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Gestão de Múltiplas Obras
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
              Cadastre, edite, ative, inative ou exclua canteiros de obra e empreendimentos da empresa.
              Obras encerradas podem ser inativadas para manter todo o histórico fiscal intacto, ou
              excluídas com transferência automática dos registros para a matriz geral.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Cadastrar Nova Obra</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Obras Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-3.5 pl-4 pr-3">Código</th>
                <th className="py-3.5 px-3">Nome da Obra</th>
                <th className="py-3.5 px-3">Lançamentos Vinculados</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Data de Cadastro</th>
                {isAdmin && <th className="py-3.5 pr-4 pl-3 text-center">Ações de Gestão</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {obras.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Nenhuma obra cadastrada
                  </td>
                </tr>
              ) : (
                obras.map((obra) => {
                  const totalLancamentos = obra.total_lancamentos ?? 0;
                  const totalBruto = obra.total_bruto ?? 0;

                  return (
                    <tr key={obra.id} className="hover:bg-slate-50 transition-colors">
                      {/* Código */}
                      <td className="py-3.5 pl-4 pr-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {obra.codigo}
                      </td>

                      {/* Nome & Descrição */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-900">{obra.nome}</span>
                          {obra.nome.toUpperCase().includes('PROMORAR') && (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 font-medium whitespace-nowrap">
                              Matriz Principal
                            </span>
                          )}
                        </div>
                        {obra.descricao && (
                          <div className="text-[11px] text-slate-400 mt-0.5 max-w-sm truncate">
                            {obra.descricao}
                          </div>
                        )}
                      </td>

                      {/* Lançamentos vinculados */}
                      <td className="py-3.5 px-3 font-mono whitespace-nowrap">
                        <span className="font-medium text-slate-900">
                          {totalLancamentos} registro(s)
                        </span>
                        {totalBruto > 0 && (
                          <span className="text-slate-400 block text-[11px]">
                            {formatarMoeda(totalBruto)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            obra.status === 'ativo' ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              obra.status === 'ativo' ? 'bg-emerald-600' : 'bg-slate-300'
                            }`}
                          />
                          <span>{obra.status === 'ativo' ? 'Ativa' : 'Inativa (Histórica)'}</span>
                        </span>
                      </td>

                      {/* Data de Criação */}
                      <td className="py-3.5 px-3 text-slate-500 font-mono whitespace-nowrap">
                        {formatarDataHoraBR(obra.created_at)}
                      </td>

                      {/* Ações (Apenas Administrador) */}
                      {isAdmin && (
                        <td className="py-3.5 pr-4 pl-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Inativar / Ativar */}
                            <button
                              onClick={() => handleToggleStatus(obra)}
                              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                obra.status === 'ativo'
                                  ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                              title={obra.status === 'ativo' ? 'Inativar obra (mantém histórico)' : 'Reativar obra'}
                            >
                              <div className="flex items-center gap-1">
                                <Power className="h-3 w-3" />
                                <span>{obra.status === 'ativo' ? 'Inativar' : 'Ativar'}</span>
                              </div>
                            </button>

                            {/* Editar */}
                            <button
                              onClick={() => openEditModal(obra)}
                              className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              title="Editar código e dados da obra"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>

                            {/* Excluir obra */}
                            <button
                              onClick={() => setDeletingObra(obra)}
                              className="rounded-md border border-rose-200 p-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              title="Excluir obra"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explicação de Inativação vs Exclusão */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 flex items-start gap-3">
        <Info className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-900">
            Diferença entre Inativar e Excluir Obra:
          </p>
          <p className="leading-relaxed">
            • <strong>Inativar Obra (Recomendado):</strong> Oculta a obra de novos cadastros de notas fiscais, mas preserva integralmente
            todos os lançamentos históricos, filtros de relatórios e auditorias fiscais passadas.
          </p>
          <p className="leading-relaxed">
            • <strong>Excluir Obra:</strong> Remove a obra da base de dados. Caso possua lançamentos fiscais vinculados, o sistema permite transferi-los automaticamente para outra obra ativa para evitar exclusão acidental de registros contábeis.
          </p>
        </div>
      </div>

      {/* Modal: Excluir / Inativar Obra com Opções */}
      {deletingObra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-semibold text-base">
                <Trash2 className="h-5 w-5" />
                <span>Excluir Obra: {deletingObra.codigo}</span>
              </div>
              <button
                onClick={() => setDeletingObra(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-700">
              <p>
                Você solicitou a exclusão da obra <strong>{deletingObra.nome}</strong> (
                <code>{deletingObra.codigo}</code>).
              </p>

              {(deletingObra.total_lancamentos ?? 0) > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Esta obra possui {deletingObra.total_lancamentos} lançamento(s) vinculados</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Total em notas fiscais e medições:{' '}
                    <strong>{formatarMoeda(deletingObra.total_bruto)}</strong>.
                  </p>

                  <div className="pt-2 border-t border-amber-200/80">
                    <label className="flex items-start gap-2 cursor-pointer font-medium text-[11px]">
                      <input
                        type="checkbox"
                        checked={reassignOption}
                        onChange={(e) => setReassignOption(e.target.checked)}
                        className="rounded border-amber-400 mt-0.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        Transferir os lançamentos vinculados para outra obra ativa para manter o histórico fiscal
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-600">
                  <p className="text-[11px]">
                    Esta obra não possui nenhum lançamento fiscal vinculado. A exclusão pode ser feita sem impacto em relatórios.
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                Alternativamente, você pode apenas <strong>Inativar</strong> a obra para que ela deixe de receber lançamentos futuros, sem excluí-la.
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setDeletingObra(null)}
                className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>

              {/* Botão para Inativar em vez de excluir */}
              {deletingObra.status === 'ativo' && (
                <button
                  type="button"
                  onClick={() => {
                    handleToggleStatus(deletingObra);
                    setDeletingObra(null);
                  }}
                  className="w-full sm:w-auto rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Apenas Inativar Obra
                </button>
              )}

              {/* Botão de Excluir */}
              <button
                type="button"
                disabled={isProcessingDelete}
                onClick={handleConfirmDelete}
                className="w-full sm:w-auto rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs"
              >
                {isProcessingDelete ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Obra Modal (Create / Edit) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {editingObra ? 'Editar Obra' : 'Cadastrar Nova Obra'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {editingObra
                ? `Altere as informações da obra ${editingObra.codigo}`
                : 'Insira o código identificador e os detalhes do novo empreendimento'}
            </p>

            {errorMsg && (
              <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Código da Obra <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingObra}
                  placeholder="Ex: OBR-003"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:border-emerald-500 focus:outline-none disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nome da Obra <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Residencial Horizonte Sul"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Descrição / Finalidade
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalhes sobre escopo, endereço ou contrato"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {editingObra && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Status da Obra
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="ativo">Ativa (Recebe novos lançamentos)</option>
                    <option value="inativo">Inativa (Concluída / Encerrada)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs"
                >
                  {loading ? 'Salvando...' : editingObra ? 'Salvar Alterações' : 'Cadastrar Obra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
