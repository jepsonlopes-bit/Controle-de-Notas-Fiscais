import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import {
  UserProfile,
  UserRole,
  Obra,
  Lancamento,
  StatusPagamento,
  AuditLog,
  ImportBatch,
  LancamentoFilter,
  DashboardMetrics,
} from './types';

interface StoredUser extends UserProfile {
  passwordHash: string;
  passwordSalt: string;
}

function stripPassword(u: StoredUser): UserProfile {
  return {
    id: u.id,
    email: u.email,
    nome: u.nome,
    cargo: u.cargo,
    role: u.role,
    status: u.status,
    obras_permitidas: u.obras_permitidas,
    ultimo_login: u.ultimo_login,
    created_at: u.created_at,
    updated_at: u.updated_at,
  };
}

interface DatabaseSchema {
  users: StoredUser[];
  obras: Obra[];
  lancamentos: Lancamento[];
  audit_logs: AuditLog[];
  import_batches: ImportBatch[];
  version: number;
}

// Global cache para garantir persistência e performance em instâncias ativas
declare global {
  var __appDatabaseCache: DatabaseSchema | undefined;
}

const SEED_FILE = path.join(process.cwd(), 'data', 'app_database.json');

export function isServerlessEnvironment(): boolean {
  if (
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NOW_REGION
  ) {
    return true;
  }
  try {
    const cwd = process.cwd();
    if (cwd.startsWith('/var/task') || cwd.startsWith('/var/runtime')) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Determina o caminho de gravação do banco de dados.
 * Em ambientes como Vercel ou AWS Lambda, o diretório da aplicação (/var/task) é estritamente somente leitura (EROFS).
 * O único diretório com permissão de gravação em disco nesses ambientes é os.tmpdir() (/tmp).
 */
function resolveWritableDbPaths(): { dir: string; file: string } {
  if (isServerlessEnvironment()) {
    const tmpDir = path.join(os.tmpdir(), 'controle_nf_data');
    return {
      dir: tmpDir,
      file: path.join(tmpDir, 'app_database.json'),
    };
  }

  // Tenta usar o diretório local data/ se tiver permissão de escrita
  try {
    const localDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, `.write_check_${Date.now()}`);
    fs.writeFileSync(testFile, 'ok', 'utf-8');
    fs.unlinkSync(testFile);
    return {
      dir: localDir,
      file: path.join(localDir, 'app_database.json'),
    };
  } catch {
    // Se ocorrer EROFS ou qualquer bloqueio no disco local, faz fallback automático para /tmp
    const tmpDir = path.join(os.tmpdir(), 'controle_nf_data');
    return {
      dir: tmpDir,
      file: path.join(tmpDir, 'app_database.json'),
    };
  }
}

// Senhas seguras com pbkdf2 do node:crypto
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return testHash === hash;
}

const defaultObras: Obra[] = [];

function ensureDatabase(): DatabaseSchema {
  // 1. Se já carregado na memória do processo, usa o cache direto
  if (globalThis.__appDatabaseCache) {
    if (!globalThis.__appDatabaseCache.obras) {
      globalThis.__appDatabaseCache.obras = [];
    }
    if (!globalThis.__appDatabaseCache.lancamentos) {
      globalThis.__appDatabaseCache.lancamentos = [];
    }
    autoUpdateLancamentosStatus(globalThis.__appDatabaseCache);
    return globalThis.__appDatabaseCache;
  }

  const { file } = resolveWritableDbPaths();

  // 2. Se o arquivo já existe no destino gravável (ex: /tmp/controle_nf_data/app_database.json)
  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (!parsed.obras) {
        parsed.obras = [];
      }
      if (!parsed.lancamentos) {
        parsed.lancamentos = [];
      }
      autoUpdateLancamentosStatus(parsed);
      globalThis.__appDatabaseCache = parsed;
      return parsed;
    } catch (err) {
      console.warn('Erro ao ler DB do caminho gravável:', err);
    }
  }

  // 3. Se não existe no destino gravável, carrega a base distribuída (data/app_database.json)
  if (fs.existsSync(SEED_FILE)) {
    try {
      const seedRaw = fs.readFileSync(SEED_FILE, 'utf-8');
      const seedParsed = JSON.parse(seedRaw) as DatabaseSchema;
      if (!seedParsed.obras) {
        seedParsed.obras = [];
      }
      if (!seedParsed.lancamentos) {
        seedParsed.lancamentos = [];
      }
      autoUpdateLancamentosStatus(seedParsed);
      globalThis.__appDatabaseCache = seedParsed;
      try {
        saveDatabase(seedParsed);
      } catch (saveErr) {
        console.warn('Aviso: Não foi possível salvar seed imediatamente em disco:', saveErr);
      }
      return seedParsed;
    } catch (seedErr) {
      console.warn('Erro ao carregar seed base:', seedErr);
    }
  }

  // 4. Fallback inicial caso não haja nenhum arquivo
  const initialData: DatabaseSchema = {
    users: [],
    obras: [],
    lancamentos: [],
    audit_logs: [],
    import_batches: [],
    version: 1,
  };
  globalThis.__appDatabaseCache = initialData;
  try {
    saveDatabase(initialData);
  } catch (saveErr) {
    console.warn('Aviso: Não foi possível salvar dados iniciais em disco:', saveErr);
  }
  return initialData;
}

function saveDatabase(data: DatabaseSchema): void {
  // 1. Atualiza cache em memória imediatamente (instantâneo e global no processo)
  globalThis.__appDatabaseCache = data;

  // 2. Se NÃO for serverless (/var/task), tenta manter o arquivo base em data/ atualizado
  if (!isServerlessEnvironment()) {
    try {
      if (fs.existsSync(SEED_FILE)) {
        const tempSeed = `${SEED_FILE}.tmp.${Date.now()}`;
        fs.writeFileSync(tempSeed, JSON.stringify(data, null, 2), 'utf-8');
        fs.renameSync(tempSeed, SEED_FILE);
      }
    } catch {
      // Ignora silenciosamente qualquer restrição de disco local
    }
  }

  // 3. Grava no diretório gravável (/tmp em ambiente serverless/Vercel)
  try {
    const { dir, file } = resolveWritableDbPaths();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${file}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, file);
  } catch (err) {
    console.warn('Aviso: Gravação em disco falhou, mantido em memória do processo:', err);
  }
}

// -------------------------------------------------------------
// AUTENTICAÇÃO E PERFIS
// -------------------------------------------------------------
export function isSystemInitialized(): boolean {
  const db = ensureDatabase();
  return db.users.some((u) => u.role === 'ADMINISTRADOR' && u.status === 'ativo');
}

