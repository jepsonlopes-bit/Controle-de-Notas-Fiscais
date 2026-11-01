'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Obra, UserProfile, ImportBatch } from '@/lib/types';
import { formatarMoeda, formatarDataBR, formatarDataHoraBR } from '@/lib/formatters';

interface ImportarPlanilhaViewProps {
  obras: Obra[];
  currentUser: UserProfile;
  onSuccessImport: () => void;
}

export function ImportarPlanilhaView({
  obras,
  currentUser,
  onSuccessImport,
}: ImportarPlanilhaViewProps) {
  const isAdmin = currentUser.role === 'ADMINISTRADOR';

  // Find PROMORAR obra by default
  const promorarObra = obras.find((o) => o.nome.toUpperCase().includes('PROMORAR')) || obras[0];

  const [selectedObraId, setSelectedObraId] = useState<string>(promorarObra?.id || '');
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Past batches
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [revertingBatchId, setRevertingBatchId] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await fetch('/api/importar');
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

  // Baixar modelo de planilha Excel
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
        'Observação': 'Medição de formas e concretagem bloco A',
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
    XLSX.writeFile(wb, 'Modelo_Controle_NFs_Medicoes.xlsx');
  }

  // Processar arquivo selecionado pelo usuário
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
        // Validar no backend
        await runValidation(data, selectedObraId);
      } catch (err: any) {
        setErrorMessage(`Falha ao ler o arquivo: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  }

  async function runValidation(rows: any[], obraId: string) {
    const targetObra = obraId || obras[0]?.id || '';

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

  // Confirmar importação definitiva (apenas Administrador)
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

    try {
      const res = await fetch('/api/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'confirmar',
          obra_id: selectedObraId,
          arquivo_nome: fileName || 'planilha_importada.xlsx',
          linhas_validadas: validationResult.linhas,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao confirmar importação.');
      }

      setSuccessMessage(data.message);
      setValidationResult(null);
      setRawRows([]);
      setFileName('');
      fetchBatches();
      onSuccessImport();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar importação.');
    } finally {
      setIsConfirming(false);
    }
  }

  // Reverter / Excluir lote de importação caso o administrador se arrependa
  async function handleRollbackBatch(batchId: string) {
    if (!isAdmin) return;
    setRevertingBatchId(batchId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/importar?batch_id=${batchId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao reverter lote de importação.');
      }

      setSuccessMessage(data.message);
      fetchBatches();
      onSuccessImport();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao reverter lote.');
    } finally {
      setRevertingBatchId(null);
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
              Importe seus dados legados de Excel (.xlsx, .xls) ou CSV com mapeamento automático
              das dez colunas originais. O sistema realiza conferência prévia de integridade, cálculo
              de totais e detecção de duplicidades antes da gravação definitiva.
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
            <div className="relative">
              <select
                value={selectedObraId}
                onChange={(e) => {
                  setSelectedObraId(e.target.value);
                  if (rawRows.length > 0) {
                    runValidation(rawRows, e.target.value);
                  }
                }}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
              >
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.codigo} - {o.nome} {o.nome.toUpperCase().includes('PROMORAR') ? '(Padrão Inicial)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-400">
              Selecione a obra de destino à qual os lançamentos da planilha serão vinculados.
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
                Mapeamento das 10 colunas: Fornecedor, Nº OC, Nº Medição, Nº NF, Valor bruto, Valor líquido, etc.
              </p>
              <label className="mt-4 cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800">
                Escolher Arquivo
                <input
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
          <p className="text-xs font-semibold text-slate-700">Validando dados da planilha...</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Conferindo valores, formatação de datas e detecção de duplicidades.
          </p>
        </div>
      )}

      {validationResult && !isValidating && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Relatório de Pré-Visualização e Conferência
              </h3>
              <p className="text-xs text-slate-500">
                Confira os totais antes de autorizar a gravação definitiva no banco de dados
              </p>
            </div>

            {/* Confirmation CTA (Admin Only) */}
            <div>
              {isAdmin ? (
                <button
                  onClick={handleConfirmImport}
                  disabled={isConfirming || validationResult.total_validas === 0}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isConfirming ? (
                    'Gravando no banco...'
                  ) : (
                    <>
                      <span>Confirmar e Importar {validationResult.total_validas} Registros</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              ) : (
                <div className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800 font-medium">
                  Apenas o Administrador pode confirmar a importação
                </div>
              )}
            </div>
          </div>

          {/* Pre-Import Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-[11px] text-slate-500">Registros Válidos</span>
              <p className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                {validationResult.total_validas} / {validationResult.total_lidas}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-[11px] text-slate-500">Total Valor Bruto</span>
              <p className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                {formatarMoeda(validationResult.soma_bruto_validas)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-[11px] text-slate-500">Total Valor Líquido</span>
              <p className="text-lg font-bold text-emerald-700 font-mono tabular-nums">
                {formatarMoeda(validationResult.soma_liquido_validas)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-[11px] text-slate-500">Alertas / Erros</span>
              <p
                className={`text-lg font-bold font-mono tabular-nums ${
                  validationResult.total_com_erros > 0 ? 'text-rose-600' : 'text-slate-700'
                }`}
              >
                {validationResult.total_com_erros} erros · {validationResult.total_duplicadas_detectadas} duplicatas
              </p>
            </div>
          </div>

          {/* Preview Table */}
          <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                <tr>
                  <th className="py-2.5 pl-3 pr-2">Linha</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Fornecedor</th>
                  <th className="py-2.5 px-2">Nº OC</th>
                  <th className="py-2.5 px-2">Nº NF</th>
                  <th className="py-2.5 px-2 text-right">Valor Bruto</th>
                  <th className="py-2.5 px-2 text-right">Valor Líquido</th>
                  <th className="py-2.5 px-2">Lançamento</th>
                  <th className="py-2.5 pr-3 pl-2">Observações/Erros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {validationResult.linhas.slice(0, 50).map((r: any) => (
                  <tr
                    key={r.linha}
                    className={
                      !r.valida
                        ? 'bg-rose-50/50'
                        : r.is_duplicada
                        ? 'bg-amber-50/50'
                        : 'hover:bg-slate-50'
                    }
                  >
                    <td className="py-2 pl-3 pr-2 font-mono text-slate-500">{r.linha}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      {r.valida ? (
                        r.is_duplicada ? (
                          <span className="text-amber-700 font-medium">Alerta Duplicata</span>
                        ) : (
                          <span className="text-emerald-700 font-medium">Válido</span>
                        )
                      ) : (
                        <span className="text-rose-600 font-medium">Invalido</span>
                      )}
                    </td>
                    <td className="py-2 px-2 font-medium text-slate-900 max-w-[150px] truncate">
                      {r.fornecedor || '-'}
                    </td>
                    <td className="py-2 px-2 font-mono">{r.numero_oc || '-'}</td>
                    <td className="py-2 px-2 font-mono">{r.numero_nf || '-'}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">
                      {formatarMoeda(r.valor_bruto)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-emerald-700">
                      {formatarMoeda(r.valor_liquido)}
                    </td>
                    <td className="py-2 px-2 font-mono">{formatarDataBR(r.data_lancamento)}</td>
                    <td className="py-2 pr-3 pl-2 text-slate-500">
                      {r.erros.length > 0 ? (
                        <span className="text-rose-600">{r.erros.join(', ')}</span>
                      ) : (
                        r.observacao || '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History of Import Batches with Reversion (Excluir lote se arrepender-se) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Histórico de Lotes Importados & Reversão
          </h3>
          <p className="text-xs text-slate-500">
            Caso o administrador identifique inconsistências após a importação, é possível reverter
            e excluir o lote completo, preservando a integridade dos demais dados.
          </p>
        </div>

        {loadingBatches ? (
          <div className="py-6 text-center text-xs text-slate-400">Carregando lotes...</div>
        ) : batches.length === 0 ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-400">
            Nenhuma planilha foi importada até o momento.
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
                    <span className="text-xs font-semibold text-slate-900">
                      {b.arquivo_nome}
                    </span>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span className="text-xs text-slate-600 font-medium">
                      Obra: {b.obra_nome}
                    </span>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span
                      className={`text-[11px] font-semibold ${
                        b.status === 'ativo' ? 'text-emerald-700' : 'text-slate-400 line-through'
                      }`}
                    >
                      {b.status === 'ativo' ? 'Lote Ativo' : 'Lote Revertido/Excluído'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 text-xs text-slate-500">
                    <span>{b.total_registros} registros</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">
                      Bruto: {formatarMoeda(b.total_bruto)}
                    </span>
                    <span>·</span>
                    <span className="font-mono tabular-nums text-emerald-700">
                      Líq: {formatarMoeda(b.total_liquido)}
                    </span>
                    <span>·</span>
                    <span>Importado por {b.usuario_nome} em {formatarDataHoraBR(b.created_at)}</span>
                  </div>
                </div>

                {isAdmin && b.status === 'ativo' && (
                  <button
                    onClick={() => handleRollbackBatch(b.id)}
                    disabled={revertingBatchId === b.id}
                    className="flex items-center gap-1.5 self-start sm:self-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{revertingBatchId === b.id ? 'Revertendo...' : 'Excluir Este Lote'}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
