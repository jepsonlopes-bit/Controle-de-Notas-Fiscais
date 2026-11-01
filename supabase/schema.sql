-- =========================================================================
-- ESQUEMA DO BANCO DE DADOS: CONTROLE DE NOTAS FISCAIS E MEDIÇÕES
-- Compatível com Supabase / PostgreSQL com Row Level Security (RLS)
-- =========================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA: PROFILES (Perfis e Permissões de Usuários)
-- Integrada ao auth.users do Supabase
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cargo TEXT,
  role TEXT NOT NULL DEFAULT 'USUARIO' CHECK (role IN ('ADMINISTRADOR', 'USUARIO')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'bloqueado')),
  obras_permitidas JSONB DEFAULT '[]'::jsonb, -- Suporte a restrição granular futura de obras
  ultimo_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TABELA: OBRAS (Múltiplas Obras da Empresa)
CREATE TABLE IF NOT EXISTS public.obras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR(50) NOT NULL UNIQUE, -- Ex: 'OBR-001'
  nome VARCHAR(150) NOT NULL,         -- Ex: 'PROMORAR'
  descricao TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Inserção das obras iniciais padrão ('PROMORAR' e 'Sem Obra / Geral')
INSERT INTO public.obras (codigo, nome, descricao, status)
VALUES 
  ('OBR-001', 'PROMORAR', 'Obra Habitacional PROMORAR - Matriz Inicial', 'ativo'),
  ('GERAL', 'Sem Obra (Despesa Geral / Matriz)', 'Despesas gerais, corporativas ou sem obra específica vinculada', 'ativo')
ON CONFLICT (codigo) DO NOTHING;

-- 4. TABELA: LOTES_IMPORTACAO (Histórico de Lotes Importados via Planilha)
CREATE TABLE IF NOT EXISTS public.lotes_importacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE RESTRICT,
  arquivo_nome TEXT NOT NULL,
  total_registros INTEGER NOT NULL,
  total_bruto NUMERIC(15, 2) NOT NULL,
  total_liquido NUMERIC(15, 2) NOT NULL,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id),
  usuario_nome TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'revertido')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TABELA: LANCAMENTOS (Notas Fiscais, OCs, Medições e Pagamentos)
CREATE TABLE IF NOT EXISTS public.lancamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE RESTRICT,
  fornecedor VARCHAR(255) NOT NULL,
  numero_oc VARCHAR(100) NOT NULL,       -- Preserva zeros à esquerda
  numero_medicao VARCHAR(100),           -- Opcional, preserva texto/zeros
  numero_nf VARCHAR(100) NOT NULL,       -- Preserva zeros à esquerda
  valor_bruto NUMERIC(15, 2) NOT NULL CHECK (valor_bruto >= 0),
  valor_liquido NUMERIC(15, 2) NOT NULL CHECK (valor_liquido >= 0),
  data_lancamento DATE NOT NULL,
  data_pagamento DATE,                   -- Data prevista ou programada
  status_pagamento VARCHAR(30) NOT NULL DEFAULT 'Pendente' CHECK (status_pagamento IN ('Pendente', 'Pago', 'A Vencer', 'Cancelado')),
  data_confirmacao_pagamento DATE,       -- Confirmação do pagamento efetivamente realizado
  categoria_despesa VARCHAR(100),        -- Opcional
  observacao TEXT,                       -- Opcional
  criado_por_id UUID NOT NULL REFERENCES public.profiles(id),
  criado_por_nome VARCHAR(255) NOT NULL,
  atualizado_por_id UUID REFERENCES public.profiles(id),
  atualizado_por_nome VARCHAR(255),
  lote_importacao_id UUID REFERENCES public.lotes_importacao(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices para alta performance de consulta, filtros e ordenação
CREATE INDEX IF NOT EXISTS idx_lancamentos_obra_id ON public.lancamentos(obra_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_fornecedor ON public.lancamentos(fornecedor);
CREATE INDEX IF NOT EXISTS idx_lancamentos_numero_oc ON public.lancamentos(numero_oc);
CREATE INDEX IF NOT EXISTS idx_lancamentos_numero_nf ON public.lancamentos(numero_nf);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data_lancamento ON public.lancamentos(data_lancamento);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data_pagamento ON public.lancamentos(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_lancamentos_status_pagamento ON public.lancamentos(status_pagamento);

-- 6. TABELA: AUDIT_LOGS (Trilha de Auditoria Imutável)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL,
  usuario_nome VARCHAR(255) NOT NULL,
  usuario_email VARCHAR(255) NOT NULL,
  acao VARCHAR(50) NOT NULL,
  entidade VARCHAR(50) NOT NULL,
  registro_id UUID,
  obra_id UUID,
  obra_nome VARCHAR(150),
  valores_anteriores JSONB,
  valores_novos JSONB,
  descricao_resumo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_usuario ON public.audit_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entidade_reg ON public.audit_logs(entidade, registro_id);

-- =========================================================================
-- 7. FUNÇÃO HELPER: VERIFICAÇÃO SE O USUÁRIO É ADMINISTRADOR
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMINISTRADOR' AND status = 'ativo'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 8. ROW LEVEL SECURITY (RLS) - PRIVILÉGIOS MÍNIMOS
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_importacao ENABLE ROW LEVEL SECURITY;

-- 8.1 Políticas para PROFILES
-- Usuário autenticado pode ver seu próprio perfil
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Somente ADMINISTRADOR pode criar ou atualizar perfis de outros usuários
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8.2 Políticas para OBRAS
-- Todos os usuários autenticados ativos podem consultar obras
CREATE POLICY "obras_select_authenticated" ON public.obras
  FOR SELECT TO authenticated
  USING (true);

-- Somente ADMINISTRADOR pode criar, alterar ou desativar obras
CREATE POLICY "obras_admin_mutation" ON public.obras
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8.3 Políticas para LANCAMENTOS
-- Usuários autenticados podem consultar todos os lançamentos
CREATE POLICY "lancamentos_select_authenticated" ON public.lancamentos
  FOR SELECT TO authenticated
  USING (true);

-- Usuários comuns e administradores podem cadastrar novos lançamentos
CREATE POLICY "lancamentos_insert_authenticated" ON public.lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = criado_por_id);

-- SOMENTE ADMINISTRADOR pode atualizar lançamentos existentes
CREATE POLICY "lancamentos_update_admin_only" ON public.lancamentos
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SOMENTE ADMINISTRADOR pode excluir lançamentos
CREATE POLICY "lancamentos_delete_admin_only" ON public.lancamentos
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 8.4 Políticas para AUDIT_LOGS
-- Somente ADMINISTRADOR pode consultar a trilha de auditoria
CREATE POLICY "audit_logs_select_admin_only" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Qualquer usuário autenticado pode registrar evento via backend/trigger (INSERT)
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

-- Ninguém pode atualizar ou apagar registros de auditoria (IMUTABILIDADE)
-- Não há políticas de UPDATE ou DELETE criadas, bloqueando qualquer tentativa.

-- 8.5 Políticas para LOTES_IMPORTACAO
CREATE POLICY "lotes_select_authenticated" ON public.lotes_importacao
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "lotes_admin_mutation" ON public.lotes_importacao
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
