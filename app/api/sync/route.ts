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
    const { action, clientUsers, clientObras, clientLancamentos, clientBatches } = body;

    if ((action === 'reset_all' || action === 'reset_lancamentos') && user.role !== 'ADMINISTRADOR') {
      return NextResponse.json(
        { error: 'Acesso negado: apenas administradores podem resetar dados.' },
        { status: 403 }
      );
    }

    if (action === 'reset_all') {
      clearAllData(user);
      return NextResponse.json({
        success: true,
        users: [],
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
        users: clientUsers,
        obras: clientObras,
        lancamentos: clientLancamentos,
        import_batches: clientBatches,
      });
      return NextResponse.json({ success: true, ...saved });
    }

    // Sincronização inteligente e resiliente bidirecional:
    // Mescla dados por ID garantindo que usuários, senhas, lançamentos ou obras nunca sejam perdidos entre instâncias serverless
    const serverSnap = getDatabaseSnapshot();
    const clientUsersList = Array.isArray(clientUsers) ? clientUsers : [];
    const clientObrasList = Array.isArray(clientObras) ? clientObras : [];
    const clientLancList = Array.isArray(clientLancamentos) ? clientLancamentos : [];
    const clientBatchList = Array.isArray(clientBatches) ? clientBatches : [];

    // Mesclagem de usuários preservando senhas editadas
    const usersMap = new Map();
    serverSnap.users.forEach((u) => usersMap.set(u.id, u));
    clientUsersList.forEach((cu) => {
      const prev = usersMap.get(cu.id);
      usersMap.set(cu.id, {
        ...prev,
        ...cu,
        senha_visivel: cu.senha_visivel || prev?.senha_visivel || '123456',
      });
    });

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

    const mergedUsers = Array.from(usersMap.values());
    const mergedObras = Array.from(obrasMap.values());
    const mergedLancamentos = Array.from(lancMap.values());
    const mergedBatches = Array.from(batchMap.values());

    const hasNewData =
      mergedUsers.length > serverSnap.users.length ||
      mergedObras.length > serverSnap.obras.length ||
      mergedLancamentos.length > serverSnap.lancamentos.length ||
      mergedBatches.length > serverSnap.import_batches.length;

    // Restaura e persiste na base
    const restored = restoreDatabaseSnapshot(user, {
      users: mergedUsers,
      obras: mergedObras,
      lancamentos: mergedLancamentos,
      import_batches: mergedBatches,
    });

    return NextResponse.json({
      synchronized: true,
      users: restored.users,
      obras: restored.obras,
      lancamentos: restored.lancamentos,
      import_batches: restored.import_batches,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao sincronizar dados' },
      { status: 400 }
    );
  }
}