export function createInitialAdmin(data: {
  nome: string;
  email: string;
  senha: string;
  cargo?: string;
}): UserProfile {
  const db = ensureDatabase();
  const existingAdmin = db.users.find((u) => u.role === 'ADMINISTRADOR');
  if (existingAdmin) {
    throw new Error('O sistema já possui um Administrador inicial cadastrado.');
  }

  const { hash, salt } = hashPassword(data.senha);
  const now = new Date().toISOString();
  const newAdmin: StoredUser = {
    id: `usr-${crypto.randomUUID()}`,
    email: data.email.trim().toLowerCase(),
    nome: data.nome.trim(),
    cargo: data.cargo?.trim() || 'Administrador Geral',
    role: 'ADMINISTRADOR',
    status: 'ativo',
    obras_permitidas: [],
    created_at: now,
    updated_at: now,
    passwordHash: hash,
    passwordSalt: salt,
  };

  db.users.push(newAdmin);

  // Registro de auditoria do setup
  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: newAdmin.id,
    usuario_nome: newAdmin.nome,
    usuario_email: newAdmin.email,
    acao: 'CRIACAO_USUARIO',
    entidade: 'usuario',
    registro_id: newAdmin.id,
    valores_anteriores: null,
    valores_novos: { email: newAdmin.email, role: 'ADMINISTRADOR' },
    descricao_resumo: `Inicialização do primeiro Administrador do sistema (${newAdmin.email})`,
    created_at: now,
  });

  saveDatabase(db);
  return stripPassword(newAdmin);
}

export function authenticateUser(email: string, senha: string): UserProfile {
  const db = ensureDatabase();
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email === normalizedEmail);

  if (!user) {
    throw new Error('Credenciais inválidas.');
  }

  if (user.status === 'bloqueado') {
    throw new Error('Usuário bloqueado pelo administrador. Acesso negado.');
  }

  const isValid = verifyPassword(senha, user.passwordHash, user.passwordSalt);
  if (!isValid) {
    throw new Error('Credenciais inválidas.');
  }

  user.ultimo_login = new Date().toISOString();
  saveDatabase(db);

  return stripPassword(user);
}

export function getUserById(id: string): UserProfile | null {
  const db = ensureDatabase();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
  return stripPassword(user);
}

export function getAllUsers(): UserProfile[] {
  const db = ensureDatabase();
  return db.users.map(stripPassword);
}

export function createUserByAdmin(
  admin: UserProfile,
  data: {
    nome: string;
    email: string;
    senha: string;
    cargo?: string;
    role: UserRole;
    obras_permitidas?: string[];
  }
): UserProfile {
  if (admin.role !== 'ADMINISTRADOR') {
    throw new Error('Apenas administradores podem cadastrar novos usuários.');
  }

  const db = ensureDatabase();
  const normalizedEmail = data.email.trim().toLowerCase();
  if (db.users.some((u) => u.email === normalizedEmail)) {
    throw new Error('Já existe um usuário cadastrado com este e-mail.');
  }

  const { hash, salt } = hashPassword(data.senha);
  const now = new Date().toISOString();
  const newUser: StoredUser = {
    id: `usr-${crypto.randomUUID()}`,
    email: normalizedEmail,
    nome: data.nome.trim(),
    cargo: data.cargo?.trim() || '',
    role: data.role,
    status: 'ativo',
    obras_permitidas: data.obras_permitidas || [],
    created_at: now,
    updated_at: now,
    passwordHash: hash,
    passwordSalt: salt,
  };

  db.users.push(newUser);

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: admin.id,
    usuario_nome: admin.nome,
    usuario_email: admin.email,
    acao: 'CRIACAO_USUARIO',
    entidade: 'usuario',
    registro_id: newUser.id,
    valores_anteriores: null,
    valores_novos: { email: newUser.email, role: newUser.role, nome: newUser.nome },
    descricao_resumo: `Administrador criou usuário: ${newUser.nome} (${newUser.email}) com perfil ${newUser.role}`,
    created_at: now,
  });

  saveDatabase(db);
  return stripPassword(newUser);
}

export function updateUserStatus(admin: UserProfile, userId: string, novoStatus: 'ativo' | 'bloqueado'): UserProfile {
  if (admin.role !== 'ADMINISTRADOR') {
    throw new Error('Apenas administradores podem alterar o status de usuários.');
  }

  const db = ensureDatabase();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('Usuário não encontrado.');

  if (user.id === admin.id && novoStatus === 'bloqueado') {
    throw new Error('O administrador não pode bloquear sua própria conta.');
  }

  const antigoStatus = user.status;
  user.status = novoStatus;
  user.updated_at = new Date().toISOString();

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: admin.id,
    usuario_nome: admin.nome,
    usuario_email: admin.email,
    acao: 'STATUS_USUARIO',
    entidade: 'usuario',
    registro_id: user.id,
    valores_anteriores: { status: antigoStatus },
    valores_novos: { status: novoStatus },
    descricao_resumo: `Status do usuário ${user.nome} alterado para ${novoStatus}`,
    created_at: new Date().toISOString(),
  });

  saveDatabase(db);
  return stripPassword(user);
}

export function updateUserRole(admin: UserProfile, userId: string, novaRole: UserRole): UserProfile {
  if (admin.role !== 'ADMINISTRADOR') {
    throw new Error('Apenas administradores podem alterar permissões de usuários.');
  }

  const db = ensureDatabase();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('Usuário não encontrado.');

  if (user.id === admin.id && novaRole !== 'ADMINISTRADOR') {
    const totalAdmins = db.users.filter((u) => u.role === 'ADMINISTRADOR' && u.status === 'ativo').length;
    if (totalAdmins <= 1) {
      throw new Error('Não é possível remover o perfil de administrador do único administrador ativo.');
    }
  }

  const antigaRole = user.role;
  user.role = novaRole;
  user.updated_at = new Date().toISOString();

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: admin.id,
    usuario_nome: admin.nome,
    usuario_email: admin.email,
    acao: 'EDICAO',
    entidade: 'usuario',
    registro_id: user.id,
    valores_anteriores: { role: antigaRole },
    valores_novos: { role: novaRole },
    descricao_resumo: `Perfil do usuário ${user.nome} alterado de ${antigaRole} para ${novaRole}`,
    created_at: new Date().toISOString(),
  });

  saveDatabase(db);
  return stripPassword(user);
}

// -------------------------------------------------------------
// GESTÃO DE OBRAS
// -------------------------------------------------------------
export function getAllObras(includeInactive = true): Obra[] {
  const db = ensureDatabase();
  if (includeInactive) return db.obras;
  return db.obras.filter((o) => o.status === 'ativo');
}

