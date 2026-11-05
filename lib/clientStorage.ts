import { Obra, Lancamento, ImportBatch, DashboardMetrics, UserProfile } from './types';

const STORAGE_KEY = 'controle_nf_master_store_v4';

const DEFAULT_USERS_SEED: UserProfile[] = [
  {
    id: 'usr-788f5c46-337e-484e-b359-4d9fe2cf900c',
    email: 'jepson.lopes@gmail.com',
    nome: 'Jepson Lopes',
    cargo: 'Diretor / Administrador Geral',
    role: 'ADMINISTRADOR',
    status: 'ativo',
    senha_visivel: '123456',
    created_at: '2026-11-01T14:10:51.922Z',
    updated_at: '2026-11-01T14:10:51.922Z',
  },
  {
    id: 'usr-mariana-02',
    email: 'mariana.souza@empresa.com.br',
    nome: 'Mariana Souza',
    cargo: 'Engenheira de Planejamento',
    role: 'USUARIO',
    status: 'ativo',
    senha_visivel: '123456',
    created_at: '2026-11-01T14:15:00.000Z',
    updated_at: '2026-11-01T14:15:00.000Z',
  },
  {
    id: 'usr-carlos-03',
    email: 'carlos.silveira@empresa.com.br',
    nome: 'Carlos Silveira',
    cargo: 'Comprador de Suprimentos',
    role: 'USUARIO',
    status: 'ativo',
    senha_visivel: '123456',
    created_at: '2026-11-01T14:18:00.000Z',
    updated_at: '2026-11-01T14:18:00.000Z',
  },
];

export interface ClientDataStore {
  users: UserProfile[];
  obras: Obra[];
  lancamentos: Lancamento[];
  import_batches: ImportBatch[];
  last_updated: string;
}

export function getClientSnapshot(): ClientDataStore {
  if (typeof window === 'undefined') {
    return { users: DEFAULT_USERS_SEED, obras: [], lancamentos: [], import_batches: [], last_updated: '' };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Migração de versões anteriores do cache se existirem
      const oldKeys = ['controle_nf_storage_v3', 'controle_nf_db_cache_v3', 'controle_nf_db_cache_v2'];
      for (const k of oldKeys) {
        const oldRaw = localStorage.getItem(k);
        if (oldRaw) {
          try {
            const parsed = JSON.parse(oldRaw);
            if (Array.isArray(parsed.obras) || Array.isArray(parsed.lancamentos)) {
              const migrated: ClientDataStore = {
                users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : DEFAULT_USERS_SEED,
                obras: parsed.obras || [],
                lancamentos: parsed.lancamentos || [],
                import_batches: parsed.import_batches || [],
                last_updated: new Date().toISOString(),
              };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
              return migrated;
            }
          } catch {}
        }
      }
      const initial: ClientDataStore = {
        users: DEFAULT_USERS_SEED,
        obras: [],
        lancamentos: [],
        import_batches: [],
        last_updated: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    const parsed = JSON.parse(raw);
    const usersList = Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : DEFAULT_USERS_SEED;
    return {
      users: usersList,
      obras: Array.isArray(parsed.obras) ? parsed.obras : [],
      lancamentos: Array.isArray(parsed.lancamentos) ? parsed.lancamentos : [],
      import_batches: Array.isArray(parsed.import_batches) ? parsed.import_batches : [],
      last_updated: parsed.last_updated || '',
    };
  } catch (err) {
    console.warn('Erro ao ler armazenamento local:', err);
    return { users: DEFAULT_USERS_SEED, obras: [], lancamentos: [], import_batches: [], last_updated: '' };
  }
}

export function saveClientSnapshot(partial: {
  users?: UserProfile[];
  obras?: Obra[];
  lancamentos?: Lancamento[];
  import_batches?: ImportBatch[];
}): ClientDataStore {
  if (typeof window === 'undefined') {
    return { users: DEFAULT_USERS_SEED, obras: [], lancamentos: [], import_batches: [], last_updated: '' };
  }

  try {
    const current = getClientSnapshot();
    const updated: ClientDataStore = {
      users: partial.users !== undefined ? partial.users : current.users,
      obras: partial.obras !== undefined ? partial.obras : current.obras,
      lancamentos: partial.lancamentos !== undefined ? partial.lancamentos : current.lancamentos,
      import_batches: partial.import_batches !== undefined ? partial.import_batches : current.import_batches,
      last_updated: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Erro ao gravar armazenamento local:', err);
    return { users: DEFAULT_USERS_SEED, obras: [], lancamentos: [], import_batches: [], last_updated: '' };
  }
}

export function saveUserLocally(user: UserProfile): ClientDataStore {
  const current = getClientSnapshot();
  const existingIdx = current.users.findIndex(
    (u) => u.id === user.id || (u.email && u.email.toLowerCase() === user.email.toLowerCase())
  );
  const updatedUsers = [...current.users];

  if (existingIdx >= 0) {
    updatedUsers[existingIdx] = {
      ...updatedUsers[existingIdx],
      ...user,
      senha_visivel: user.senha_visivel || updatedUsers[existingIdx].senha_visivel || '123456',
    };
  } else {
    updatedUsers.push({
      ...user,
      senha_visivel: user.senha_visivel || '123456',
    });
  }

  return saveClientSnapshot({ users: updatedUsers });
}

export function deleteUserLocally(userId: string): ClientDataStore {
  const current = getClientSnapshot();
  const updatedUsers = current.users.filter((u) => u.id !== userId);
  return saveClientSnapshot({ users: updatedUsers });
}

export function saveLancamentoLocally(lancamento: Lancamento): ClientDataStore {
  const current = getClientSnapshot();
  const existingIdx = current.lancamentos.findIndex((l) => l.id === lancamento.id);
  const updatedLancamentos = [...current.lancamentos];

  if (existingIdx >= 0) {
    updatedLancamentos[existingIdx] = lancamento;
  } else {
    updatedLancamentos.unshift(lancamento);
  }

  return saveClientSnapshot({ lancamentos: updatedLancamentos });
}

export function deleteLancamentoLocally(id: string): ClientDataStore {
  const current = getClientSnapshot();
  const updatedLancamentos = current.lancamentos.filter((l) => l.id !== id);
  return saveClientSnapshot({ lancamentos: updatedLancamentos });
}

export function saveObraLocally(obra: Obra): ClientDataStore {
  const current = getClientSnapshot();
  const existingIdx = current.obras.findIndex((o) => o.id === obra.id);
  const updatedObras = [...current.obras];

  if (existingIdx >= 0) {
    updatedObras[existingIdx] = obra;
  } else {
    updatedObras.push(obra);
  }

  return saveClientSnapshot({ obras: updatedObras });
}

export function deleteObraLocally(id: string): ClientDataStore {
  const current = getClientSnapshot();
  const updatedObras = current.obras.filter((o) => o.id !== id);
  // Remove também lançamentos vinculados se necessário
  const updatedLancamentos = current.lancamentos.filter((l) => l.obra_id !== id);
  return saveClientSnapshot({ obras: updatedObras, lancamentos: updatedLancamentos });
}

export function clearClientStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('controle_nf_storage_v3');
    localStorage.removeItem('controle_nf_db_cache_v3');
  } catch {}
}

