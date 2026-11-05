'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RotateCcw,
  ArrowRight,
  Info,
  Building2,
  Download,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Obra, UserProfile, ImportBatch } from '@/lib/types';
import { formatarMoeda, formatarDataBR, formatarDataHoraBR } from '@/lib/formatters';
import { getClientSnapshot, saveClientSnapshot } from '@/lib/clientStorage';

interface ImportarPlanilhaViewProps {
  obras: Obra[];
  selectedObraId?: string;
  onSelectObra?: (id: string) => void;
  currentUser: UserProfile;
  onSuccessImport: () => void;
}

export function ImportarPlanilhaView({
  obras,
  selectedObraId: propSelectedObraId,
  onSelectObra,
  currentUser,
  onSuccessImport,
}: ImportarPlanilhaViewProps) {
  const isAdmin = currentUser.role === 'ADMINISTRADOR';

  // Obra selecionada padrão
  const getInitialObraId = () => {
    if (propSelectedObraId && propSelectedObraId !== 'todas' && obras.some((o) => o.id === propSelectedObraId)) {
      return propSelectedObraId;
    }
    const defaultObra = obras.find((o) => o.status === 'ativo') || obras[0];
    return defaultObra?.id || '';
  };

  const [selectedObraId, setSelectedObraId] = useState<string>(getInitialObraId);

  // Sincroniza sempre que a lista de obras ou a obra do header mudar
  useEffect(() => {
    if (obras && obras.length > 0) {
      setSelectedObraId((prev) => {
        if (prev && obras.some((o) => o.id === prev)) {
          return prev;
        }
        if (propSelectedObraId && propSelectedObraId !== 'todas' && obras.some((o) => o.id === propSelectedObraId)) {
          return propSelectedObraId;
        }
        const active = obras.find((o) => o.status === 'ativo') || obras[0];
        return active ? active.id : '';
      });
    }
  }, [obras, propSelectedObraId]);

  // Resolução da obra padrão e efetiva garantindo que nunca fique vazia se houver obras
  const resolvedObraId =
    selectedObraId ||
    (propSelectedObraId && propSelectedObraId !== 'todas' && obras.some((o) => o.id === propSelectedObraId)
      ? propSelectedObraId
      : '') ||
    obras.find((o) => o.status === 'ativo')?.id ||
    obras[0]?.id ||
    '';

  const selectedObra = obras.find((o) => o.id === resolvedObraId) || obras[0];
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Substituição de planilha existente
  const [substitutingBatch, setSubstitutingBatch] = useState<ImportBatch | null>(null);

  // Histórico de planilhas/lotes
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<ImportBatch | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await fetch('/api/importar', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Baixar modelo padrão de planilha Excel
  function downloadTemplate() {
    const templateData = [
      {
        'Fornecedor': 'Exemplo Construtora ABC Ltda',
        'Nº de OC': '004521',
        'Nº Medição': 'MED-01',
        'Nº NF': '000789',
        'Valor bruto': 15850.0,
        'Valor líquido': 14265.0,
        'Data de lançamento': '2026-10-15',
        'Data de pagamento': '2026-11-10',
        'Categoria de despesa': 'Fundações e Estrutura',
        'Observação': 'Parcela 1 de 2',
      },
      {
        'Fornecedor': 'Exemplo Construtora ABC Ltda',
        'Nº de OC': '004521',
        'Nº Medição': '', // Sem medição
        'Nº NF': '000789', // Mesma NF (parcela 2, data de pagamento diferente)
        'Valor bruto': 15850.0,
        'Valor líquido': 14265.0,
        'Data de lançamento': '2026-10-15',
        'Data de pagamento': '2026-12-10',
        'Categoria de despesa': 'Fundações e Estrutura',
        'Observação': 'Parcela 2 de 2',
      },
      {
        'Fornecedor': 'Distribuidora de Tubos e Conexões',
        'Nº de OC': '004522',
        'Nº Medição': '',
        'Nº NF': '001456',
        'Valor bruto': 4300.5,
        'Valor líquido': 4300.5,
        'Data de lançamento': '2026-10-20',
        'Data de pagamento': '2026-10-25',
        'Categoria de despesa': 'Instalações Hidráulicas',
        'Observação': 'Tubulação PVC predial',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo Importação');
    XLSX.writeFile(wb, 'Modelo_Controle_Lancamentos.xlsx');
  }

  // Leitura e envio de arquivo
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setSuccessMessage('');
    setValidationResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (data.length === 0) {
          setErrorMessage('A planilha selecionada está vazia.');
          return;
        }

        setRawRows(data);
        await runValidation(data, resolvedObraId);
      } catch (err: any) {
        setErrorMessage(`Falha ao ler o arquivo: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  }

  async function runValidation(rows: any[], obraId: string) {
    const targetObra = obraId || resolvedObraId || obras[0]?.id || '';

    setIsValidating(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'validar',
          obra_id: targetObra,
          linhas_brutas: rows,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro na validação da planilha.');
      }

      setValidationResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao validar planilha.');
    } finally {
      setIsValidating(false);
    }
  }

  // Confirmar importação definitiva (Apenas Administrador)
  async function handleConfirmImport() {
    if (!isAdmin) {
      setErrorMessage('Apenas o Administrador possui permissão para autorizar a importação.');
      return;
    }

    if (!validationResult || validationResult.total_validas === 0) {
      setErrorMessage('Não há registros válidos para importar.');
      return;
    }

    setIsConfirming(true);
    setErrorMessage('');

    const finalObraId = resolvedObraId || selectedObraId || obras[0]?.id || '';
    const finalObra = obras.find((o) => o.id === finalObraId) || selectedObra || obras[0];

    try {
      const res = await fetch('/api/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'confirmar',
          obra_id: finalObraId,
          obra_nome: finalObra?.nome || '',
          obra_codigo: finalObra?.codigo || '',
          arquivo_nome: fileName || 'planilha_importada.xlsx',
          linhas_validadas: validationResult.linhas,
          batch_id_substituir: substitutingBatch?.id || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao confirmar importação.');
      }

      // Salva imediatamente todos os novos registros no armazenamento permanente local
      if (Array.isArray(data.novosLancamentos)) {
        const currentSnap = getClientSnapshot();
        const existingLanc = substitutingBatch
          ? currentSnap.lancamentos.filter((l) => l.lote_importacao_id !== substitutingBatch.id)
          : currentSnap.lancamentos;
        const newLancList = [...data.novosLancamentos, ...existingLanc];
        const newBatches = data.batch
          ? [data.batch, ...currentSnap.import_batches.filter((b) => b.id !== data.batch.id)]
          : currentSnap.import_batches;
        const newObras = data.obra
          ? currentSnap.obras.some((o) => o.id === data.obra.id)
            ? currentSnap.obras
            : [...currentSnap.obras, data.obra]
          : currentSnap.obras;

        saveClientSnapshot({
          lancamentos: newLancList,
          import_batches: newBatches,
          obras: newObras,
        });
      }

      setSuccessMessage(data.message);
      setValidationResult(null);
      setRawRows([]);
      setFileName('');
      setSubstitutingBatch(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchBatches();
      onSuccessImport();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar importação.');
    } finally {
      setIsConfirming(false);
    }
  }

  // Excluir permanentemente lote de planilha
  async function handleConfirmDeleteBatch() {
    if (!isAdmin || !batchToDelete) return;
    setDeletingBatchId(batchToDelete.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/importar?batch_id=${batchToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir a planilha.');
      }

      const currentSnap = getClientSnapshot();
      saveClientSnapshot({
        lancamentos: currentSnap.lancamentos.filter((l) => l.lote_importacao_id !== batchToDelete.id),
        import_batches: currentSnap.import_batches.filter((b) => b.id !== batchToDelete.id),
      });

      setSuccessMessage(data.message);
      setBatchToDelete(null);
      fetchBatches();
      onSuccessImport();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao excluir planilha.');
    } finally {
      setDeletingBatchId(null);
    }
  }

  // Iniciar fluxo de substituição
  function handleStartSubstitute(batch: ImportBatch) {
    setSubstitutingBatch(batch);
    setSelectedObraId(batch.obra_id);
    setValidationResult(null);
    setRawRows([]);
    setFileName('');
    setErrorMessage('');
    setSuccessMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  function handleCancelSubstitute() {
    setSubstitutingBatch(null);
    setValidationResult(null);
    setRawRows([]);
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Importação da Planilha Matriz
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
              Importe suas planilhas de Excel (.xlsx, .xls) ou CSV sem restrições de duplicidade.
              O sistema preserva integralmente todas as parcelas de uma mesma NF (diferenciadas
              pela data de pagamento) e mantém os campos sem medição devidamente vazios.
            </p>
          </div>

          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Baixar Modelo Padrão (.xlsx)</span>
          </button>
        </div>

        {/* Substituting Notice Banner */}
        {substitutingBatch && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 shrink-0 text-amber-600 animate-spin" />
              <span>
                <strong>Modo de Substituição Ativo:</strong> você está substituindo a planilha{' '}
                <code className="font-mono font-bold">{substitutingBatch.arquivo_nome}</code> (Obra:{' '}
                {substitutingBatch.obra_nome}). Ao confirmar a nova planilha, os dados anteriores
                serão substituídos.
              </span>
            </div>
            <button
              onClick={handleCancelSubstitute}
              className="flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              <X className="h-3.5 w-3.5" />
              <span>Cancelar Substituição</span>
            </button>
          </div>
        )}

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form and Upload Step */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Obra de Destino */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              Obra de Destino <span className="text-rose-500">*</span>
            </label>
            {obras.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <div className="flex items-center gap-2 font-semibold">
                  <Building2 className="h-4 w-4 text-amber-600" />
                  <span>Nenhuma obra cadastrada ainda</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-700">
                  O sistema criará automaticamente a <strong>Obra Principal</strong> ao importar a planilha (você poderá cadastrar outras obras ou renomeá-la na aba Gestão de Obras).
                </p>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={resolvedObraId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedObraId(newId);
                    setErrorMessage('');
                    if (onSelectObra) {
                      onSelectObra(newId);
                    }
                    if (rawRows.length > 0) {
                      runValidation(rawRows, newId);
                    }
                  }}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  {obras.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.codigo} - {o.nome} {o.status === 'inativo' ? '(Inativa)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              Selecione a obra à qual os lançamentos e parcelas da planilha serão vinculados.
            </p>
          </div>

          {/* Upload Dropzone */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-800 mb-2">
              Arquivo da Planilha (.xlsx, .xls ou .csv)
            </label>
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center hover:bg-slate-50 transition-colors">
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="mt-2 text-xs font-medium text-slate-700">
                {fileName ? (
                  <span className="font-semibold text-emerald-600 font-mono">{fileName}</span>
                ) : (
                  'Clique para selecionar ou arraste sua planilha'
                )}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Mapeamento das 10 colunas: Fornecedor, Nº OC, Nº Medição, Nº NF, Valor bruto, Valor líquido, Data lançamento, Data pagamento, Categoria, Observação.
              </p>
              <label className="mt-4 cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800">
                {substitutingBatch ? 'Selecionar Nova Planilha para Substituir' : 'Escolher Arquivo'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Validation and Preview Section */}
      {isValidating && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-xs font-semibold text-slate-700">Carregando e validando planilha...</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Organizando parcelas, conferindo valores e preservando campos sem medição.
          </p>
        </div>
      )}

      {validationResult && !isValidating && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Pré-Visualização dos Registros da Planilha
              </h3>
              <p className="text-xs text-slate-500">
                {substitutingBatch
                  ? `Substituindo dados da planilha anterior por ${validationResult.total_validas} novos registros`
                  : `Todos os ${validationResult.total_validas} registros estão prontos para importação direta`}
              </p>
            </div>

            {/* Confirmation CTA (Admin Only) */}
            <div>
              {isAdmin ? (
                <>
                  <button
                    onClick={handleConfirmImport}
                    disabled={isConfirming || validationResult.total_validas === 0}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isConfirming ? (
                      'Gravando e definindo lançamentos padrão...'
                    ) : substitutingBatch ? (
                      <>
                        <span>Confirmar Substituição ({validationResult.total_validas} Registros)</span>
                        <RefreshCw className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <span>Confirmar e Tornar Lançamentos Padrões ({validationResult.total_validas} Registros)</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  <p className="mt-1.5 text-[11px] text-emerald-700 font-medium">
                    ✓ Ao confirmar, estes registros se tornarão a base oficial e padrão do sistema.
                  </p>
                </>
              ) : (
                <div className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800 font-medium">
                  Apenas o Administrador pode confirmar a importação
                </div>
              )}
            </div>
          </div>

          {/* Pre-Import Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 pt-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-[11px] text-slate-500">Total de Registros / Parcelas</span>
              <p className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                {validationResult.total_validas} linhas
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-[11px] text-slate-500">Soma Total Valor Bruto</span>
              <p className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                {formatarMoeda(validationResult.soma_bruto_validas)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-[11px] text-slate-500">Soma Total Valor Líquido</span>
              <p className="text-lg font-bold text-emerald-700 font-mono tabular-nums">
                {formatarMoeda(validationResult.soma_liquido_validas)}
              </p>
            </div>
          </div>

          {/* Preview Table */}
          <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                <tr>
                  <th className="py-2.5 pl-3 pr-2">Linha</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Fornecedor</th>
                  <th className="py-2.5 px-2">Nº OC</th>
                  <th className="py-2.5 px-2">Nº Medição</th>
                  <th className="py-2.5 px-2">Nº NF</th>
                  <th className="py-2.5 px-2 text-right">Valor Bruto</th>
                  <th className="py-2.5 px-2 text-right">Valor Líquido</th>
                  <th className="py-2.5 px-2">Lançamento</th>
                  <th className="py-2.5 px-2">Pagamento</th>
                  <th className="py-2.5 pr-3 pl-2">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {validationResult.linhas.map((r: any) => (
                  <tr key={r.linha} className="hover:bg-slate-50">
                    <td className="py-2 pl-3 pr-2 font-mono text-slate-500">{r.linha}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                        Válido
                      </span>
                    </td>
                    <td className="py-2 px-2 font-medium text-slate-900 max-w-[160px] truncate" title={r.fornecedor}>
                      {r.fornecedor || '-'}
                    </td>
                    <td className="py-2 px-2 font-mono">{r.numero_oc || '-'}</td>
                    <td className="py-2 px-2 font-mono text-slate-500">
                      {r.numero_medicao ? r.numero_medicao : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-2 px-2 font-mono font-medium">{r.numero_nf || '-'}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">
                      {formatarMoeda(r.valor_bruto)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-emerald-700 font-medium">
                      {formatarMoeda(r.valor_liquido)}
                    </td>
                    <td className="py-2 px-2 font-mono">{formatarDataBR(r.data_lancamento)}</td>
                    <td className="py-2 px-2 font-mono">{formatarDataBR(r.data_pagamento)}</td>
                    <td className="py-2 pr-3 pl-2 text-slate-500 max-w-[150px] truncate" title={r.observacao}>
                      {r.observacao || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Planilhas Importadas & Gerenciamento (Substituir ou Excluir) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Planilhas Importadas no Sistema
          </h3>
          <p className="text-xs text-slate-500">
            Gerencie as planilhas carregadas. Você pode substituir uma planilha por uma versão mais recente ou excluí-la completamente a qualquer momento.
          </p>
        </div>

        {loadingBatches ? (
          <div className="py-6 text-center text-xs text-slate-400">Carregando planilhas...</div>
        ) : batches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
            <FileSpreadsheet className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="font-medium text-slate-700">Nenhuma planilha importada atualmente</p>
            <p className="text-slate-400 mt-1">
              Faça o upload da sua planilha Excel ou CSV acima para visualizar e gerenciar os lançamentos.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {batches.map((b) => (
              <div
                key={b.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-900 font-mono">
                      {b.arquivo_nome}
                    </span>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span className="text-xs text-slate-700 font-medium">
                      Obra: {b.obra_nome}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{b.total_registros} lançamentos</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">
                      Bruto: {formatarMoeda(b.total_bruto)}
                    </span>
                    <span>·</span>
                    <span className="font-mono tabular-nums text-emerald-700">
                      Líq: {formatarMoeda(b.total_liquido)}
                    </span>
                    <span>·</span>
                    <span>Carregada por {b.usuario_nome} em {formatarDataHoraBR(b.created_at)}</span>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {/* Botão Substituir Planilha */}
                    <button
                      onClick={() => handleStartSubstitute(b)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      title="Substituir esta planilha por uma nova versão"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Substituir</span>
                    </button>

                    {/* Botão Excluir Planilha */}
                    <button
                      onClick={() => setBatchToDelete(b)}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                      title="Excluir esta planilha e todos os lançamentos vinculados a ela"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão da Planilha */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-semibold text-slate-900">
                Confirmar Exclusão da Planilha
              </h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Você deseja realmente excluir a planilha{' '}
              <strong className="font-mono text-slate-900">{batchToDelete.arquivo_nome}</strong>?
            </p>
            <p className="mt-2 text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg">
              Esta ação removerá todos os <strong>{batchToDelete.total_registros} lançamentos</strong> vinculados a esta planilha e será registrada na trilha de auditoria.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={deletingBatchId === batchToDelete.id}
                onClick={() => setBatchToDelete(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingBatchId === batchToDelete.id}
                onClick={handleConfirmDeleteBatch}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingBatchId === batchToDelete.id ? 'Excluindo...' : 'Confirmar e Excluir Planilha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
