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

    // Sincronização inteligente e resiliente bidirecional:
    // Mescla dados por ID garantindo que nenhum lançamento ou obra seja perdido entre instâncias serverless
    const serverSnap = getDatabaseSnapshot();
    const clientObrasList = Array.isArray(clientObras) ? clientObras : [];
    const clientLancList = Array.isArray(clientLancamentos) ? clientLancamentos : [];
    const clientBatchList = Array.isArray(clientBatches) ? clientBatches : [];

    // Mesclagem de obras (pelo ID)
    const obrasMap = new Map();
    serverSnap.obras.forEach((o) => obrasMap.set(o.id, o));
    clientObrasList.forEach((o) => obrasMap.set(o.id, o));

    // Mesclagem de lançamentos (pelo ID)
    const lancMap = new Map();
    serverSnap.lancamentos.forEach((l) => lancMap.set(l.id, l));
    clientLancList.forEach((l) => lancMap.set(l.id, l));

    // Mesclagem de lotes de importação (pelo ID)
    const batchMap = new Map();
    serverSnap.import_batches.forEach((b) => batchMap.set(b.id, b));
    clientBatchList.forEach((b) => batchMap.set(b.id, b));

    const mergedObras = Array.from(obrasMap.values());
    const mergedLancamentos = Array.from(lancMap.values());
    const mergedBatches = Array.from(batchMap.values());

    const hasNewData =
      mergedObras.length > serverSnap.obras.length ||
      mergedLancamentos.length > serverSnap.lancamentos.length ||
      mergedBatches.length > serverSnap.import_batches.length;

    if (hasNewData) {
      restoreDatabaseSnapshot(user, {
        obras: mergedObras,
        lancamentos: mergedLancamentos,
        import_batches: mergedBatches,
      });
    }

    return NextResponse.json({
      synchronized: true,
      obras: mergedObras,
      lancamentos: mergedLancamentos,
      import_batches: mergedBatches,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao sincronizar dados' },
      { status: 400 }
    );
  }
}