export function createObra(admin: UserProfile, data: { codigo: string; nome: string; descricao?: string }): Obra {
  if (admin.role !== 'ADMINISTRADOR') {
    throw new Error('Apenas administradores podem cadastrar obras.');
  }

  const db = ensureDatabase();
  const codigoUpper = data.codigo.trim().toUpperCase();
  if (db.obras.some((o) => o.codigo.toUpperCase() === codigoUpper)) {
    throw new Error(`Código de obra já existente: ${codigoUpper}`);
  }

  const now = new Date().toISOString();
  const newObra: Obra = {
    id: `obr-${crypto.randomUUID()}`,
    codigo: codigoUpper,
    nome: data.nome.trim(),
    descricao: data.descricao?.trim() || '',
    status: 'ativo',
    created_at: now,
    updated_at: now,
  };

  db.obras.push(newObra);

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: admin.id,
    usuario_nome: admin.nome,
    usuario_email: admin.email,
    acao: 'CADASTRO_OBRA',
    entidade: 'obra',
    registro_id: newObra.id,
    obra_id: newObra.id,
    obra_nome: newObra.nome,
    valores_anteriores: null,
    valores_novos: { codigo: newObra.codigo, nome: newObra.nome, status: 'ativo' },
    descricao_resumo: `Cadastrada nova obra: ${newObra.codigo} - ${newObra.nome}`,
    created_at: now,
  });

  saveDatabase(db);
  return newObra;
}

export function updateObra(
  admin: UserProfile,
  obraId: string,
  data: { nome?: string; descricao?: string; status?: 'ativo' | 'inativo' }
): Obra {
  if (admin.role !== 'ADMINISTRADOR') {
    throw new Error('Apenas administradores podem alterar obras.');
  }

  const db = ensureDatabase();
  const obra = db.obras.find((o) => o.id === obraId);
  if (!obra) throw new Error('Obra não encontrada.');

  const anteriores = { nome: obra.nome, descricao: obra.descricao, status: obra.status };
  if (data.nome) obra.nome = data.nome.trim();
  if (data.descricao !== undefined) obra.descricao = data.descricao.trim();
  if (data.status) obra.status = data.status;
  obra.updated_at = new Date().toISOString();

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: admin.id,
    usuario_nome: admin.nome,
    usuario_email: admin.email,
    acao: 'EDICAO_OBRA',
    entidade: 'obra',
    registro_id: obra.id,
    obra_id: obra.id,
    obra_nome: obra.nome,
    valores_anteriores: anteriores,
    valores_novos: { nome: obra.nome, descricao: obra.descricao, status: obra.status },
    descricao_resumo: `Atualizada obra ${obra.codigo} - ${obra.nome} (Status: ${obra.status})`,
    created_at: new Date().toISOString(),
  });

  saveDatabase(db);
  return obra;
}

export function getObrasWithStats(includeInactive = true): (Obra & { total_lancamentos: number; total_bruto: number })[] {
  const db = ensureDatabase();
  const obras = includeInactive ? db.obras : db.obras.filter((o) => o.status === 'ativo');

  return obras.map((obra) => {
    const lancamentosDaObra = db.lancamentos.filter((l) => l.obra_id === obra.id);
    const total_lancamentos = lancamentosDaObra.length;
    const total_bruto = lancamentosDaObra.reduce((acc, curr) => acc + (Number(curr.valor_bruto) || 0), 0);
    return {
      ...obra,
      total_lancamentos,
      total_bruto,
    };
  });
}

export function deleteObra(
  admin: UserProfile,
  obraId: string,
  options: { reassignLancamentosToSemObra?: boolean } = {}
): { removida: Obra; lancamentosReatribuidos: number } {
  if (admin.role !== 'ADMINISTRADOR') {
    throw new Error('Apenas administradores podem excluir obras.');
  }

  const db = ensureDatabase();
  const index = db.obras.findIndex((o) => o.id === obraId || o.codigo === obraId);
  if (index === -1) {
    throw new Error('Obra não encontrada.');
  }

  const obra = db.obras[index];
  const vinculados = db.lancamentos.filter((l) => l.obra_id === obra.id);
  let lancamentosReatribuidos = 0;

  if (vinculados.length > 0) {
    if (options.reassignLancamentosToSemObra) {
      // Reatribui para outra obra ativa restante no sistema (ou para a primeira disponível)
      const remainingObra = db.obras.find((o) => o.id !== obra.id && o.status === 'ativo') || db.obras.find((o) => o.id !== obra.id);
      const targetId = remainingObra ? remainingObra.id : 'obra-promorar-01';
      const targetNome = remainingObra ? remainingObra.nome : 'PROMORAR';

      for (const l of vinculados) {
        l.obra_id = targetId;
        l.obra_nome = targetNome;
        l.updated_at = new Date().toISOString();
      }
      lancamentosReatribuidos = vinculados.length;
    } else {
      throw new Error(
        `Esta obra possui ${vinculados.length} lançamento(s) vinculados. Para manter a conformidade fiscal, inative a obra ou marque a opção de transferir os lançamentos para outra obra.`
      );
    }
  }

  db.obras.splice(index, 1);

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: admin.id,
    usuario_nome: admin.nome,
    usuario_email: admin.email,
    acao: 'EXCLUSAO',
    entidade: 'obra',
    registro_id: obra.id,
    obra_id: obra.id,
    obra_nome: obra.nome,
    valores_anteriores: { codigo: obra.codigo, nome: obra.nome, status: obra.status },
    valores_novos: { lancamentos_transferidos: lancamentosReatribuidos },
    descricao_resumo: `Exclusão da obra ${obra.codigo} - ${obra.nome} (${lancamentosReatribuidos} lançamentos transferidos)`,
    created_at: new Date().toISOString(),
  });

  saveDatabase(db);
  return { removida: obra, lancamentosReatribuidos };
}

// -------------------------------------------------------------
// GESTÃO DE LANÇAMENTOS (NOTAS FISCAIS E MEDIÇÕES)
// -------------------------------------------------------------

/**
 * Converte qualquer representação de data (AAAA-MM-DD, DD/MM/AAAA ou ISO) para AAAA-MM-DD
 */
export function normalizeDateToISO(dateStr?: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }

  const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Retorna a data do dia de abertura do sistema no formato AAAA-MM-DD
 */
export function getTodayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Atualiza automaticamente a situação para 'Pago' caso a data de pagamento
 * tenha passado ou alcançado a data de hoje (data de abertura do sistema).
 */
export function autoUpdateLancamentosStatus(db: DatabaseSchema): boolean {
  const today = getTodayISODate();
  let changed = false;

  for (const item of db.lancamentos) {
    if (!item.data_pagamento) continue;
    const pagISO = normalizeDateToISO(item.data_pagamento);
    if (pagISO && pagISO <= today) {
      if (item.status_pagamento !== 'Pago' && item.status_pagamento !== 'Cancelado') {
        item.status_pagamento = 'Pago';
        item.updated_at = new Date().toISOString();
        changed = true;
      }
    }
  }

  return changed;
}

