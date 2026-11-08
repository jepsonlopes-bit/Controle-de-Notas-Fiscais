'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  UserCheck,
  UserX,
  Lock,
  Key,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { UserProfile, Obra, UserRole, UserStatus } from '@/lib/types';
import { formatarDataHoraBR } from '@/lib/formatters';
import {
  getClientSnapshot,
  saveClientSnapshot,
  saveUserLocally,
  deleteUserLocally,
  syncStorageWithServer,
} from '@/lib/clientStorage';

interface UsuariosViewProps {
  currentUser: UserProfile;
  obras: Obra[];
}

export function UsuariosView({ currentUser, obras }: UsuariosViewProps) {
  // Inicializa imediatamente com a lista do armazenamento mestre local para não sumir da tela
  const [usuarios, setUsuarios] = useState<UserProfile[]>(() => {
    return typeof window !== 'undefined' ? getClientSnapshot().users : [];
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Controle de visualização da senha na tabela (por ID)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Modal de Criação de Usuário
  const [modalOpen, setModalOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [cargo, setCargo] = useState('');
  const [role, setRole] = useState<UserRole>('USUARIO');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal de Edição de Usuário
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editCargo, setEditCargo] = useState('');
  const [editSenha, setEditSenha] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('USUARIO');
  const [editStatus, setEditStatus] = useState<UserStatus>('ativo');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Modal de Exclusão de Usuário
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    fetchUsuarios();
  }, []);

  async function fetchUsuarios() {
    try {
      const res = await fetch('/api/usuarios');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Mesclagem com master store local preservando senhas locais mais recentes
      const localSnap = getClientSnapshot();
      const map = new Map<string, UserProfile>();
      localSnap.users.forEach((u) => map.set(u.id, u));
      if (Array.isArray(data.usuarios)) {
        data.usuarios.forEach((su: UserProfile) => {
          const local = map.get(su.id);
          map.set(su.id, {
            ...su,
            senha_visivel: su.senha_visivel || local?.senha_visivel || '123456',
          });
        });
      }
      const merged = Array.from(map.values());
      setUsuarios(merged);
      saveClientSnapshot({ users: merged });
    } catch {
      // Em caso de offline ou container frio, preserva os usuários locais
      const localSnap = getClientSnapshot();
      if (localSnap.users.length > 0) {
        setUsuarios(localSnap.users);
      }
    } finally {
      setLoading(false);
    }
  }

  function togglePasswordVisibility(id: string) {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const explicitUsername = username.trim() || email.split('@')[0];
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email,
          username: explicitUsername,
          senha,
          cargo,
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar usuário.');

      if (data.usuario) {
        // Grava de imediato no armazenamento mestre do cliente
        saveUserLocally({
          ...data.usuario,
          username: explicitUsername,
          senha_visivel: senha,
        });
      } else {
        saveUserLocally({
          id: `usr-${Date.now()}`,
          email,
          username: explicitUsername,
          nome,
          cargo,
          role,
          status: 'ativo',
          senha_visivel: senha,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      await syncStorageWithServer();
      setSuccessMsg(data.message || 'Usuário cadastrado com sucesso.');
      setModalOpen(false);
      setNome('');
      setEmail('');
      setUsername('');
      setSenha('');
      setCargo('');
      setShowCreatePassword(false);
      await fetchUsuarios();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cadastrar usuário.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenEdit(user: UserProfile) {
    setEditingUserId(user.id);
    setEditNome(user.nome);
    setEditEmail(user.email);
    setEditUsername(user.username || user.email.split('@')[0]);
    setEditCargo(user.cargo || '');
    setEditSenha(user.senha_visivel || '123456');
    setEditRole(user.role);
    setEditStatus(user.status);
    setShowEditPassword(false);
    setErrorMsg('');
    setEditModalOpen(true);
  }

  async function handleSaveEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUserId) return;

    setErrorMsg('');
    setSuccessMsg('');
    setEditSubmitting(true);

    try {
      const explicitEditUsername = editUsername.trim() || editEmail.split('@')[0];
      const res = await fetch('/api/usuarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUserId,
          acao: 'editar_usuario',
          nome: editNome,
          email: editEmail,
          username: explicitEditUsername,
          cargo: editCargo,
          senha: editSenha,
          role: editRole,
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar dados do usuário.');

      if (data.usuario) {
        saveUserLocally({
          ...data.usuario,
          username: explicitEditUsername,
          senha_visivel: editSenha,
        });
      } else {
        const localSnap = getClientSnapshot();
        const current = localSnap.users.find((u) => u.id === editingUserId);
        if (current) {
          saveUserLocally({
            ...current,
            nome: editNome,
            email: editEmail,
            username: explicitEditUsername,
            cargo: editCargo,
            role: editRole,
            status: editStatus,
            senha_visivel: editSenha,
          });
        }
      }

      await syncStorageWithServer();
      setSuccessMsg(data.message || 'Usuário atualizado com sucesso.');
      setEditModalOpen(false);
      await fetchUsuarios();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar usuário.');
    } finally {
      setEditSubmitting(false);
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

      if (data.usuario) {
        saveUserLocally(data.usuario);
      } else {
        saveUserLocally({ ...user, status: novoStatus });
      }

      await syncStorageWithServer();
      setSuccessMsg(data.message);
      await fetchUsuarios();
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

      if (data.usuario) {
        saveUserLocally(data.usuario);
      } else {
        saveUserLocally({ ...user, role: novaRole });
      }

      await syncStorageWithServer();
      setSuccessMsg(data.message);
      await fetchUsuarios();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao alterar perfil.');
    }
  }

  async function handleConfirmDelete() {
    if (!deletingUser) return;
    setDeleteSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/usuarios?id=${encodeURIComponent(deletingUser.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir usuário.');

      deleteUserLocally(deletingUser.id);
      await syncStorageWithServer();
      setSuccessMsg(`Usuário "${deletingUser.nome}" excluído com sucesso.`);
      setDeletingUser(null);
      await fetchUsuarios();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir usuário.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Gerenciamento de Usuários, Senhas e Permissões
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
              Consulte e edite credenciais, altere senhas com visualização em tempo real e defina perfis de acesso.
              Usuários padrão realizam consultas e lançamentos, enquanto administradores possuem controle completo.
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
                <th className="py-3.5 px-3">Usuário / E-mail</th>
                <th className="py-3.5 px-3">Senha de Acesso</th>
                <th className="py-3.5 px-3">Perfil de Acesso</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Último Login</th>
                <th className="py-3.5 pr-4 pl-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Carregando usuários...
                  </td>
                </tr>
              ) : (
                usuarios.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const isVisible = !!visiblePasswords[u.id];
                  const passwordValue = u.senha_visivel || '123456';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 pl-4 pr-3 font-medium text-slate-900">
                        <div>{u.nome}</div>
                        <div className="text-[11px] text-slate-400">{u.cargo || 'Não especificado'}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-mono text-xs font-semibold text-slate-800">
                          {u.username || u.email.split('@')[0]}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1">
                          <span className="font-mono text-xs font-semibold text-slate-800">
                            {isVisible ? passwordValue : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="text-slate-400 hover:text-slate-700 transition-colors"
                            title={isVisible ? 'Ocultar senha' : 'Ver senha'}
                          >
                            {isVisible ? (
                              <EyeOff className="h-3.5 w-3.5 text-slate-600" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
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
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Botão de Edição Completa */}
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-emerald-700"
                            title="Editar dados e senha do usuário"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Editar</span>
                          </button>

                          {/* Toggle role */}
                          <button
                            disabled={isCurrent}
                            onClick={() => handleToggleRole(u)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                            title="Alternar entre Administrador e Usuário"
                          >
                            {u.role === 'ADMINISTRADOR' ? 'Tornar Usuário' : 'Tornar Admin'}
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

                          {/* Botão de Excluir */}
                          <button
                            disabled={isCurrent}
                            onClick={() => setDeletingUser(u)}
                            className="flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-300 disabled:opacity-30 transition-colors"
                            title={isCurrent ? 'Não é possível excluir sua própria conta' : 'Excluir usuário permanentemente'}
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Excluir</span>
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

      {/* Modal: Cadastrar Novo Usuário */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Cadastrar Novo Usuário
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Defina os dados cadastrais e senha de acesso do operador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Usuário para Login
                  </label>
                  <input
                    type="text"
                    placeholder="ex: carlos.silveira"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Padrão: nome de usuário no login</p>
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
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (!username && e.target.value.includes('@')) {
                        setUsername(e.target.value.split('@')[0].toLowerCase().trim());
                      }
                    }}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
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
                <div className="relative mt-1">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 pr-10 pl-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    title={showCreatePassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showCreatePassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
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
                  Usuários padrão não podem alterar ou apagar lançamentos nem gerenciar outros operadores.
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

      {/* Modal: Editar Usuário e Senha */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Editar Usuário e Senha
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Altere nome, cargo, senha e permissões de acesso do operador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Usuário para Login <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: carlos.silveira"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().trim())}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    E-mail de Acesso <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Cargo / Setor
                </label>
                <input
                  type="text"
                  placeholder="Ex: Engenheiro de Obra"
                  value={editCargo}
                  onChange={(e) => setEditCargo(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Senha de Acesso <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Visível para o Administrador</span>
                </div>
                <div className="relative mt-1">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={editSenha}
                    onChange={(e) => setEditSenha(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 pr-10 pl-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    title={showEditPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showEditPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Perfil de Permissão
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="USUARIO">Usuário Padrão</option>
                    <option value="ADMINISTRADOR">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Status da Conta
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs"
                >
                  {editSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Exclusão de Usuário */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-900">
                  Excluir Usuário
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Tem certeza que deseja excluir o usuário <strong className="text-slate-800">{deletingUser.nome}</strong> ({deletingUser.email})?
                </p>
                <p className="mt-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5">
                  Esta ação removerá o acesso do usuário permanentemente do sistema e do armazenamento local.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={() => setDeletingUser(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleConfirmDelete}
                className="rounded-lg bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs"
              >
                {deleteSubmitting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
