import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  getLancamentos,
  createLancamento,
  updateLancamento,
  deleteLancamento,
  checkDuplicateLancamento,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Usuário não autenticado.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const obra_id = searchParams.get('obra_id') || undefined;
  const busca = searchParams.get('busca') || undefined;
  const categoria = searchParams.get('categoria') || undefined;
  const status_pagamento = searchParams.get('status_pagamento') || undefined;
  const data_lancamento_inicio = searchParams.get('data_lancamento_inicio') || undefined;
  const data_lancamento_fim = searchParams.get('data_lancamento_fim') || undefined;
  const data_pagamento_inicio = searchParams.get('data_pagamento_inicio') || undefined;
  const data_pagamento_fim = searchParams.get('data_pagamento_fim') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '15', 10);
  const sort_by = (searchParams.get('sort_by') as any) || 'data_lancamento';
  const sort_order = (searchParams.get('sort_order') as any) || 'desc';

  const result = getLancamentos({
    obra_id,
    busca,
    categoria,
    status_pagamento,
    data_lancamento_inicio,
    data_lancamento_fim,
    data_pagamento_inicio,
    data_pagamento_fim,
    page,
    limit,
    sort_by,
    sort_order,
  });

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Usuário não autenticado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      obra_id,
      fornecedor,
      numero_oc,
      numero_medicao,
      numero_nf,
      valor_bruto,
      valor_liquido,
      data_lancamento,
      data_pagamento,
      status_pagamento,
      data_confirmacao_pagamento,
      categoria_despesa,
      observacao,
      ignorar_aviso_duplicidade,
    } = body;

    const resolvedObraId = obra_id || '';

    // Checagem de possível duplicidade (mesmo fornecedor + mesma NF na mesma obra)
    const isDuplicado = checkDuplicateLancamento(resolvedObraId, fornecedor, numero_nf);
    if (isDuplicado && !ignorar_aviso_duplicidade) {
      return NextResponse.json(
        {
          aviso_duplicidade: true,
          message: `Atenção: Já existe um lançamento para o fornecedor "${fornecedor}" com o Nº de NF "${numero_nf}". Deseja confirmar mesmo assim?`,
        },
        { status: 409 }
      );
    }

    const lancamento = createLancamento(user, {
      obra_id: resolvedObraId,
      fornecedor,
      numero_oc,
      numero_medicao,
      numero_nf,
      valor_bruto,
      valor_liquido,
      data_lancamento,
      data_pagamento,
      status_pagamento,
      data_confirmacao_pagamento,
      categoria_despesa,
      observacao,
    });

    return NextResponse.json({
      message: 'Lançamento cadastrado com sucesso.',
      lancamento,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao criar lançamento.' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Usuário não autenticado.' }, { status: 401 });
  }

  // Apenas Administrador pode editar
  if (user.role !== 'ADMINISTRADOR') {
    return NextResponse.json(
      { error: 'Acesso negado: apenas o Administrador possui permissão para editar lançamentos.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { id, ...dados } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do lançamento é obrigatório.' }, { status: 400 });
    }

    const atualizado = updateLancamento(user, id, dados);
    return NextResponse.json({
      message: 'Lançamento corrigido com sucesso.',
      lancamento: atualizado,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao atualizar lançamento.' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Usuário não autenticado.' }, { status: 401 });
  }

  // Apenas Administrador pode excluir
  if (user.role !== 'ADMINISTRADOR') {
    return NextResponse.json(
      { error: 'Acesso negado: apenas o Administrador possui permissão para excluir registros.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  let id = searchParams.get('id');

  if (!id) {
    try {
      const body = await req.json();
      id = body?.id;
    } catch {
      // ignore
    }
  }

  if (!id) {
    return NextResponse.json({ error: 'ID do lançamento é obrigatório.' }, { status: 400 });
  }

  try {
    deleteLancamento(user, id);
    return NextResponse.json(
      { message: 'Registro excluído com sucesso e registrado na auditoria.' },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao excluir lançamento.' }, { status: 400 });
  }
}
