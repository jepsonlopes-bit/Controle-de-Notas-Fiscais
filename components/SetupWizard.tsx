'use client';

import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, User, Briefcase, ArrowRight, AlertTriangle } from 'lucide-react';
import { UserProfile } from '@/lib/types';

interface SetupWizardProps {
  onSetupComplete: (user: UserProfile) => void;
}

export function SetupWizard({ onSetupComplete }: SetupWizardProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState('Gestor Financeiro / Administrador');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    if (senha.length < 6) {
      setErrorMsg('A senha deve possuir pelo menos 6 caracteres.');
      return;
    }

    if (senha !== confirmaSenha) {
      setErrorMsg('A confirmação de senha não confere.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email,
          cargo,
          senha,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao inicializar o administrador.');
      }

      onSetupComplete(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha no processo de inicialização.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xl shadow-lg">
            NF
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Inicialização Segura do Sistema
            </h1>
            <p className="text-xs text-slate-400">
              Controle de Notas Fiscais e Medições
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400 leading-relaxed">
          <p className="font-semibold text-slate-200">
            Nenhuma credencial padrão ou senha pré-programada foi exposta.
          </p>
          <p className="mt-1">
            Como primeiro passo, defina os dados do <strong>Administrador Principal</strong>.
            Esta conta terá controle integral para cadastrar obras, autorizar usuários e gerenciar permissões.
          </p>
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-950/60 border border-rose-800 p-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Nome Completo do Administrador <span className="text-emerald-400">*</span>
            </label>
            <div className="relative mt-1">
              <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                placeholder="Ex: Jepson Lopes"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2 pr-3 pl-9 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">
              E-mail Corporativo <span className="text-emerald-400">*</span>
            </label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="admin@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2 pr-3 pl-9 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Cargo / Função
            </label>
            <div className="relative mt-1">
              <Briefcase className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Ex: Diretor Financeiro / Administrador Geral"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2 pr-3 pl-9 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Senha de Acesso <span className="text-emerald-400">*</span>
            </label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2 pr-3 pl-9 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Confirmar Senha <span className="text-emerald-400">*</span>
            </label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="Repita a senha"
                value={confirmaSenha}
                onChange={(e) => setConfirmaSenha(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2 pr-3 pl-9 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-lg transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? (
              'Inicializando Sistema...'
            ) : (
              <>
                <span>Criar Administrador e Iniciar</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
