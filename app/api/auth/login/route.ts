import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, senha } = body;

    if (!email || !senha) {
      return NextResponse.json({ error: 'Informe e-mail e senha.' }, { status: 400 });
    }

    const user = authenticateUser(email, senha);
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
