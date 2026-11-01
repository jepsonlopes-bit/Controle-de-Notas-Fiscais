import { NextRequest, NextResponse } from 'next/server';
import { isSystemInitialized, createInitialAdmin } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export async function GET() {
  const initialized = isSystemInitialized();
  return NextResponse.json({ initialized });
}

export async function POST(req: NextRequest) {
  try {
    const initialized = isSystemInitialized();
    if (initialized) {
      return NextResponse.json(
        { error: 'O sistema já possui um Administrador inicial configurado.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { nome, email, senha, cargo } = body;

    if (!nome || !email || !senha) {
      return NextResponse.json(
        { error: 'Nome, e-mail e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    if (senha.length < 6) {
      return NextResponse.json(
        { error: 'A senha do administrador deve ter pelo menos 6 caracteres.' },
        { status: 400 }
      );
    }

    const admin = createInitialAdmin({
      nome,
      email,
      senha,
      cargo: cargo || 'Administrador do Sistema',
    });

    const token = createSessionToken(admin.id);

    const response = NextResponse.json({
      message: 'Administrador inicial criado com sucesso.',
      user: admin,
      token,
    });

    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro no setup inicial.' }, { status: 500 });
  }
}