export function getLancamentos(filter: LancamentoFilter = {}): {
  data: Lancamento[];
  total: number;
  page: number;
  limit: number;
  total_paginas: number;
  soma_valor_bruto: number;
  soma_valor_liquido: number;
} {
  const db = ensureDatabase();

  // Atualiza automaticamente situações de pagamentos vencidos/passados para 'Pago'
  if (autoUpdateLancamentosStatus(db)) {
    try {
      saveDatabase(db);
    } catch {
      // continua com dados em memória
    }
  }

  const obraMap = new Map(db.obras.map((o) => [o.id, o.nome]));

  let items = db.lancamentos.map((item) => ({
    ...item,
    obra_nome: obraMap.get(item.obra_id) || 'Obra Desconhecida',
  }));

  // Filtro por obra
  if (filter.obra_id && filter.obra_id !== 'todas') {
    items = items.filter((item) => item.obra_id === filter.obra_id);
  }

  // Filtro por termo de busca (Fornecedor, OC, Medição, NF)
  if (filter.busca && filter.busca.trim() !== '') {
    const q = filter.busca.trim().toLowerCase();
    items = items.filter(
      (item) =>
        item.fornecedor.toLowerCase().includes(q) ||
        item.numero_oc.toLowerCase().includes(q) ||
        (item.numero_medicao && item.numero_medicao.toLowerCase().includes(q)) ||
        item.numero_nf.toLowerCase().includes(q) ||
        (item.categoria_despesa && item.categoria_despesa.toLowerCase().includes(q))
    );
  }

  // Filtro por categoria
  if (filter.categoria && filter.categoria !== 'todas') {
    items = items.filter((item) => item.categoria_despesa === filter.categoria);
  }

  // Filtro por status de pagamento
  if (filter.status_pagamento && filter.status_pagamento !== 'todos') {
    items = items.filter((item) => item.status_pagamento === filter.status_pagamento);
  }

  // Filtro por data de lançamento (de / até)
  if (filter.data_lancamento_inicio) {
    items = items.filter((item) => item.data_lancamento >= filter.data_lancamento_inicio!);
  }
  if (filter.data_lancamento_fim) {
    items = items.filter((item) => item.data_lancamento <= filter.data_lancamento_fim!);
  }

  // Filtro por data de pagamento (de / até)
  if (filter.data_pagamento_inicio) {
    items = items.filter((item) => item.data_pagamento && item.data_pagamento >= filter.data_pagamento_inicio!);
  }
  if (filter.data_pagamento_fim) {
    items = items.filter((item) => item.data_pagamento && item.data_pagamento <= filter.data_pagamento_fim!);
  }

  // Totais do filtro antes da paginação
  const total = items.length;
  const soma_valor_bruto = items.reduce((acc, curr) => acc + (Number(curr.valor_bruto) || 0), 0);
  const soma_valor_liquido = items.reduce((acc, curr) => acc + (Number(curr.valor_liquido) || 0), 0);

  // Ordenação
  const sortBy = filter.sort_by || 'data_lancamento';
  const sortOrder = filter.sort_order || 'desc';

  items.sort((a, b) => {
    const valA = a[sortBy] ?? '';
    const valB = b[sortBy] ?? '';

    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }

    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();
    if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
    if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginação
  const page = Math.max(1, filter.page || 1);
  const limit = Math.max(1, filter.limit || 15);
  const total_paginas = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedData = items.slice(startIndex, startIndex + limit);

  return {
    data: paginatedData,
    total,
    page,
    limit,
    total_paginas,
    soma_valor_bruto,
    soma_valor_liquido,
  };
}

export function checkDuplicateLancamento(obra_id: string, fornecedor: string, numero_nf: string, excludeId?: string) {
  const db = ensureDatabase();
  const fClean = fornecedor.trim().toLowerCase();
  const nfClean = numero_nf.trim().toLowerCase();

  return db.lancamentos.some(
    (item) =>
      item.id !== excludeId &&
      item.obra_id === obra_id &&
      item.fornecedor.trim().toLowerCase() === fClean &&
      item.numero_nf.trim().toLowerCase() === nfClean
  );
}

export function createLancamento(
  user: UserProfile,
  data: {
    obra_id: string;
    fornecedor: string;
    numero_oc: string;
    numero_medicao?: string;
    numero_nf: string;
    valor_bruto: number;
    valor_liquido: number;
    data_lancamento: string;
    data_pagamento?: string;
    status_pagamento?: 'Pendente' | 'Pago' | 'A Vencer' | 'Cancelado';
    data_confirmacao_pagamento?: string;
    categoria_despesa?: string;
    observacao?: string;
  }
): Lancamento {
  const db = ensureDatabase();
  let obra = db.obras.find((o) => o.id === data.obra_id) || db.obras[0];
  if (!obra) {
    const now = new Date().toISOString();
    const novaObra: Obra = {
      id: `obr-${crypto.randomUUID()}`,
      codigo: 'OBR-01',
      nome: 'Obra Principal',
      descricao: 'Obra inicial criada automaticamente para o lançamento',
      status: 'ativo',
      created_at: now,
      updated_at: now,
    };
    db.obras.push(novaObra);
    obra = novaObra;
  }

  // Validação dos campos obrigatórios
  if (!data.fornecedor || !data.fornecedor.trim()) {
    throw new Error('O campo Fornecedor é obrigatório.');
  }
  if (!data.numero_oc || !data.numero_oc.trim()) {
    throw new Error('O campo Nº de OC é obrigatório.');
  }
  if (!data.numero_nf || !data.numero_nf.trim()) {
    throw new Error('O campo Nº de NF é obrigatório.');
  }
  if (data.valor_bruto === undefined || isNaN(Number(data.valor_bruto)) || Number(data.valor_bruto) < 0) {
    throw new Error('Valor bruto inválido.');
  }
  if (data.valor_liquido === undefined || isNaN(Number(data.valor_liquido)) || Number(data.valor_liquido) < 0) {
    throw new Error('Valor líquido inválido.');
  }
  if (!data.data_lancamento) {
    throw new Error('A data de lançamento é obrigatória.');
  }

  const now = new Date().toISOString();
  let statusInicial: StatusPagamento = data.status_pagamento || 'Pendente';
  if (data.data_pagamento) {
    const pagISO = normalizeDateToISO(data.data_pagamento);
    if (pagISO && pagISO <= getTodayISODate() && statusInicial !== 'Cancelado') {
      statusInicial = 'Pago';
    }
  }

  const newLancamento: Lancamento = {
    id: `lan-${crypto.randomUUID()}`,
    obra_id: data.obra_id,
    obra_nome: obra.nome,
    fornecedor: data.fornecedor.trim(),
    numero_oc: String(data.numero_oc).trim(), // preserva zeros à esquerda
    numero_medicao: data.numero_medicao ? String(data.numero_medicao).trim() : '',
    numero_nf: String(data.numero_nf).trim(), // preserva zeros à esquerda
    valor_bruto: Number(data.valor_bruto),
    valor_liquido: Number(data.valor_liquido),
    data_lancamento: data.data_lancamento,
    data_pagamento: data.data_pagamento || '',
    status_pagamento: statusInicial,
    data_confirmacao_pagamento: data.data_confirmacao_pagamento || '',
    categoria_despesa: data.categoria_despesa ? data.categoria_despesa.trim() : 'Geral',
    observacao: data.observacao ? data.observacao.trim() : '',
    criado_por_id: user.id,
    criado_por_nome: user.nome,
    created_at: now,
    updated_at: now,
  };

  db.lancamentos.unshift(newLancamento);

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: user.id,
    usuario_nome: user.nome,
    usuario_email: user.email,
    acao: 'CRIACAO',
    entidade: 'lancamento',
    registro_id: newLancamento.id,
    obra_id: obra.id,
    obra_nome: obra.nome,
    valores_anteriores: null,
    valores_novos: {
      fornecedor: newLancamento.fornecedor,
      numero_nf: newLancamento.numero_nf,
      valor_bruto: newLancamento.valor_bruto,
      valor_liquido: newLancamento.valor_liquido,
    },
    descricao_resumo: `Inclusão de NF ${newLancamento.numero_nf} (${newLancamento.fornecedor}) na obra ${obra.nome}`,
    created_at: now,
  });

  saveDatabase(db);
  return newLancamento;
}

