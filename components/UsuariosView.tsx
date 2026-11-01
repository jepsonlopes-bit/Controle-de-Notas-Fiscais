'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, UserCheck, UserX, Lock, Key, CheckCircle2, AlertTriangle } from 'lucide-react';
import { UserProfile, Obra, UserRole } from '@/lib/types';
import { formatarDataHoraBR } from '@/lib/formatters';

interface UsuariosViewProps {
  currentUser: UserProfile;
  obras: Obra[];
}

export function UsuariosView({ currentUser, obras }: UsuariosViewProps) {
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [cargo, setCargo] = useState('');
  const [role, setRole] = useState<UserRole>('USUARIO');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsuarios();
  }, []);

  async function fetchUsuarios() {
    setLoading(true);
    try {
      const res = await fetch('/api/usuarios');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsuarios(data.usuarios || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email,
          senha,
          cargo,
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar usuário.');

      setSuccessMsg(data.message);
      setModalOpen(false);
      setNome('');
      setEmail('');
      setSenha('');
      setCargo('');
      fetchUsuarios();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cadastrar usuário.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(user: UserProfile) {
    const novoStatus = user.status === 'ativo' ? 'bloqueado' : 'ativo';
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/usuarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          acao: 'alterar_status',
          novo_status: novoStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessMsg(data.message);
      fetchUsuarios();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao alterar status.');
    }
  }

  async function handleToggleRole(user: UserProfile) {
    const novaRole: UserRole = user.role === 'ADMINISTRADOR' ? 'USUARIO' : 'ADMINISTRADOR';
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/usuarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          acao: 'alterar_role',
          nova_role: novaRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessMsg(data.message);
      fetchUsuarios();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao alterar perfil.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Gerenciamento de Usuários e Permissões
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
              Cadastre usuários autorizados e defina privilégios. Usuários padrão possuem acesso
              restrito a consulta e cadastramento, enquanto administradores podem realizar correções,
              exclusões e gerenciar a plataforma.
            </p>
          </div>

          <button
            onClick={() => {
              setModalOpen(true);
              setErrorMsg('');
            }}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            <span>Novo Usuário</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Users table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-3.5 pl-4 pr-3">Nome / Cargo</th>
                <th className="py-3.5 px-3">E-mail</th>
                <th className="py-3.5 px-3">Perfil de Acesso</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Último Login</th>
                <th className="py-3.5 pr-4 pl-3 text-center">Ações Administrativas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Carregando usuários...
                  </td>
                </tr>
              ) : (
                usuarios.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 pl-4 pr-3 font-medium text-slate-900">
                        <div>{u.nome}</div>
                        <div className="text-[11px] text-slate-400">{u.cargo || 'Não especificado'}</div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-mono">{u.email}</td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            u.role === 'ADMINISTRADOR' ? 'text-emerald-700' : 'text-slate-700'
                          }`}
                        >
                          {u.role === 'ADMINISTRADOR' ? 'Administrador Geral' : 'Usuário Padrão'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            u.status === 'ativo' ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {u.status === 'ativo' ? 'Ativo' : 'Bloqueado'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 font-mono">
                        {formatarDataHoraBR(u.ultimo_login)}
                      </td>
                      <td className="py-3.5 pr-4 pl-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {/* Toggle role */}
                          <button
                            disabled={isCurrent}
                            onClick={() => handleToggleRole(u)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                            title="Alternar entre Administrador e Usuário"
                          >
                            Tornar {u.role === 'ADMINISTRADOR' ? 'Usuário' : 'Admin'}
                          </button>

                          {/* Toggle active / blocked */}
                          <button
                            disabled={isCurrent}
                            onClick={() => handleToggleStatus(u)}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                              u.status === 'ativo'
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {u.status === 'ativo' ? 'Bloquear' : 'Ativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Cadastrar Novo Usuário
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Preencha os dados e credenciais do novo operador do sistema.
            </p>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo Silveira"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  E-mail de Acesso <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="carlos.silveira@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Cargo / Setor
                </label>
                <input
                  type="text"
                  placeholder="Ex: Engenheiro de Obra / Comprador"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Senha Inicial <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Perfil de Permissão
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="USUARIO">Usuário Padrão (Consulta e Cadastro)</option>
                  <option value="ADMINISTRADOR">Administrador (Total Acesso e Auditoria)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Usuários padrão não podem alterar ou apagar lançamentos nem gerenciar outros usuários.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs"
                >
                  {submitting ? 'Salvando...' : 'Salvar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
