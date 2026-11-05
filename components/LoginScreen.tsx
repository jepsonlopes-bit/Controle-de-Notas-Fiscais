'use client';

import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, AlertTriangle, Building2, Shield } from 'lucide-react';
import { UserProfile } from '@/lib/types';
import { getClientSnapshot } from '@/lib/clientStorage';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  onResetSetup?: () => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const snap = typeof window !== 'undefined' ? getClientSnapshot() : null;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          senha,
          clientUsers: snap ? snap.users : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Credenciais inválidas.');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao efetuar login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xl shadow-lg">
            NF
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Controle de Notas Fiscais
            </h1>
            <p className="text-xs text-slate-400">
              Gestão de Obras, Medições e Pagamentos
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-800/80 pt-6">
          <h2 className="text-sm font-semibold text-white">Acesso ao Sistema</h2>
          <p className="text-xs text-slate-400 mt-1">
            Sistema privado. Insira seu e-mail e senha corporativos autorizados.
          </p>
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-950/60 border border-rose-800 p-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300">
              E-mail Autorizado
            </label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="seu.email@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2 pr-3 pl-9 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Senha
            </label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
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
              'Autenticando...'
            ) : (
              <>
                <span>Acessar Painel</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-slate-800/60 pt-4 text-center">
          <p className="text-[11px] text-slate-500">
            Acesso restrito a usuários com permissão ativa.
            Para novos acessos, contate o administrador da empresa.
          </p>
        </div>
      </div>
    </div>
  );
}