export function updateLancamento(
  user: UserProfile,
  id: string,
  data: Partial<Lancamento>
): Lancamento {
  // Apenas Administrador pode editar
  if (user.role !== 'ADMINISTRADOR') {
    throw new Error('Acesso negado: apenas administradores podem corrigir registros existentes.');
  }

  const db = ensureDatabase();
  const index = db.lancamentos.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error('Lançamento não encontrado.');
  }

  const atual = db.lancamentos[index];
  const obra = db.obras.find((o) => o.id === (data.obra_id || atual.obra_id));

  const valoresAnteriores = { ...atual };
  const now = new Date().toISOString();

  const atualizado: Lancamento = {
    ...atual,
    obra_id: data.obra_id || atual.obra_id,
    obra_nome: obra?.nome || atual.obra_nome,
    fornecedor: data.fornecedor !== undefined ? data.fornecedor.trim() : atual.fornecedor,
    numero_oc: data.numero_oc !== undefined ? String(data.numero_oc).trim() : atual.numero_oc,
    numero_medicao: data.numero_medicao !== undefined ? String(data.numero_medicao).trim() : atual.numero_medicao,
    numero_nf: data.numero_nf !== undefined ? String(data.numero_nf).trim() : atual.numero_nf,
    valor_bruto: data.valor_bruto !== undefined ? Number(data.valor_bruto) : atual.valor_bruto,
    valor_liquido: data.valor_liquido !== undefined ? Number(data.valor_liquido) : atual.valor_liquido,
    data_lancamento: data.data_lancamento || atual.data_lancamento,
    data_pagamento: data.data_pagamento !== undefined ? data.data_pagamento : atual.data_pagamento,
    status_pagamento: (() => {
      const explicitStatus = data.status_pagamento || atual.status_pagamento;
      const targetPag = data.data_pagamento !== undefined ? data.data_pagamento : atual.data_pagamento;
      if (targetPag) {
        const pagISO = normalizeDateToISO(targetPag);
        if (pagISO && pagISO <= getTodayISODate() && explicitStatus !== 'Cancelado') {
          return 'Pago';
        }
      }
      return explicitStatus;
    })(),
    data_confirmacao_pagamento: data.data_confirmacao_pagamento !== undefined ? data.data_confirmacao_pagamento : atual.data_confirmacao_pagamento,
    categoria_despesa: data.categoria_despesa !== undefined ? data.categoria_despesa.trim() : atual.categoria_despesa,
    observacao: data.observacao !== undefined ? data.observacao.trim() : atual.observacao,
    atualizado_por_id: user.id,
    atualizado_por_nome: user.nome,
    updated_at: now,
  };

  db.lancamentos[index] = atualizado;

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: user.id,
    usuario_nome: user.nome,
    usuario_email: user.email,
    acao: 'EDICAO',
    entidade: 'lancamento',
    registro_id: atualizado.id,
    obra_id: atualizado.obra_id,
    obra_nome: atualizado.obra_nome,
    valores_anteriores: {
      fornecedor: valoresAnteriores.fornecedor,
      numero_nf: valoresAnteriores.numero_nf,
      valor_bruto: valoresAnteriores.valor_bruto,
      valor_liquido: valoresAnteriores.valor_liquido,
      status_pagamento: valoresAnteriores.status_pagamento,
    },
    valores_novos: {
      fornecedor: atualizado.fornecedor,
      numero_nf: atualizado.numero_nf,
      valor_bruto: atualizado.valor_bruto,
      valor_liquido: atualizado.valor_liquido,
      status_pagamento: atualizado.status_pagamento,
    },
    descricao_resumo: `Administrador ${user.nome} alterou o lançamento NF ${atualizado.numero_nf} (${atualizado.fornecedor})`,
    created_at: now,
  });

  saveDatabase(db);
  return atualizado;
}

export function deleteLancamento(user: UserProfile, id: string): void {
  // Apenas Administrador pode excluir
  if (user.role !== 'ADMINISTRADOR') {
    throw new Error('Acesso negado: apenas administradores podem excluir registros.');
  }

  const db = ensureDatabase();
  const index = db.lancamentos.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error('Lançamento não encontrado.');
  }

  const removido = db.lancamentos[index];
  db.lancamentos.splice(index, 1);

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: user.id,
    usuario_nome: user.nome,
    usuario_email: user.email,
    acao: 'EXCLUSAO',
    entidade: 'lancamento',
    registro_id: removido.id,
    obra_id: removido.obra_id,
    obra_nome: removido.obra_nome,
    valores_anteriores: {
      fornecedor: removido.fornecedor,
      numero_nf: removido.numero_nf,
      numero_oc: removido.numero_oc,
      valor_bruto: removido.valor_bruto,
      valor_liquido: removido.valor_liquido,
      data_lancamento: removido.data_lancamento,
    },
    valores_novos: null,
    descricao_resumo: `Exclusão do registro NF ${removido.numero_nf} de ${removido.fornecedor} (Valor: R$ ${removido.valor_bruto.toFixed(2)})`,
    created_at: new Date().toISOString(),
  });

  saveDatabase(db);
}

