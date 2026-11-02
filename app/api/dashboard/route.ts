import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getDashboardMetrics } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const obra_id = searchParams.get('obra_id') || undefined;

  const metrics = getDashboardMetrics(obra_id);
  return NextResponse.json(metrics, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
