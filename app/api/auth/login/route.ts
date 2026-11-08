import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, restoreDatabaseSnapshot } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, usuario, senha, clientUsers } = body;
    const identifier = (usuario || email || '').trim();

    if (!identifier || !senha) {
      return NextResponse.json({ error: 'Informe usuário e senha.' }, { status: 400 });
    }

    // Sincroniza usuários do cliente antes de autenticar para garantir persistência em instâncias novas
    if (Array.isArray(clientUsers) && clientUsers.length > 0) {
      try {
        const adminMock = clientUsers.find((u: any) => u.role === 'ADMINISTRADOR') || clientUsers[0];
        restoreDatabaseSnapshot(adminMock, { users: clientUsers });
      } catch {}
    }

    const user = authenticateUser(identifier, senha);
    const token = createSessionToken(user.id);

    const res = NextResponse.json({
      message: 'Login realizado com sucesso.',
      user,
      token,
    });

    res.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Falha na autenticação.' }, { status: 401 });
  }
}