export function clearAllLancamentos(user: UserProfile): { totalRemovidos: number } {
  if (user.role !== 'ADMINISTRADOR') {
    throw new Error('Acesso negado: apenas administradores podem zerar os lançamentos.');
  }

  const db = ensureDatabase();
  const totalRemovidos = db.lancamentos.length;
  db.lancamentos = [];
  db.import_batches = [];

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: user.id,
    usuario_nome: user.nome,
    usuario_email: user.email,
    acao: 'EXCLUSAO',
    entidade: 'lancamento',
    valores_anteriores: { total_lancamentos: totalRemovidos },
    valores_novos: { total_lancamentos: 0 },
    descricao_resumo: `Administrador ${user.nome} zerou definitivamente todos os ${totalRemovidos} lançamentos do sistema.`,
    created_at: new Date().toISOString(),
  });

  saveDatabase(db);
  return { totalRemovidos };
}

export function clearAllData(user: UserProfile): { totalObrasRemovidas: number; totalLancamentosRemovidos: number } {
  if (user.role !== 'ADMINISTRADOR') {
    throw new Error('Acesso negado: apenas administradores podem zerar todos os dados do sistema.');
  }

  const db = ensureDatabase();
  const totalObrasRemovidas = db.obras.length;
  const totalLancamentosRemovidos = db.lancamentos.length;

  db.obras = [];
  db.lancamentos = [];
  db.import_batches = [];

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: user.id,
    usuario_nome: user.nome,
    usuario_email: user.email,
    acao: 'EXCLUSAO',
    entidade: 'sistema',
    valores_anteriores: { obras: totalObrasRemovidas, lancamentos: totalLancamentosRemovidos },
    valores_novos: { obras: 0, lancamentos: 0 },
    descricao_resumo: `Administrador ${user.nome} zerou todos os dados do sistema (incluindo obras e lançamentos).`,
    created_at: new Date().toISOString(),
  });

  saveDatabase(db);
  return { totalObrasRemovidas, totalLancamentosRemovidos };
}

// -------------------------------------------------------------
// AUDITORIA
// -------------------------------------------------------------
export function getAuditLogs(filter: {
  page?: number;
  limit?: number;
  acao?: string;
  entidade?: string;
  usuario_id?: string;
  busca?: string;
}): { data: AuditLog[]; total: number; page: number; total_paginas: number } {
  const db = ensureDatabase();
  let logs = [...db.audit_logs];

  if (filter.acao && filter.acao !== 'todas') {
    logs = logs.filter((l) => l.acao === filter.acao);
  }
  if (filter.entidade && filter.entidade !== 'todas') {
    logs = logs.filter((l) => l.entidade === filter.entidade);
  }
  if (filter.usuario_id) {
    logs = logs.filter((l) => l.usuario_id === filter.usuario_id);
  }
  if (filter.busca && filter.busca.trim()) {
    const q = filter.busca.toLowerCase();
    logs = logs.filter(
      (l) =>
        l.descricao_resumo.toLowerCase().includes(q) ||
        l.usuario_nome.toLowerCase().includes(q) ||
        l.usuario_email.toLowerCase().includes(q) ||
        (l.obra_nome && l.obra_nome.toLowerCase().includes(q))
    );
  }

  const total = logs.length;
  const page = Math.max(1, filter.page || 1);
  const limit = Math.max(1, filter.limit || 20);
  const total_paginas = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;

  return {
    data: logs.slice(startIndex, startIndex + limit),
    total,
    page,
    total_paginas,
  };
}

// -------------------------------------------------------------
// DASHBOARD & MÉTRICAS (COM SUPORTE A FILTRO DE OBRA)
// -------------------------------------------------------------
export function getDashboardMetrics(obra_id?: string): DashboardMetrics {
  const db = ensureDatabase();

  // Garante que o dashboard reflita imediatamente lançamentos cuja data de pagamento passou
  if (autoUpdateLancamentosStatus(db)) {
    try {
      saveDatabase(db);
    } catch {
      // continua com dados em memória
    }
  }

  let items = db.lancamentos;

  if (obra_id && obra_id !== 'todas') {
    items = items.filter((item) => item.obra_id === obra_id);
  }

  const total_lancamentos = items.length;
  const soma_valor_bruto = items.reduce((acc, curr) => acc + (Number(curr.valor_bruto) || 0), 0);
  const soma_valor_liquido = items.reduce((acc, curr) => acc + (Number(curr.valor_liquido) || 0), 0);
  const soma_retencoes = Math.max(0, soma_valor_bruto - soma_valor_liquido);

  let total_pago = 0;
  let total_pendente = 0;

  const categoriasMap = new Map<string, { quantidade: number; total_bruto: number }>();
  const periodosMap = new Map<string, { total_bruto: number; total_liquido: number; quantidade: number }>();
  const statusMap = new Map<string, { quantidade: number; total: number }>();

  for (const item of items) {
    const bruto = Number(item.valor_bruto) || 0;
    const liquido = Number(item.valor_liquido) || 0;

    // Situação de pagamentos: baseado em confirmação ou status
    const status = item.status_pagamento || 'Pendente';
    if (status === 'Pago') {
      total_pago += liquido;
    } else {
      total_pendente += liquido;
    }

    const currentStatus = statusMap.get(status) || { quantidade: 0, total: 0 };
    currentStatus.quantidade += 1;
    currentStatus.total += liquido;
    statusMap.set(status, currentStatus);

    // Categoria
    const cat = item.categoria_despesa && item.categoria_despesa.trim() ? item.categoria_despesa.trim() : 'Outros';
    const currentCat = categoriasMap.get(cat) || { quantidade: 0, total_bruto: 0 };
    currentCat.quantidade += 1;
    currentCat.total_bruto += bruto;
    categoriasMap.set(cat, currentCat);

    // Período (Mês/Ano a partir da data de lançamento)
    let mesAno = 'Sem Data';
    if (item.data_lancamento) {
      const parts = item.data_lancamento.split('-');
      if (parts.length >= 2) {
        mesAno = `${parts[1]}/${parts[0]}`;
      }
    }
    const currentPeriodo = periodosMap.get(mesAno) || { total_bruto: 0, total_liquido: 0, quantidade: 0 };
    currentPeriodo.total_bruto += bruto;
    currentPeriodo.total_liquido += liquido;
    currentPeriodo.quantidade += 1;
    periodosMap.set(mesAno, currentPeriodo);
  }

  const por_categoria = Array.from(categoriasMap.entries())
    .map(([categoria, info]) => ({
      categoria,
      quantidade: info.quantidade,
      total_bruto: info.total_bruto,
      percentual: soma_valor_bruto > 0 ? (info.total_bruto / soma_valor_bruto) * 100 : 0,
    }))
    .sort((a, b) => b.total_bruto - a.total_bruto);

  const por_periodo = Array.from(periodosMap.entries())
    .map(([mes_ano, info]) => ({
      mes_ano,
      total_bruto: info.total_bruto,
      total_liquido: info.total_liquido,
      quantidade: info.quantidade,
    }))
    .sort((a, b) => {
      // Ordenação cronológica por MM/AAAA
      const [mA, yA] = a.mes_ano.split('/').map(Number);
      const [mB, yB] = b.mes_ano.split('/').map(Number);
      if (yA !== yB) return (yA || 0) - (yB || 0);
      return (mA || 0) - (mB || 0);
    });

  const situacao_pagamentos = Array.from(statusMap.entries()).map(([status, info]) => ({
    status: status as any,
    quantidade: info.quantidade,
    total: info.total,
  }));

  return {
    total_lancamentos,
    soma_valor_bruto,
    soma_valor_liquido,
    soma_retencoes,
    total_pago,
    total_pendente,
    por_categoria,
    por_periodo,
    situacao_pagamentos,
  };
}

