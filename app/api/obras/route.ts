import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getObrasWithStats, createObra, updateObra, deleteObra } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Usuário não autenticado.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('include_inactive') === 'true' || user.role === 'ADMINISTRADOR';
  const obras = getObrasWithStats(includeInactive);
  return NextResponse.json({ obras });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  if (user.role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Apenas administradores podem cadastrar obras.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { codigo, nome, descricao } = body;

    if (!codigo || !nome) {
      return NextResponse.json({ error: 'Código e nome da obra são obrigatórios.' }, { status: 400 });
    }

    const obra = createObra(user, { codigo, nome, descricao });
    return NextResponse.json({ obra, message: 'Obra cadastrada com sucesso.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao criar obra.' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  if (user.role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Apenas administradores podem alterar obras.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, nome, descricao, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID da obra é obrigatório.' }, { status: 400 });
    }

    const obra = updateObra(user, id, { nome, descricao, status });
    return NextResponse.json({
      obra,
      message: status
        ? `Status da obra alterado para ${status === 'ativo' ? 'Ativa' : 'Inativa'}.`
        : 'Obra atualizada com sucesso.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao atualizar obra.' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  if (user.role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Apenas administradores podem excluir obras.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const reassign = searchParams.get('reassign') === 'true';

  if (!id) {
    return NextResponse.json({ error: 'ID da obra é obrigatório.' }, { status: 400 });
  }

  try {
    const { removida, lancamentosReatribuidos } = deleteObra(user, id, {
      reassignLancamentosToSemObra: reassign,
    });

    return NextResponse.json({
      message: lancamentosReatribuidos > 0
        ? `Obra "${removida.nome}" excluída com sucesso. ${lancamentosReatribuidos} lançamentos foram preservados e transferidos para "Sem Obra / Geral".`
        : `Obra "${removida.nome}" excluída com sucesso.`,
      removida,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao excluir obra.' }, { status: 400 });
  }
}
