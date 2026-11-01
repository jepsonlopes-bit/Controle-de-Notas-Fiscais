'use client';

import React, { useState } from 'react';
import { X, Database, Shield, Key, Check, Copy, ExternalLink, Terminal } from 'lucide-react';

interface SupabaseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupabaseGuideModal({ isOpen, onClose }: SupabaseGuideModalProps) {
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  if (!isOpen) return null;

  const envSample = `# Configuração de Conexão com o Supabase (PostgreSQL + Auth + RLS)
NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-chave-anonima-publica"
SUPABASE_SERVICE_ROLE_KEY="sua-chave-privada-service-role"
`;

  function handleCopy(text: string, type: 'env' | 'path') {
    navigator.clipboard.writeText(text);
    if (type === 'env') {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    } else {
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-xs">
      <div className="relative my-8 w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Guia de Conexão com Supabase & RLS
              </h3>
              <p className="text-xs text-slate-500">
                Instruções passo a passo para conectar o banco PostgreSQL em nuvem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-5 text-xs text-slate-700 leading-relaxed">
          {/* Step 1 */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white text-[11px]">
                1
              </span>
              <span>Criar Projeto no Supabase</span>
            </h4>
            <p className="mt-1 text-slate-600">
              Acesse{' '}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-emerald-600 underline inline-flex items-center gap-0.5"
              >
                supabase.com <ExternalLink className="h-3 w-3" />
              </a>{' '}
              e crie uma nova organização e projeto (região recomendada: <em>São Paulo (sa-east-1)</em>).
            </p>
          </div>

          {/* Step 2 */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white text-[11px]">
                2
              </span>
              <span>Executar o Esquema SQL & Políticas de Segurança (RLS)</span>
            </h4>
            <p className="mt-1 text-slate-600">
              O script completo de banco de dados com todas as tabelas (<code>obras</code>,{' '}
              <code>lancamentos</code>, <code>profiles</code>, <code>audit_logs</code> e{' '}
              <code>lotes_importacao</code>) e suas políticas de privilégios mínimos (RLS) já foi
              gerado e está salvo em:
            </p>
            <div className="mt-2 flex items-center justify-between rounded bg-slate-900 px-3 py-2 text-slate-100 font-mono text-[11px]">
              <span>/supabase/schema.sql</span>
              <button
                onClick={() => handleCopy('/supabase/schema.sql', 'path')}
                className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300 hover:text-white"
              >
                {copiedPath ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedPath ? 'Copiado' : 'Copiar Caminho'}</span>
              </button>
            </div>
            <p className="mt-2 text-slate-500">
              No painel do Supabase, vá em <strong>SQL Editor</strong> &gt; cole o conteúdo de{' '}
              <code>/supabase/schema.sql</code> &gt; clique em <strong>Run</strong>.
            </p>
          </div>

          {/* Step 3 */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white text-[11px]">
                3
              </span>
              <span>Configurar as Variáveis Secretas de Ambiente (.env)</span>
            </h4>
            <p className="mt-1 text-slate-600">
              No painel do Supabase, em <strong>Project Settings</strong> &gt; <strong>API</strong>, copie as chaves e insira no arquivo <code>.env</code>:
            </p>
            <div className="relative mt-2">
              <pre className="rounded bg-slate-900 p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                {envSample}
              </pre>
              <button
                onClick={() => handleCopy(envSample, 'env')}
                className="absolute top-2 right-2 flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white"
              >
                {copiedEnv ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedEnv ? 'Copiado!' : 'Copiar Variáveis'}</span>
              </button>
            </div>
          </div>

          {/* Security Guarantee */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-emerald-950">
            <div className="flex items-center gap-2 font-semibold">
              <Shield className="h-4 w-4 text-emerald-600" />
              <span>Garantia de Não-Simulação e Privilégios Mínimos</span>
            </div>
            <p className="mt-1 text-emerald-900">
              A aplicação atual opera com persistência transacional server-side segura e criptografia PBKDF2
              com Salt por usuário. Ao conectar suas credenciais do Supabase, a aplicação passa a utilizar
              as tabelas do PostgreSQL e a autorização de RLS automaticamente sem necessidade de alteração de regras de negócio.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-200 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
