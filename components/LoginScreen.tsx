'use client';

import React, { useState } from 'react';
import { Lock, User, ArrowRight, AlertTriangle, Building2, Shield, Eye, EyeOff } from 'lucide-react';
import { UserProfile } from '@/lib/types';
import { getClientSnapshot } from '@/lib/clientStorage';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  onResetSetup?: () => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          usuario: usuario.trim(),
          email: usuario.trim(),
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
            <h1 className="text-xl font-bold text-white tracking-tight">
              ControlNF&apos;s
            </h1>
            <p className="text-xs text-slate-400">
              Gestão de Obras, Medições e Pagamentos
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-800/80 pt-6">
          <h2 className="text-sm font-semibold text-white">Acesso ao Sistema</h2>
          <p className="text-xs text-slate-400 mt-1">
            Insira seu usuário e senha autorizados para acessar o painel.
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
              Usuário
            </label>
            <div className="relative mt-1">
              <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="ex: jeepson.lopes"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2 pr-3 pl-9 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Exemplo: <span className="font-mono text-slate-400">jeepson.lopes</span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Senha
            </label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2 pr-10 pl-9 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                title={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
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
                <span>Acessar ControlNF&apos;s</span>
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
