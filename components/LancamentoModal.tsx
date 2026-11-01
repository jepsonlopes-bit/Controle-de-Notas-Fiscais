'use client';

import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Lancamento, Obra, UserProfile } from '@/lib/types';
import { formatarDataHoraBR } from '@/lib/formatters';

interface LancamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lancamento?: Lancamento | null;
  obras: Obra[];
  defaultObraId?: string;
  currentUser: UserProfile;
  isReadOnly?: boolean;
}

export function LancamentoModal(props: LancamentoModalProps) {
  if (!props.isOpen) return null;
  return <LancamentoModalContent key={props.lancamento?.id || 'novo'} {...props} />;
}

function LancamentoModalContent({
  onClose,
  onSuccess,
  lancamento,
  obras,
  defaultObraId,
  currentUser,
  isReadOnly = false,
}: LancamentoModalProps) {
  const isEditing = !!lancamento;

  const [obraId, setObraId] = useState(
    lancamento?.obra_id ||
      (defaultObraId && defaultObraId !== 'todas' ? defaultObraId : obras[0]?.id || '')
  );
  const [fornecedor, setFornecedor] = useState(lancamento?.fornecedor || '');
  const [numeroOc, setNumeroOc] = useState(lancamento?.numero_oc || '');
  const [numeroMedicao, setNumeroMedicao] = useState(lancamento?.numero_medicao || '');
  const [numeroNf, setNumeroNf] = useState(lancamento?.numero_nf || '');
  const [valorBruto, setValorBruto] = useState<string>(
    lancamento ? String(lancamento.valor_bruto) : ''
  );
  const [valorLiquido, setValorLiquido] = useState<string>(
    lancamento ? String(lancamento.valor_liquido) : ''
  );
  const [dataLancamento, setDataLancamento] = useState(
    lancamento?.data_lancamento || new Date().toISOString().split('T')[0]
  );
  const [dataPagamento, setDataPagamento] = useState(lancamento?.data_pagamento || '');
  const [statusPagamento, setStatusPagamento] = useState<'Pendente' | 'Pago' | 'A Vencer' | 'Cancelado'>(
    lancamento?.status_pagamento || 'Pendente'
  );
  const [dataConfirmacaoPagamento, setDataConfirmacaoPagamento] = useState(
    lancamento?.data_confirmacao_pagamento || ''
  );
  const [categoriaDespesa, setCategoriaDespesa] = useState(
    lancamento?.categoria_despesa || 'Material Civil'
  );
  const [observacao, setObservacao] = useState(lancamento?.observacao || '');

  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [avisoDuplicidade, setAvisoDuplicidade] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent, forceDuplicate = false) {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const payload = {
        obra_id: obraId,
        fornecedor,
        numero_oc: numeroOc,
        numero_medicao: numeroMedicao,
        numero_nf: numeroNf,
        valor_bruto: parseFloat(valorBruto),
        valor_liquido: parseFloat(valorLiquido),
        data_lancamento: dataLancamento,
        data_pagamento: dataPagamento || undefined,
        status_pagamento: statusPagamento,
        data_confirmacao_pagamento: dataConfirmacaoPagamento || undefined,
        categoria_despesa: categoriaDespesa,
        observacao,
        ignorar_aviso_duplicidade: forceDuplicate,
      };

      const url = '/api/lancamentos';
      const method = isEditing ? 'PUT' : 'POST';
      const bodyData = isEditing && lancamento ? { id: lancamento.id, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      const data = await res.json();

      if (res.status === 409 && data.aviso_duplicidade && !forceDuplicate) {
        setAvisoDuplicidade(data.message);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar lançamento.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar formulário.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="relative my-8 w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {isReadOnly
                ? 'Detalhes do Lançamento'
                : isEditing
                ? 'Editar Lançamento / Medição'
                : 'Cadastrar Novo Lançamento'}
            </h2>
            <p className="text-xs text-slate-500">
              {isReadOnly
                ? 'Consulta de informações da nota fiscal e medição'
                : 'Preencha os dados conforme matriz de controle de notas fiscais'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4 p-6">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {avisoDuplicidade && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-900">Possível Duplicidade Detectada</p>
                  <p className="mt-1">{avisoDuplicidade}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => handleSubmit(e, true)}
                      className="rounded-md bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700"
                    >
                      Confirmar e Cadastrar Mesmo Assim
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvisoDuplicidade(null)}
                      className="rounded-md border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-100"
                    >
                      Revisar Dados
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Obra de destino */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Obra Vinculada <span className="text-rose-500">*</span>
              </label>
              <select
                disabled={isReadOnly}
                value={obraId}
                onChange={(e) => setObraId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              >
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.codigo} - {o.nome} {o.status === 'inativo' ? '(Inativa)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Fornecedor */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Fornecedor <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                required
                placeholder="Ex: Construtora Rocha & Filhos Ltda"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              />
            </div>

            {/* Nº de OC */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Nº de OC (Ordem de Compra) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                required
                placeholder="Ex: 004521"
                value={numeroOc}
                onChange={(e) => setNumeroOc(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              />
              <span className="text-[11px] text-slate-400">Preserva zeros à esquerda</span>
            </div>

            {/* Nº NF */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Nº NF (Nota Fiscal) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                required
                placeholder="Ex: 0001289"
                value={numeroNf}
                onChange={(e) => setNumeroNf(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              />
              <span className="text-[11px] text-slate-400">Preserva zeros à esquerda</span>
            </div>

            {/* Nº Medição (Opcional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Nº da Medição <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                placeholder="Ex: MED-04 ou 002"
                value={numeroMedicao}
                onChange={(e) => setNumeroMedicao(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              />
            </div>

            {/* Categoria de Despesa */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Categoria de Despesa <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                list="categorias-list"
                placeholder="Ex: Estrutura, Mão de Obra, Elétrica"
                value={categoriaDespesa}
                onChange={(e) => setCategoriaDespesa(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              />
              <datalist id="categorias-list">
                <option value="Material Civil" />
                <option value="Mão de Obra e Empreiteiros" />
                <option value="Locação de Equipamentos" />
                <option value="Instalações Elétricas" />
                <option value="Instalações Hidráulicas" />
                <option value="Fundações e Estrutura" />
                <option value="Serviços Técnicos e Projetos" />
                <option value="Despesas Administrativas" />
              </datalist>
            </div>

            {/* Valor Bruto */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Valor Bruto (R$) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={isReadOnly}
                required
                placeholder="0.00"
                value={valorBruto}
                onChange={(e) => setValorBruto(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              />
            </div>

            {/* Valor Líquido */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Valor Líquido (R$) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={isReadOnly}
                required
                placeholder="0.00"
                value={valorLiquido}
                onChange={(e) => setValorLiquido(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              />
            </div>

            {/* Data de Lançamento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Data de Lançamento <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                disabled={isReadOnly}
                required
                value={dataLancamento}
                onChange={(e) => setDataLancamento(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              />
            </div>

            {/* Data Prevista de Pagamento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Data Prevista de Pagamento <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="date"
                disabled={isReadOnly}
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              />
            </div>

            {/* Situação do Pagamento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Situação do Pagamento
              </label>
              <select
                disabled={isReadOnly}
                value={statusPagamento}
                onChange={(e) => setStatusPagamento(e.target.value as any)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              >
                <option value="Pendente">Pendente de Pagamento</option>
                <option value="Pago">Pago (Efetivado)</option>
                <option value="A Vencer">Programado / A Vencer</option>
                <option value="Cancelado">Cancelado / Estornado</option>
              </select>
            </div>

            {/* Confirmação Efetiva de Pagamento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Data de Confirmação Efetiva <span className="text-slate-400 font-normal">(Quitação)</span>
              </label>
              <input
                type="date"
                disabled={isReadOnly}
                value={dataConfirmacaoPagamento}
                onChange={(e) => {
                  setDataConfirmacaoPagamento(e.target.value);
                  if (e.target.value && statusPagamento === 'Pendente') {
                    setStatusPagamento('Pago');
                  }
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              />
              <span className="text-[11px] text-slate-400">Distingue previsão da quitação real</span>
            </div>

            {/* Observação */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Observação <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <textarea
                rows={2}
                disabled={isReadOnly}
                placeholder="Observações complementares, notas técnicas ou condições de pagamento"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 sm:text-sm"
              />
            </div>
          </div>

          {/* Audit Metadata Banner (if existing record) */}
          {lancamento && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  <strong>ID:</strong> <code className="font-mono">{lancamento.id}</code>
                </span>
                <span>·</span>
                <span>
                  <strong>Cadastrado por:</strong> {lancamento.criado_por_nome}
                </span>
                <span>·</span>
                <span>
                  <strong>Criado em:</strong> {formatarDataHoraBR(lancamento.created_at)}
                </span>
                {lancamento.atualizado_por_nome && (
                  <>
                    <span>·</span>
                    <span>
                      <strong>Última alteração:</strong> {lancamento.atualizado_por_nome} (
                      {formatarDataHoraBR(lancamento.updated_at)})
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {isReadOnly ? 'Fechar' : 'Cancelar'}
            </button>

            {!isReadOnly && (
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Salvando...' : isEditing ? 'Salvar Correção' : 'Cadastrar Lançamento'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
