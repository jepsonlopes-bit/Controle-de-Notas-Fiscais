import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ message: 'Sessão encerrada com sucesso.' });
  res.cookies.delete('session_token');
  return res;
}