// -------------------------------------------------------------
// IMPORTAÇÃO DE PLANILHA EM LOTE COM REVERSÃO (EXCLUIR LOTE)
// -------------------------------------------------------------
export interface ValidatedImportRow {
  linha: number;
  valida: boolean;
  erros: string[];
  fornecedor: string;
  numero_oc: string;
  numero_medicao?: string;
  numero_nf: string;
  valor_bruto: number;
  valor_liquido: number;
  data_lancamento: string;
  data_pagamento?: string;
  categoria_despesa?: string;
  observacao?: string;
  is_duplicada?: boolean;
}

export function importSpreadsheetBatch(
  admin: UserProfile,
  obra_id: string,
  arquivo_nome: string,
  linhasValidas: ValidatedImportRow[],
  obraInfo?: { nome?: string; codigo?: string }
): { batch: ImportBatch; totalInseridos: number } {
  if (admin.role !== 'ADMINISTRADOR') {
    throw new Error('Apenas o Administrador pode confirmar a importação de planilhas.');
  }

  const db = ensureDatabase();
  let obra = db.obras.find((o) => o.id === obra_id) || db.obras[0];
  const now = new Date().toISOString();

  if (!obra) {
    const novaObra: Obra = {
      id: obra_id && obra_id.trim() ? obra_id : `obr-${crypto.randomUUID()}`,
      codigo: obraInfo?.codigo || 'OBR-001',
      nome: obraInfo?.nome || 'PROMORAR - RECIFE',
      descricao: `Obra vinculada automaticamente na importação de ${arquivo_nome}`,
      status: 'ativo',
      created_at: now,
      updated_at: now,
    };
    db.obras.push(novaObra);
    obra = novaObra;
  }

  const batchId = `lote-${crypto.randomUUID()}`;

  let somaBruto = 0;
  let somaLiquido = 0;
  const novosLancamentos: Lancamento[] = [];

  for (const row of linhasValidas) {
    if (!row.valida) continue;

    somaBruto += Number(row.valor_bruto) || 0;
    somaLiquido += Number(row.valor_liquido) || 0;

    novosLancamentos.push({
      id: `lan-${crypto.randomUUID()}`,
      obra_id: obra.id,
      obra_nome: obra.nome,
      fornecedor: row.fornecedor.trim(),
      numero_oc: String(row.numero_oc).trim(),
      numero_medicao: row.numero_medicao ? String(row.numero_medicao).trim() : '',
      numero_nf: String(row.numero_nf).trim(),
      valor_bruto: Number(row.valor_bruto),
      valor_liquido: Number(row.valor_liquido),
      data_lancamento: row.data_lancamento,
      data_pagamento: row.data_pagamento || '',
      status_pagamento: (() => {
        if (row.data_pagamento) {
          const pagISO = normalizeDateToISO(row.data_pagamento);
          if (pagISO && pagISO <= getTodayISODate()) {
            return 'Pago';
          }
        }
        return 'Pendente';
      })(),
      categoria_despesa: row.categoria_despesa ? row.categoria_despesa.trim() : 'Geral',
      observacao: row.observacao ? row.observacao.trim() : '',
      criado_por_id: admin.id,
      criado_por_nome: admin.nome,
      lote_importacao_id: batchId,
      created_at: now,
      updated_at: now,
    });
  }

  const batch: ImportBatch = {
    id: batchId,
    obra_id: obra.id,
    obra_nome: obra.nome,
    arquivo_nome,
    total_registros: novosLancamentos.length,
    total_bruto: somaBruto,
    total_liquido: somaLiquido,
    usuario_id: admin.id,
    usuario_nome: admin.nome,
    status: 'ativo',
    created_at: now,
  };

  db.import_batches.unshift(batch);
  db.lancamentos.unshift(...novosLancamentos);

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: admin.id,
    usuario_nome: admin.nome,
    usuario_email: admin.email,
    acao: 'IMPORTACAO',
    entidade: 'lote_importacao',
    registro_id: batch.id,
    obra_id: obra.id,
    obra_nome: obra.nome,
    valores_anteriores: null,
    valores_novos: {
      arquivo: arquivo_nome,
      total_registros: batch.total_registros,
      total_bruto: batch.total_bruto,
      total_liquido: batch.total_liquido,
    },
    descricao_resumo: `Importação em lote de ${batch.total_registros} registros da planilha "${arquivo_nome}" na obra ${obra.nome} (Total: R$ ${somaBruto.toFixed(2)})`,
    created_at: now,
  });

  saveDatabase(db);
  return { batch, totalInseridos: novosLancamentos.length };
}

export function rollbackImportBatch(admin: UserProfile, batchId: string): { removidos: number } {
  if (admin.role !== 'ADMINISTRADOR') {
    throw new Error('Apenas o Administrador pode reverter ou excluir lotes de importação.');
  }

  const db = ensureDatabase();
  const batch = db.import_batches.find((b) => b.id === batchId);
  if (!batch) {
    throw new Error('Lote de importação não encontrado.');
  }

  if (batch.status === 'revertido') {
    throw new Error('Este lote já foi revertido anteriormente.');
  }

  const antes = db.lancamentos.length;
  db.lancamentos = db.lancamentos.filter((l) => l.lote_importacao_id !== batchId);
  const removidos = antes - db.lancamentos.length;

  batch.status = 'revertido';

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: admin.id,
    usuario_nome: admin.nome,
    usuario_email: admin.email,
    acao: 'EXCLUSAO_LOTE',
    entidade: 'lote_importacao',
    registro_id: batch.id,
    obra_id: batch.obra_id,
    obra_nome: batch.obra_nome,
    valores_anteriores: { lote_id: batchId, total_registros: batch.total_registros },
    valores_novos: { status: 'revertido', registros_removidos: removidos },
    descricao_resumo: `Reversão/Exclusão do lote de importação "${batch.arquivo_nome}" (${removidos} registros removidos)`,
    created_at: new Date().toISOString(),
  });

  saveDatabase(db);
  return { removidos };
}

