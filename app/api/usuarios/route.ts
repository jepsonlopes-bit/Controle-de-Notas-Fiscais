import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAllUsers, createUserByAdmin, updateUserStatus, updateUserRole, updateUser, deleteUser } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  if (user.role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Acesso negado. Área restrita ao Administrador.' }, { status: 403 });
  }

  const usuarios = getAllUsers();
  return NextResponse.json({ usuarios });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  if (user.role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Acesso negado. Área restrita ao Administrador.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { nome, email, username, senha, cargo, role, obras_permitidas } = body;

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios.' }, { status: 400 });
    }

    if (senha.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
    }

    const novoUsuario = createUserByAdmin(user, {
      nome,
      email,
      username,
      senha,
      cargo,
      role: role || 'USUARIO',
      obras_permitidas,
    });

    return NextResponse.json({
      message: 'Usuário cadastrado com sucesso.',
      usuario: novoUsuario,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao cadastrar usuário.' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  if (user.role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Acesso negado. Área restrita ao Administrador.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, acao, novo_status, nova_role } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
    }

    if (acao === 'alterar_status') {
      const atualizado = updateUserStatus(user, id, novo_status);
      return NextResponse.json({ message: `Status alterado para ${novo_status}`, usuario: atualizado });
    }

    if (acao === 'alterar_role') {
      const atualizado = updateUserRole(user, id, nova_role);
      return NextResponse.json({ message: `Perfil alterado para ${nova_role}`, usuario: atualizado });
    }

    if (acao === 'editar_usuario' || !acao) {
      const atualizado = updateUser(user, id, {
        nome: body.nome,
        email: body.email,
        username: body.username,
        cargo: body.cargo,
        senha: body.senha,
        role: body.role || nova_role,
        status: body.status || novo_status,
      });
      return NextResponse.json({
        message: 'Dados do usuário atualizados com sucesso.',
        usuario: atualizado,
      });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao atualizar usuário.' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  if (user.role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Acesso negado. Área restrita ao Administrador.' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    let id = url.searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {
        // no body
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
    }

    deleteUser(user, id);
    return NextResponse.json({ message: 'Usuário excluído com sucesso.', id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao excluir usuário.' }, { status: 400 });
  }
}

