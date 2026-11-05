import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  getDatabaseSnapshot,
  restoreDatabaseSnapshot,
  clearAllData,
  clearAllLancamentos,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const snapshot = getDatabaseSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, clientObras, clientLancamentos, clientBatches } = body;

    if (action === 'reset_all') {
      clearAllData(user);
      return NextResponse.json({
        success: true,
        obras: [],
        lancamentos: [],
        import_batches: [],
      });
    }

    if (action === 'reset_lancamentos') {
      clearAllLancamentos(user);
      const snap = getDatabaseSnapshot();
      return NextResponse.json({ success: true, ...snap });
    }

    if (action === 'save_snapshot') {
      const saved = restoreDatabaseSnapshot(user, {
        obras: clientObras,
        lancamentos: clientLancamentos,
        import_batches: clientBatches,
      });
      return NextResponse.json({ success: true, ...saved });
    }

    // Sincronização inteligente resiliente:
    // Se o servidor reiniciar (cold-start serverless / Vercel) e o cliente possuir dados no localStorage, restaura o estado!
    const serverSnap = getDatabaseSnapshot();
    const serverIsEmpty = serverSnap.obras.length === 0 && serverSnap.lancamentos.length === 0;
    const clientHasData =
      (Array.isArray(clientObras) && clientObras.length > 0) ||
      (Array.isArray(clientLancamentos) && clientLancamentos.length > 0);

    if (serverIsEmpty && clientHasData) {
      const restored = restoreDatabaseSnapshot(user, {
        obras: clientObras,
        lancamentos: clientLancamentos,
        import_batches: clientBatches,
      });
      return NextResponse.json({
        synchronized: true,
        source: 'restored_from_client',
        ...restored,
      });
    }

    // Retorna o snapshot oficial do servidor para atualizar o cliente
    return NextResponse.json({
      synchronized: true,
      source: 'server_state',
      ...serverSnap,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao sincronizar dados' },
      { status: 400 }
    );
  }
}