export function deleteImportBatch(admin: UserProfile, batchId: string): { removidos: number } {
  if (admin.role !== 'ADMINISTRADOR') {
    throw new Error('Apenas o Administrador pode excluir lotes de importação.');
  }

  const db = ensureDatabase();
  const batchIdx = db.import_batches.findIndex((b) => b.id === batchId);
  if (batchIdx === -1) {
    throw new Error('Lote de importação não encontrado.');
  }

  const batch = db.import_batches[batchIdx];
  const antes = db.lancamentos.length;
  db.lancamentos = db.lancamentos.filter((l) => l.lote_importacao_id !== batchId);
  const removidos = antes - db.lancamentos.length;

  db.import_batches.splice(batchIdx, 1);

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: admin.id,
    usuario_nome: admin.nome,
    usuario_email: admin.email,
    acao: 'EXCLUSAO_PLANILHA',
    entidade: 'lote_importacao',
    registro_id: batchId,
    obra_id: batch.obra_id,
    obra_nome: batch.obra_nome,
    valores_anteriores: { arquivo: batch.arquivo_nome, total_registros: batch.total_registros },
    valores_novos: null,
    descricao_resumo: `Administrador ${admin.nome} excluiu a planilha "${batch.arquivo_nome}" (${removidos} registros removidos)`,
    created_at: new Date().toISOString(),
  });

  saveDatabase(db);
  return { removidos };
}

export function replaceImportBatch(
  admin: UserProfile,
  batchId: string,
  targetObraId: string,
  arquivo_nome: string,
  linhasValidas: ValidatedImportRow[],
  obraInfo?: { nome?: string; codigo?: string }
): { batch: ImportBatch; totalInseridos: number } {
  if (admin.role !== 'ADMINISTRADOR') {
    throw new Error('Apenas o Administrador pode substituir lotes de importação.');
  }

  const db = ensureDatabase();
  // Remove registros anteriores vinculados ao lote
  db.lancamentos = db.lancamentos.filter((l) => l.lote_importacao_id !== batchId);

  const now = new Date().toISOString();
  let obra = db.obras.find((o) => o.id === targetObraId) || db.obras[0];
  if (!obra) {
    const novaObra: Obra = {
      id: targetObraId && targetObraId.trim() ? targetObraId : `obr-${crypto.randomUUID()}`,
      codigo: obraInfo?.codigo || 'OBR-001',
      nome: obraInfo?.nome || 'PROMORAR - RECIFE',
      descricao: `Obra vinculada automaticamente na substituição de ${arquivo_nome}`,
      status: 'ativo',
      created_at: now,
      updated_at: now,
    };
    db.obras.push(novaObra);
    obra = novaObra;
  }
  let somaBruto = 0;
  let somaLiquido = 0;
  const novosLancamentos: Lancamento[] = [];

  for (const row of linhasValidas) {
    if (!row.valida) continue;

    somaBruto += Number(row.valor_bruto) || 0;
    somaLiquido += Number(row.valor_liquido) || 0;

    novosLancamentos.push({
      id: `lan-${crypto.randomUUID()}`,
      obra_id: obra.id,
      obra_nome: obra.nome,
      fornecedor: row.fornecedor.trim(),
      numero_oc: String(row.numero_oc || '').trim(),
      numero_medicao: row.numero_medicao ? String(row.numero_medicao).trim() : '',
      numero_nf: String(row.numero_nf || '').trim(),
      valor_bruto: Number(row.valor_bruto),
      valor_liquido: Number(row.valor_liquido),
      data_lancamento: row.data_lancamento,
      data_pagamento: row.data_pagamento || '',
      status_pagamento: row.data_pagamento ? 'Pendente' : 'Pendente',
      categoria_despesa: row.categoria_despesa ? row.categoria_despesa.trim() : '',
      observacao: row.observacao ? row.observacao.trim() : '',
      criado_por_id: admin.id,
      criado_por_nome: admin.nome,
      lote_importacao_id: batchId,
      created_at: now,
      updated_at: now,
    });
  }

  const batchIdx = db.import_batches.findIndex((b) => b.id === batchId);
  const updatedBatch: ImportBatch = {
    id: batchId,
    obra_id: obra.id,
    obra_nome: obra.nome,
    arquivo_nome,
    total_registros: novosLancamentos.length,
    total_bruto: somaBruto,
    total_liquido: somaLiquido,
    usuario_id: admin.id,
    usuario_nome: admin.nome,
    status: 'ativo',
    created_at: now,
  };

  if (batchIdx >= 0) {
    db.import_batches[batchIdx] = updatedBatch;
  } else {
    db.import_batches.unshift(updatedBatch);
  }

  db.lancamentos.unshift(...novosLancamentos);

  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID()}`,
    usuario_id: admin.id,
    usuario_nome: admin.nome,
    usuario_email: admin.email,
    acao: 'SUBSTITUICAO_PLANILHA',
    entidade: 'lote_importacao',
    registro_id: batchId,
    obra_id: obra.id,
    obra_nome: obra.nome,
    valores_anteriores: null,
    valores_novos: {
      arquivo: arquivo_nome,
      total_registros: updatedBatch.total_registros,
    },
    descricao_resumo: `Administrador ${admin.nome} substituiu a planilha pela nova versão "${arquivo_nome}" (${updatedBatch.total_registros} registros)`,
    created_at: now,
  });

  saveDatabase(db);
  return { batch: updatedBatch, totalInseridos: novosLancamentos.length };
}

export function getImportBatches(): ImportBatch[] {
  const db = ensureDatabase();
  return db.import_batches;
}

export function getDatabaseSnapshot(): {
  obras: Obra[];
  lancamentos: Lancamento[];
  import_batches: ImportBatch[];
  timestamp: string;
} {
  const db = ensureDatabase();
  return {
    obras: db.obras,
    lancamentos: db.lancamentos,
    import_batches: db.import_batches,
    timestamp: new Date().toISOString(),
  };
}

export function restoreDatabaseSnapshot(
  user: UserProfile,
  snapshot: {
    obras?: Obra[];
    lancamentos?: Lancamento[];
    import_batches?: ImportBatch[];
  }
): { obras: Obra[]; lancamentos: Lancamento[]; import_batches: ImportBatch[] } {
  const db = ensureDatabase();

  let modified = false;

  if (Array.isArray(snapshot.obras) && snapshot.obras.length > 0) {
    db.obras = snapshot.obras;
    modified = true;
  }
  if (Array.isArray(snapshot.lancamentos) && snapshot.lancamentos.length > 0) {
    db.lancamentos = snapshot.lancamentos;
    modified = true;
  }
  if (Array.isArray(snapshot.import_batches) && snapshot.import_batches.length > 0) {
    db.import_batches = snapshot.import_batches;
    modified = true;
  }

  if (modified) {
    saveDatabase(db);
  }

  return {
    obras: db.obras,
    lancamentos: db.lancamentos,
    import_batches: db.import_batches,
  };
}

