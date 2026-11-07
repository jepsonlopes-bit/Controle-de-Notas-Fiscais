import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getUserById } from './db';
import { UserProfile } from './types';

const AUTH_SECRET = process.env.AUTH_SECRET || 'secret-controle-nf-medicoes-production-safe-token-2026';

export function createSessionToken(userId: string): string {
  const payload = JSON.stringify({
    uid: userId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 dias
  });
  const base64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(base64Payload).digest('base64url');
  return `${base64Payload}.${signature}`;
}

export function verifySessionToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [base64Payload, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(base64Payload).digest('base64url');
    if (signature !== expectedSig) return null;

    const raw = Buffer.from(base64Payload, 'base64url').toString('utf-8');
    const data = JSON.parse(raw);
    if (!data.uid || !data.exp) return null;
    if (Date.now() > data.exp) return null;

    return data.uid;
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(req: NextRequest): Promise<UserProfile | null> {
  let token = req.cookies.get('session_token')?.value;

  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (token) {
    const userId = verifySessionToken(token);
    if (userId) {
      const user = getUserById(userId);
      if (user && user.status !== 'bloqueado') {
        return user;
      }
    }
  }

  // Se não houver token válido, retorna null para direcionar à tela de login
  return null;
}
