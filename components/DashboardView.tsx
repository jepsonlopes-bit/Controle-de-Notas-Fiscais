'use client';

import React from 'react';
import {
  FileText,
  DollarSign,
  TrendingUp,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  ArrowUpRight,
} from 'lucide-react';
import { DashboardMetrics, Obra } from '@/lib/types';
import { formatarMoeda } from '@/lib/formatters';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  loading: boolean;
  selectedObra: Obra | undefined;
  onNavigateLancamentos: () => void;
  onOpenNovoLancamento: () => void;
}

export function DashboardView({
  metrics,
  loading,
  selectedObra,
  onNavigateLancamentos,
  onOpenNovoLancamento,
}: DashboardViewProps) {
  if (loading || !metrics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
        </div>
      </div>
    );
  }

  if (!metrics || metrics.total_lancamentos === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Receipt className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">
          Nenhum lançamento registrado nesta obra
        </h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          {selectedObra
            ? `A obra "${selectedObra.nome}" ainda não possui notas fiscais ou medições cadastradas.`
            : 'Nenhum lançamento foi cadastrado no sistema até o momento.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onOpenNovoLancamento}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-emerald-700"
          >
            Cadastrar Primeiro Lançamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scope banner if filtered */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2.5 text-xs text-slate-600 sm:text-sm">
          <Building2 className="h-4 w-4 text-slate-400" />
          <span>Filtro de Análise:</span>
          <span className="font-semibold text-slate-900">
            {selectedObra ? `${selectedObra.codigo} - ${selectedObra.nome}` : 'Todas as Obras (Visão Consolidada)'}
          </span>
        </div>
        <button
          onClick={onNavigateLancamentos}
          className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
        >
          <span>Ver Tabela Completa</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Lançamentos */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total de Lançamentos</span>
            <FileText className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
              {metrics.total_lancamentos}
            </span>
            <span className="text-xs text-slate-500">registros</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            NFs, OCs e Medições processadas
          </div>
        </div>

        {/* Soma Valor Bruto */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Soma dos Valores Brutos</span>
            <DollarSign className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
            {formatarMoeda(metrics.soma_valor_bruto)}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Valor contratual total emitido
          </div>
        </div>

        {/* Soma Valor Líquido */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Soma dos Valores Líquidos</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-emerald-700 font-mono tabular-nums">
            {formatarMoeda(metrics.soma_valor_liquido)}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Desembolso líquido após deduções
          </div>
        </div>

        {/* Retenções / Impostos */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Retenções Tributárias / Diferença</span>
            <Receipt className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-slate-700 font-mono tabular-nums">
            {formatarMoeda(metrics.soma_retencoes)}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            INSS, ISS, IRRF ou retenção técnica
          </div>
        </div>
      </div>

      {/* Situação dos Pagamentos (Sem confundir data prevista com quitação efetiva) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Situação dos Pagamentos
            </h2>
            <p className="text-xs text-slate-500">
              Classificação financeira com base na quitação efetiva
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="text-emerald-700">
              Pago: {formatarMoeda(metrics.total_pago)}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-amber-700">
              Pendente: {formatarMoeda(metrics.total_pendente)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Pago */}
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-semibold">Pagamento Efetivado (Pago)</span>
            </div>
            <div className="mt-2 text-xl font-bold text-emerald-950 font-mono tabular-nums">
              {formatarMoeda(metrics.total_pago)}
            </div>
            <div className="mt-1 text-xs text-emerald-700">
              {metrics.situacao_pagamentos.find((s) => s.status === 'Pago')?.quantidade || 0} lançamentos liquidados
            </div>
          </div>

          {/* Pendente / Programado */}
          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 text-amber-800">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-semibold">Pendente de Pagamento</span>
            </div>
            <div className="mt-2 text-xl font-bold text-amber-950 font-mono tabular-nums">
              {formatarMoeda(metrics.total_pendente)}
            </div>
            <div className="mt-1 text-xs text-amber-700">
              {metrics.situacao_pagamentos.find((s) => s.status === 'Pendente')?.quantidade || 0} aguardando liberação
            </div>
          </div>

          {/* Outros / A Vencer */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-semibold">Programados / A Vencer</span>
            </div>
            <div className="mt-2 text-xl font-bold text-slate-900 font-mono tabular-nums">
              {metrics.situacao_pagamentos.find((s) => s.status === 'A Vencer')?.quantidade || 0}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {formatarMoeda(metrics.situacao_pagamentos.find((s) => s.status === 'A Vencer')?.total || 0)} a vencer
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Despesas por Categoria & Evolução por Período */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Distribuição por Categoria de Despesa */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Despesas por Categoria
            </h2>
            <p className="text-xs text-slate-500">
              Participação no total de valor bruto lançado
            </p>
          </div>

          <div className="space-y-4">
            {metrics.por_categoria.slice(0, 6).map((item) => (
              <div key={item.categoria} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">{item.categoria}</span>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="font-semibold text-slate-900">
                      {formatarMoeda(item.total_bruto)}
                    </span>
                    <span className="text-slate-400">({item.percentual.toFixed(1)}%)</span>
                  </div>
                </div>
                {/* Visual Bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-800"
                    style={{ width: `${Math.min(100, Math.max(2, item.percentual))}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-400">
                  {item.quantidade} lançamento(s) associado(s)
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evolução dos Valores por Período (Mês/Ano) */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Valores Agrupados por Período
            </h2>
            <p className="text-xs text-slate-500">
              Fluxo histórico de lançamentos por competência mensal
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {metrics.por_periodo.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Sem registros temporais suficientes
              </div>
            ) : (
              metrics.por_periodo.map((p) => (
                <div
                  key={p.mes_ano}
                  className="flex items-center justify-between py-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900 font-mono">
                      {p.mes_ano}
                    </span>
                    <span className="text-slate-400">
                      {p.quantidade} nota(s)
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900 font-mono tabular-nums">
                      {formatarMoeda(p.total_bruto)}
                    </p>
                    <p className="text-[11px] text-emerald-600 font-mono tabular-nums">
                      Líq: {formatarMoeda(p.total_liquido)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
