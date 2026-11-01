import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAuditLogs } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Faça login.' }, { status: 401 });
  }

  // Apenas Administrador pode consultar a auditoria
  if (user.role !== 'ADMINISTRADOR') {
    return NextResponse.json({ error: 'Acesso restrito ao Administrador.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const acao = searchParams.get('acao') || undefined;
  const entidade = searchParams.get('entidade') || undefined;
  const usuario_id = searchParams.get('usuario_id') || undefined;
  const busca = searchParams.get('busca') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);

  const logs = getAuditLogs({
    acao,
    entidade,
    usuario_id,
    busca,
    page,
    limit,
  });

  return NextResponse.json(logs);
}
