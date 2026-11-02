export type UserRole = 'ADMINISTRADOR' | 'USUARIO';

export type UserStatus = 'ativo' | 'bloqueado';

export interface UserProfile {
  id: string;
  email: string;
  nome: string;
  cargo?: string;
  role: UserRole;
  status: UserStatus;
  obras_permitidas?: string[]; // IDs de obras com acesso liberado; se vazio/undefined, tem acesso geral
  ultimo_login?: string;
  created_at: string;
  updated_at: string;
}

export type ObraStatus = 'ativo' | 'inativo';

export interface Obra {
  id: string;
  codigo: string; // Ex: OBR-001
  nome: string; // Ex: PROMORAR
  descricao?: string;
  status: ObraStatus;
  created_at: string;
  updated_at: string;
}

export type StatusPagamento = 'Pendente' | 'Pago' | 'A Vencer' | 'Cancelado';

export interface Lancamento {
  id: string;
  obra_id: string;
  obra_nome?: string;
  fornecedor: string;
  numero_oc: string; // preserva zeros à esquerda (ex: '00412')
  numero_medicao?: string; // opcional
  numero_nf: string; // preserva zeros à esquerda (ex: '0009871')
  valor_bruto: number;
  valor_liquido: number;
  data_lancamento: string; // Formato ISO AAAA-MM-DD
  data_pagamento?: string; // Formato ISO AAAA-MM-DD (opcional)
  status_pagamento: StatusPagamento;
  data_confirmacao_pagamento?: string; // Confirmação de quitação efetiva
  categoria_despesa?: string;
  observacao?: string;
  criado_por_id: string;
  criado_por_nome: string;
  atualizado_por_id?: string;
  atualizado_por_nome?: string;
  lote_importacao_id?: string;
  created_at: string;
  updated_at: string;
}

export type AuditAction = 
  | 'CRIACAO'
  | 'EDICAO'
  | 'EXCLUSAO'
  | 'IMPORTACAO'
  | 'EXCLUSAO_LOTE'
  | 'EXCLUSAO_PLANILHA'
  | 'SUBSTITUICAO_PLANILHA'
  | 'CADASTRO_OBRA'
  | 'EDICAO_OBRA'
  | 'STATUS_OBRA'
  | 'CRIACAO_USUARIO'
  | 'STATUS_USUARIO'
  | 'ALTERACAO_SENHA';

export interface AuditLog {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  usuario_email: string;
  acao: AuditAction;
  entidade: 'lancamento' | 'obra' | 'usuario' | 'lote_importacao' | 'sistema';
  registro_id?: string;
  obra_id?: string;
  obra_nome?: string;
  valores_anteriores?: Record<string, unknown> | null;
  valores_novos?: Record<string, unknown> | null;
  descricao_resumo: string;
  created_at: string;
}

export interface ImportBatch {
  id: string;
  obra_id: string;
  obra_nome: string;
  arquivo_nome: string;
  total_registros: number;
  total_bruto: number;
  total_liquido: number;
  usuario_id: string;
  usuario_nome: string;
  status: 'ativo' | 'revertido';
  created_at: string;
}

export interface LancamentoFilter {
  obra_id?: string;
  busca?: string; // Fornecedor, OC, Medição, NF
  categoria?: string;
  status_pagamento?: string;
  data_lancamento_inicio?: string;
  data_lancamento_fim?: string;
  data_pagamento_inicio?: string;
  data_pagamento_fim?: string;
  page?: number;
  limit?: number;
  sort_by?: keyof Lancamento;
  sort_order?: 'asc' | 'desc';
}

export interface DashboardMetrics {
  total_lancamentos: number;
  soma_valor_bruto: number;
  soma_valor_liquido: number;
  soma_retencoes: number;
  total_pago: number;
  total_pendente: number;
  por_categoria: { categoria: string; quantidade: number; total_bruto: number; percentual: number }[];
  por_periodo: { mes_ano: string; total_bruto: number; total_liquido: number; quantidade: number }[];
  situacao_pagamentos: { status: StatusPagamento; quantidade: number; total: number }[];
}
