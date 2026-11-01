import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  importSpreadsheetBatch,
  rollbackImportBatch,
  getImportBatches,
  checkDuplicateLancamento,
  ValidatedImportRow,
} from '@/lib/db';
import {
  converterMoedaParaNumero,
  normalizarDataParaISO,
  preservarZerosDocumento,
} from '@/lib/formatters';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  const batches = getImportBatches();
  return NextResponse.json({ batches });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { acao, obra_id, arquivo_nome, linhas_brutas, linhas_validadas } = body;

    const targetObraId = obra_id || '';

    // 1. AÇÃO: VALIDAR E PRÉ-VISUALIZAR
    if (acao === 'validar') {
      if (!Array.isArray(linhas_brutas) || linhas_brutas.length === 0) {
        return NextResponse.json({ error: 'Nenhum registro encontrado no arquivo para validar.' }, { status: 400 });
      }

      let somaBruto = 0;
      let somaLiquido = 0;
      let totalErros = 0;
      let totalDuplicados = 0;

      const resultados: ValidatedImportRow[] = [];
      const chavesNoLote = new Set<string>();

      linhas_brutas.forEach((row: any, idx: number) => {
        const linhaNum = idx + 2; // cabeçalho está na linha 1
        const erros: string[] = [];

        // Mapeamento flexível dos nomes de colunas (caso haja pequenas variações de maiúsculas/acentos)
        const fornecedor = String(
          row['Fornecedor'] ?? row['FORNECEDOR'] ?? row['fornecedor'] ?? ''
        ).trim();

        const numero_oc = preservarZerosDocumento(
          row['Nº de OC'] ?? row['Nº OC'] ?? row['OC'] ?? row['numero_oc'] ?? row['Numero OC'] ?? ''
        );

        const numero_medicao = preservarZerosDocumento(
          row['Nº Medição'] ?? row['Nº Medicao'] ?? row['Medição'] ?? row['numero_medicao'] ?? row['Medicao'] ?? ''
        );

        const numero_nf = preservarZerosDocumento(
          row['Nº NF'] ?? row['NF'] ?? row['Nota Fiscal'] ?? row['numero_nf'] ?? row['Numero NF'] ?? ''
        );

        const valorBrutoRaw = row['Valor bruto'] ?? row['Valor Bruto'] ?? row['VALOR BRUTO'] ?? row['valor_bruto'];
        const valorLiquidoRaw = row['Valor líquido'] ?? row['Valor Liquido'] ?? row['VALOR LIQUIDO'] ?? row['valor_liquido'];

        const dataLancamentoRaw = row['Data de lançamento'] ?? row['Data de Lancamento'] ?? row['Data Lançamento'] ?? row['data_lancamento'];
        const dataPagamentoRaw = row['Data de pagamento'] ?? row['Data de Pagamento'] ?? row['Data Pagamento'] ?? row['data_pagamento'];

        const categoria_despesa = String(
          row['Categoria de despesa'] ?? row['Categoria'] ?? row['categoria_despesa'] ?? ''
        ).trim();

        const observacao = String(
          row['Observação'] ?? row['Observacao'] ?? row['OBS'] ?? row['observacao'] ?? ''
        ).trim();

        // Validações obrigatórias
        if (!fornecedor) erros.push('Fornecedor não informado');
        if (!numero_oc) erros.push('Nº de OC não informado');
        if (!numero_nf) erros.push('Nº de NF não informado');

        const valor_bruto = converterMoedaParaNumero(valorBrutoRaw);
        if (isNaN(valor_bruto) || valor_bruto < 0 || (valorBrutoRaw === undefined || valorBrutoRaw === null || valorBrutoRaw === '')) {
          erros.push('Valor bruto inválido');
        }

        const valor_liquido = converterMoedaParaNumero(valorLiquidoRaw);
        if (isNaN(valor_liquido) || valor_liquido < 0 || (valorLiquidoRaw === undefined || valorLiquidoRaw === null || valorLiquidoRaw === '')) {
          erros.push('Valor líquido inválido');
        }

        const data_lancamento = normalizarDataParaISO(dataLancamentoRaw);
        if (!data_lancamento) {
          erros.push('Data de lançamento inválida ou vazia');
        }

        const data_pagamento = dataPagamentoRaw ? normalizarDataParaISO(dataPagamentoRaw) : '';

        // Detecção de duplicidade (no banco e no próprio lote)
        const chaveLote = `${fornecedor.toLowerCase()}___${numero_nf.toLowerCase()}`;
        let isDuplicada = false;
        if (chavesNoLote.has(chaveLote)) {
          isDuplicada = true;
          totalDuplicados++;
        } else {
          chavesNoLote.add(chaveLote);
          if (checkDuplicateLancamento(targetObraId, fornecedor, numero_nf)) {
            isDuplicada = true;
            totalDuplicados++;
          }
        }

        const valida = erros.length === 0;
        if (!valida) {
          totalErros++;
        } else {
          somaBruto += valor_bruto;
          somaLiquido += valor_liquido;
        }

        resultados.push({
          linha: linhaNum,
          valida,
          erros,
          fornecedor,
          numero_oc,
          numero_medicao,
          numero_nf,
          valor_bruto,
          valor_liquido,
          data_lancamento,
          data_pagamento,
          categoria_despesa: categoria_despesa || 'Geral',
          observacao,
          is_duplicada: isDuplicada,
        });
      });

      return NextResponse.json({
        total_lidas: linhas_brutas.length,
        total_validas: resultados.filter((r) => r.valida).length,
        total_com_erros: totalErros,
        total_duplicadas_detectadas: totalDuplicados,
        soma_bruto_validas: somaBruto,
        soma_liquido_validas: somaLiquido,
        linhas: resultados,
      });
    }

    // 2. AÇÃO: CONFIRMAR IMPORTAÇÃO (APENAS ADMINISTRADOR)
    if (acao === 'confirmar') {
      if (user.role !== 'ADMINISTRADOR') {
        return NextResponse.json(
          { error: 'Apenas o Administrador possui permissão para autorizar a importação definitiva.' },
          { status: 403 }
        );
      }

      if (!Array.isArray(linhas_validadas) || linhas_validadas.length === 0) {
        return NextResponse.json({ error: 'Nenhum registro validado para importar.' }, { status: 400 });
      }

      const { batch, totalInseridos } = importSpreadsheetBatch(
        user,
        targetObraId,
        arquivo_nome || 'planilha_importada.xlsx',
        linhas_validadas
      );

      return NextResponse.json({
        message: `${totalInseridos} registros importados com sucesso na obra "${batch.obra_nome}".`,
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
    const { removidos } = rollbackImportBatch(user, batchId);
    return NextResponse.json({
      message: `Lote de importação revertido com sucesso. ${removidos} registros foram removidos.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao reverter lote.' }, { status: 400 });
  }
}
