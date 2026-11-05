import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  importSpreadsheetBatch,
  rollbackImportBatch,
  getImportBatches,
  deleteImportBatch,
  replaceImportBatch,
  ValidatedImportRow,
} from '@/lib/db';
import {
  converterMoedaParaNumero,
  normalizarDataParaISO,
  preservarZerosDocumento,
} from '@/lib/formatters';

export const dynamic = 'force-dynamic';

function findValue(row: Record<string, any>, possibleKeys: string[]): any {
  if (!row || typeof row !== 'object') return undefined;

  const normKeys = possibleKeys.map((k) =>
    k
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
  );

  for (const [key, val] of Object.entries(row)) {
    const cleanKey = key
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    if (normKeys.includes(cleanKey)) {
      return val;
    }
  }

  return undefined;
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  const batches = getImportBatches();
  return NextResponse.json(
    { batches },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { acao, obra_id, obra_nome, obra_codigo, arquivo_nome, linhas_brutas, linhas_validadas, batch_id_substituir } = body;

    const targetObraId = obra_id || '';

    // 1. AÇÃO: VALIDAR E PRÉ-VISUALIZAR SEM RESTRIÇÕES DE DUPLICIDADE
    if (acao === 'validar') {
      if (!Array.isArray(linhas_brutas) || linhas_brutas.length === 0) {
        return NextResponse.json(
          { error: 'Nenhum registro encontrado no arquivo para validar.' },
          { status: 400 }
        );
      }

      let somaBruto = 0;
      let somaLiquido = 0;
      let totalErros = 0;
      const resultados: ValidatedImportRow[] = [];

      linhas_brutas.forEach((row: any, idx: number) => {
        const linhaNum = idx + 2; // cabeçalho na linha 1

        // Identifica se a linha é completamente vazia
        const values = Object.values(row || {});
        const hasContent = values.some((v) => v !== null && v !== undefined && String(v).trim() !== '');
        if (!hasContent) {
          return; // ignora linha em branco no final da planilha
        }

        const fornecedorRaw = findValue(row, [
          'Fornecedor',
          'FORNECEDOR',
          'fornecedor',
          'Razao Social',
          'Nome Fornecedor',
          'Empresa',
        ]);
        const fornecedor = fornecedorRaw !== undefined && fornecedorRaw !== null ? String(fornecedorRaw).trim() : '';

        const numeroOcRaw = findValue(row, [
          'Nº de OC',
          'Nº OC',
          'No de OC',
          'No OC',
          'OC',
          'Ordem de Compra',
          'Numero OC',
          'numero_oc',
          'Pedido',
        ]);
        const numero_oc = preservarZerosDocumento(numeroOcRaw ?? '');

        const numeroMedicaoRaw = findValue(row, [
          'Nº Medição',
          'Nº Medicao',
          'No Medicao',
          'Medição',
          'Medicao',
          'numero_medicao',
          'Medicao No',
        ]);
        // Campo Nº Medição é estritamente opcional: se vazio na planilha, fica vazio!
        const numero_medicao = preservarZerosDocumento(numeroMedicaoRaw ?? '');

        const numeroNfRaw = findValue(row, [
          'Nº NF',
          'Nº da NF',
          'No NF',
          'NF',
          'Nota Fiscal',
          'Numero NF',
          'numero_nf',
          'Nota',
          'Numero da Nota Fiscal',
        ]);
        const numero_nf = preservarZerosDocumento(numeroNfRaw ?? '');

        const valorBrutoRaw = findValue(row, [
          'Valor bruto',
          'Valor Bruto',
          'VALOR BRUTO',
          'valor_bruto',
          'Bruto',
          'Vlr Bruto',
        ]);
        const valorLiquidoRaw = findValue(row, [
          'Valor líquido',
          'Valor Liquido',
          'VALOR LIQUIDO',
          'valor_liquido',
          'Liquido',
          'Vlr Liquido',
        ]);

        const dataLancamentoRaw = findValue(row, [
          'Data de lançamento',
          'Data de Lancamento',
          'Data Lancamento',
          'data_lancamento',
          'Emissao',
          'Data Emissao',
          'Lancamento',
        ]);
        const dataPagamentoRaw = findValue(row, [
          'Data de pagamento',
          'Data de Pagamento',
          'Data Pagamento',
          'data_pagamento',
          'Pagamento',
          'Vencimento',
          'Data Vencimento',
        ]);

        const categoriaRaw = findValue(row, [
          'Categoria de despesa',
          'Categoria de Despesa',
          'Categoria',
          'categoria_despesa',
          'Tipo',
          'Centro de Custo',
        ]);
        const categoria_despesa = categoriaRaw !== undefined && categoriaRaw !== null ? String(categoriaRaw).trim() : '';

        const observacaoRaw = findValue(row, [
          'Observação',
          'Observacao',
          'OBS',
          'observacao',
          'Observacoes',
          'Historico',
          'Detalhes',
        ]);
        const observacao = observacaoRaw !== undefined && observacaoRaw !== null ? String(observacaoRaw).trim() : '';

        const erros: string[] = [];

        // Converte valores monetários
        const valor_bruto = converterMoedaParaNumero(valorBrutoRaw);
        const valor_liquido =
          valorLiquidoRaw !== undefined && valorLiquidoRaw !== null && String(valorLiquidoRaw).trim() !== ''
            ? converterMoedaParaNumero(valorLiquidoRaw)
            : valor_bruto;

        // Normalização de datas
        let data_lancamento = normalizarDataParaISO(dataLancamentoRaw);
        if (!data_lancamento) {
          // Se não houver data de lançamento na planilha, utiliza a data do pagamento ou hoje
          data_lancamento = normalizarDataParaISO(dataPagamentoRaw) || new Date().toISOString().split('T')[0];
        }

        const data_pagamento = normalizarDataParaISO(dataPagamentoRaw);

        // Sem restrição de duplicidade: NFs que se repetem com parcelas / datas de pagamento distintas ou idênticas são importadas integralmente
        const valida = true;

        somaBruto += valor_bruto;
        somaLiquido += valor_liquido;

        resultados.push({
          linha: linhaNum,
          valida,
          erros,
          fornecedor: fornecedor || 'Fornecedor Não Especificado',
          numero_oc: numero_oc || '',
          numero_medicao: numero_medicao || '', // se vazio, permanece vazio
          numero_nf: numero_nf || 'S/N',
          valor_bruto,
          valor_liquido,
          data_lancamento,
          data_pagamento,
          categoria_despesa: categoria_despesa || '',
          observacao,
          is_duplicada: false, // Não bloqueia parcelas
        });
      });

      return NextResponse.json({
        total_lidas: resultados.length,
        total_validas: resultados.length,
        total_com_erros: 0,
        total_duplicadas_detectadas: 0,
        soma_bruto_validas: somaBruto,
        soma_liquido_validas: somaLiquido,
        linhas: resultados,
      });
    }

    // 2. AÇÃO: CONFIRMAR IMPORTAÇÃO OU SUBSTITUIÇÃO
    if (acao === 'confirmar') {
      if (user.role !== 'ADMINISTRADOR') {
        return NextResponse.json(
          { error: 'Apenas o Administrador possui permissão para autorizar a importação.' },
          { status: 403 }
        );
      }

      if (!Array.isArray(linhas_validadas) || linhas_validadas.length === 0) {
        return NextResponse.json({ error: 'Nenhum registro validado para importar.' }, { status: 400 });
      }

      // Se for substituição de uma planilha anterior
      if (batch_id_substituir) {
        const { batch, totalInseridos } = replaceImportBatch(
          user,
          batch_id_substituir,
          targetObraId,
          arquivo_nome || 'planilha_substituida.xlsx',
          linhas_validadas,
          { nome: obra_nome, codigo: obra_codigo }
        );
        return NextResponse.json({
          message: `Planilha substituída com sucesso! ${totalInseridos} registros atualizados na obra "${batch.obra_nome}".`,
          batch,
        });
      }

      // Importação nova regular
      const { batch, totalInseridos } = importSpreadsheetBatch(
        user,
        targetObraId,
        arquivo_nome || 'planilha_importada.xlsx',
        linhas_validadas,
        { nome: obra_nome, codigo: obra_codigo }
      );

      return NextResponse.json({
        message: `${totalInseridos} registros importados com sucesso na obra "${batch.obra_nome}". Todos os dados e parcelas foram gravados.`,
        batch,
      });
    }

    return NextResponse.json({ error: 'Ação de importação não reconhecida.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro no processo de importação.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  if (user.role !== 'ADMINISTRADOR') {
    return NextResponse.json(
      { error: 'Apenas o Administrador pode reverter ou excluir lotes de importação.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get('batch_id');

  if (!batchId) {
    return NextResponse.json({ error: 'ID do lote de importação não informado.' }, { status: 400 });
  }

  try {
    const { removidos } = deleteImportBatch(user, batchId);
    return NextResponse.json({
      message: `Planilha e lote de importação excluídos com sucesso. ${removidos} registros vinculados foram removidos do sistema.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao excluir lote.' }, { status: 400 });
  }
}