export async function syncStorageWithServer(): Promise<ClientDataStore> {
  const clientData = getClientSnapshot();

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientUsers: clientData.users,
        clientObras: clientData.obras,
        clientLancamentos: clientData.lancamentos,
        clientBatches: clientData.import_batches,
      }),
    });

    if (res.ok) {
      const serverData = await res.json();

      // Mesclagem de usuários preservando senhas visíveis locais mais recentes
      const userMap = new Map<string, UserProfile>();
      clientData.users.forEach((u) => userMap.set(u.id, u));
      if (Array.isArray(serverData.users)) {
        serverData.users.forEach((su: UserProfile) => {
          const local = userMap.get(su.id);
          userMap.set(su.id, {
            ...su,
            senha_visivel: su.senha_visivel || local?.senha_visivel || '123456',
          });
        });
      }
      const mergedUsers = Array.from(userMap.values());

      const mergedStore = saveClientSnapshot({
        users: mergedUsers,
        obras: Array.isArray(serverData.obras) ? serverData.obras : clientData.obras,
        lancamentos: Array.isArray(serverData.lancamentos) ? serverData.lancamentos : clientData.lancamentos,
        import_batches: Array.isArray(serverData.import_batches) ? serverData.import_batches : clientData.import_batches,
      });
      return mergedStore;
    }
  } catch (err) {
    console.warn('Aviso: Sincronização em segundo plano indisponível, usando dados locais offline:', err);
  }

  return clientData;
}

export function applyLancamentoFilters(
  items: Lancamento[],
  filters: {
    selectedObraId?: string;
    searchTerm?: string;
    filterCategoria?: string;
    filterStatus?: string;
    dataLancInicio?: string;
    dataLancFim?: string;
    dataPagInicio?: string;
    dataPagFim?: string;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }
) {
  let filtered = [...items];

  if (filters.selectedObraId && filters.selectedObraId !== 'todas') {
    filtered = filtered.filter((item) => item.obra_id === filters.selectedObraId);
  }

  if (filters.searchTerm && filters.searchTerm.trim()) {
    const q = filters.searchTerm.toLowerCase().trim();
    filtered = filtered.filter(
      (item) =>
        item.fornecedor.toLowerCase().includes(q) ||
        item.numero_oc.toLowerCase().includes(q) ||
        (item.numero_medicao && item.numero_medicao.toLowerCase().includes(q)) ||
        item.numero_nf.toLowerCase().includes(q) ||
        (item.categoria_despesa && item.categoria_despesa.toLowerCase().includes(q)) ||
        (item.observacao && item.observacao.toLowerCase().includes(q))
    );
  }

  if (filters.filterCategoria && filters.filterCategoria !== 'todas') {
    filtered = filtered.filter((item) => item.categoria_despesa === filters.filterCategoria);
  }

  if (filters.filterStatus && filters.filterStatus !== 'todos') {
    filtered = filtered.filter((item) => item.status_pagamento === filters.filterStatus);
  }

  if (filters.dataLancInicio) {
    const inicio = filters.dataLancInicio;
    filtered = filtered.filter((item) => item.data_lancamento >= inicio);
  }
  if (filters.dataLancFim) {
    const fim = filters.dataLancFim;
    filtered = filtered.filter((item) => item.data_lancamento <= fim);
  }
  if (filters.dataPagInicio) {
    const pagInicio = filters.dataPagInicio;
    filtered = filtered.filter((item) => (item.data_pagamento || '') >= pagInicio);
  }
  if (filters.dataPagFim) {
    const pagFim = filters.dataPagFim;
    filtered = filtered.filter((item) => (item.data_pagamento || '') <= pagFim);
  }

  // Ordenação
  filtered.sort((a: any, b: any) => {
    const valA = a[filters.sortBy];
    const valB = b[filters.sortBy];
    if (typeof valA === 'number' && typeof valB === 'number') {
      return filters.sortOrder === 'asc' ? valA - valB : valB - valA;
    }
    const strA = String(valA || '').toLowerCase();
    const strB = String(valB || '').toLowerCase();
    return filters.sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });

  const total = filtered.length;
  const somaBruto = filtered.reduce((acc, curr) => acc + (Number(curr.valor_bruto) || 0), 0);
  const somaLiquido = filtered.reduce((acc, curr) => acc + (Number(curr.valor_liquido) || 0), 0);
  const totalPaginas = Math.max(1, Math.ceil(total / filters.limit));
  const startIndex = (filters.page - 1) * filters.limit;
  const paginatedData = filtered.slice(startIndex, startIndex + filters.limit);

  return {
    data: paginatedData,
    total,
    total_paginas: totalPaginas,
    soma_valor_bruto: somaBruto,
    soma_valor_liquido: somaLiquido,
  };
}

export function computeClientMetrics(items: Lancamento[], obraId?: string): DashboardMetrics {
  let filtered = [...items];
  if (obraId && obraId !== 'todas') {
    filtered = filtered.filter((l) => l.obra_id === obraId);
  }

  const total_lancamentos = filtered.length;
  const soma_valor_bruto = filtered.reduce((acc, curr) => acc + (Number(curr.valor_bruto) || 0), 0);
  const soma_valor_liquido = filtered.reduce((acc, curr) => acc + (Number(curr.valor_liquido) || 0), 0);
  const soma_retencoes = Math.max(0, soma_valor_bruto - soma_valor_liquido);

  let total_pago = 0;
  let total_pendente = 0;
  const categoriasMap = new Map<string, { quantidade: number; total_bruto: number }>();
  const periodosMap = new Map<string, { total_bruto: number; total_liquido: number; quantidade: number }>();
  const statusMap = new Map<string, { quantidade: number; total: number }>();

  for (const item of filtered) {
    const bruto = Number(item.valor_bruto) || 0;
    const liquido = Number(item.valor_liquido) || 0;
    const status = item.status_pagamento || 'Pendente';
    if (status === 'Pago') {
      total_pago += liquido;
    } else {
      total_pendente += liquido;
    }

    const curStatus = statusMap.get(status) || { quantidade: 0, total: 0 };
    curStatus.quantidade += 1;
    curStatus.total += liquido;
    statusMap.set(status, curStatus);

    const cat = item.categoria_despesa?.trim() || 'Outros';
    const curCat = categoriasMap.get(cat) || { quantidade: 0, total_bruto: 0 };
    curCat.quantidade += 1;
    curCat.total_bruto += bruto;
    categoriasMap.set(cat, curCat);

    let mesAno = 'Sem Data';
    if (item.data_lancamento) {
      const parts = item.data_lancamento.split('-');
      if (parts.length >= 2) mesAno = `${parts[1]}/${parts[0]}`;
    }
    const curPer = periodosMap.get(mesAno) || { total_bruto: 0, total_liquido: 0, quantidade: 0 };
    curPer.total_bruto += bruto;
    curPer.total_liquido += liquido;
    curPer.quantidade += 1;
    periodosMap.set(mesAno, curPer);
  }

  return {
    total_lancamentos,
    soma_valor_bruto,
    soma_valor_liquido,
    soma_retencoes,
    total_pago,
    total_pendente,
    por_categoria: Array.from(categoriasMap.entries()).map(([categoria, info]) => ({
      categoria,
      quantidade: info.quantidade,
      total_bruto: info.total_bruto,
      percentual: soma_valor_bruto > 0 ? (info.total_bruto / soma_valor_bruto) * 100 : 0,
    })),
    por_periodo: Array.from(periodosMap.entries()).map(([mes_ano, info]) => ({
      mes_ano,
      total_bruto: info.total_bruto,
      total_liquido: info.total_liquido,
      quantidade: info.quantidade,
    })),
    situacao_pagamentos: Array.from(statusMap.entries()).map(([status, info]) => ({
      status: status as any,
      quantidade: info.quantidade,
      total: info.total,
    })),
  };
}

