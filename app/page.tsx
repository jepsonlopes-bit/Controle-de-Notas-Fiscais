'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { DashboardView } from '@/components/DashboardView';
import { LancamentosView } from '@/components/LancamentosView';
import { LancamentoModal } from '@/components/LancamentoModal';
import { ImportarPlanilhaView } from '@/components/ImportarPlanilhaView';
import { ObrasView } from '@/components/ObrasView';
import { UsuariosView } from '@/components/UsuariosView';
import { AuditoriaView } from '@/components/AuditoriaView';
import { SupabaseGuideModal } from '@/components/SupabaseGuideModal';
import { SetupWizard } from '@/components/SetupWizard';
import { LoginScreen } from '@/components/LoginScreen';
import { UserProfile, Obra, Lancamento, DashboardMetrics } from '@/lib/types';

const DEFAULT_ADMIN: UserProfile = {
  id: 'usr-788f5c46-337e-484e-b359-4d9fe2cf900c',
  email: 'jepson.lopes@gmail.com',
  nome: 'Jepson Lopes',
  cargo: 'Diretor / Administrador Geral',
  role: 'ADMINISTRADOR',
  status: 'ativo',
  obras_permitidas: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export default function Home() {
  const [authStatus, setAuthStatus] = useState<
    'loading' | 'uninitialized' | 'unauthenticated' | 'authenticated'
  >('authenticated');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(DEFAULT_ADMIN);

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSupabaseGuideOpen, setIsSupabaseGuideOpen] = useState(false);

  // Obras
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string>('todas');

  // Dashboard Metrics
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Lancamentos Consultation State
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [totalLancamentos, setTotalLancamentos] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(15);
  const [somaBruto, setSomaBruto] = useState(0);
  const [somaLiquido, setSomaLiquido] = useState(0);
  const [loadingLancamentos, setLoadingLancamentos] = useState(false);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('todas');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [dataLancInicio, setDataLancInicio] = useState('');
  const [dataLancFim, setDataLancFim] = useState('');
  const [dataPagInicio, setDataPagInicio] = useState('');
  const [dataPagFim, setDataPagFim] = useState('');
  const [sortBy, setSortBy] = useState('data_lancamento');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal State
  const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);
  const [selectedLancamento, setSelectedLancamento] = useState<Lancamento | null>(null);
  const [isReadOnlyLancamento, setIsReadOnlyLancamento] = useState(false);

  // Collapsible Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved === 'true') {
        setIsSidebarCollapsed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggleCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Check auth and setup state
  const checkInitialState = useCallback(async () => {
    try {
      const resMe = await fetch('/api/auth/me');
      if (resMe.ok) {
        const dataMe = await resMe.json();
        if (dataMe.user) {
          setCurrentUser(dataMe.user);
        }
      }
    } catch {
      // mantém o default admin
    }
  }, []);

  useEffect(() => {
    checkInitialState();
  }, [checkInitialState]);

  // Load Obras
  const fetchObras = useCallback(async () => {
    try {
      const res = await fetch('/api/obras?include_inactive=true');
      if (res.ok) {
        const data = await res.json();
        setObras(data.obras || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load Dashboard Metrics
  const fetchMetrics = useCallback(async (obraId: string) => {
    try {
      const url =
        obraId && obraId !== 'todas'
          ? `/api/dashboard?obra_id=${obraId}`
          : '/api/dashboard';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  // Load Lancamentos
  const fetchLancamentos = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (selectedObraId && selectedObraId !== 'todas') {
        params.append('obra_id', selectedObraId);
      }
      if (searchTerm.trim()) params.append('busca', searchTerm.trim());
      if (filterCategoria !== 'todas') params.append('categoria', filterCategoria);
      if (filterStatus !== 'todos') params.append('status_pagamento', filterStatus);
      if (dataLancInicio) params.append('data_lancamento_inicio', dataLancInicio);
      if (dataLancFim) params.append('data_lancamento_fim', dataLancFim);
      if (dataPagInicio) params.append('data_pagamento_inicio', dataPagInicio);
      if (dataPagFim) params.append('data_pagamento_fim', dataPagFim);

      params.append('_t', String(Date.now()));

      const res = await fetch(`/api/lancamentos?${params.toString()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setLancamentos(data.data || []);
        setTotalLancamentos(data.total || 0);
        setTotalPages(data.total_paginas || 1);
        setSomaBruto(data.soma_valor_bruto || 0);
        setSomaLiquido(data.soma_valor_liquido || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoadingLancamentos(false);
    }
  }, [
    page,
    limit,
    sortBy,
    sortOrder,
    selectedObraId,
    searchTerm,
    filterCategoria,
    filterStatus,
    dataLancInicio,
    dataLancFim,
    dataPagInicio,
    dataPagFim,
  ]);

  // Trigger loads when authenticated
  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchObras();
    }
  }, [authStatus, fetchObras]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchMetrics(selectedObraId);
      fetchLancamentos();
    }
  }, [authStatus, selectedObraId, fetchMetrics, fetchLancamentos]);

  // Handlers
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setAuthStatus('unauthenticated');
  }

  function handleResetFilters() {
    setSearchTerm('');
    setFilterCategoria('todas');
    setFilterStatus('todos');
    setDataLancInicio('');
    setDataLancFim('');
    setDataPagInicio('');
    setDataPagFim('');
    setPage(1);
  }

  function handleSortChange(column: string) {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  }

  async function handleDeleteLancamento(id: string) {
    // Atualização otimista imediata na interface
    setLancamentos((prev) => prev.filter((item) => item.id !== id));
    setTotalLancamentos((prev) => Math.max(0, prev - 1));

    try {
      const res = await fetch(`/api/lancamentos?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || 'Erro ao excluir o lançamento no servidor.');
        fetchLancamentos();
        fetchMetrics(selectedObraId);
        return;
      }

      await fetchLancamentos();
      await fetchMetrics(selectedObraId);
    } catch (err: any) {
      alert('Falha na conexão ao excluir lançamento: ' + err.message);
      fetchLancamentos();
    }
  }

  // Loading Screen
  if (authStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-xs font-medium text-slate-300">
            Carregando Controle de Lançamentos...
          </p>
        </div>
      </div>
    );
  }

  // Initial Setup Wizard if no admin exists
  if (authStatus === 'uninitialized') {
    return (
      <SetupWizard
        onSetupComplete={(admin) => {
          setCurrentUser(admin);
          setAuthStatus('authenticated');
        }}
      />
    );
  }

  // Login Screen if not authenticated
  if (authStatus === 'unauthenticated' || !currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setAuthStatus('authenticated');
        }}
      />
    );
  }

  const selectedObra = obras.find((o) => o.id === selectedObraId);

  const pageTitles: Record<string, string> = {
    dashboard: 'Painel Geral',
    lancamentos: 'Lançamentos',
    importar: 'Importar Planilha Matriz',
    obras: 'Gestão de Obras',
    usuarios: 'Usuários & Permissões',
    auditoria: 'Trilha de Auditoria',
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        currentUser={currentUser}
        onLogout={handleLogout}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenSupabaseGuide={() => setIsSupabaseGuideOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Main Workspace */}
      <div
        className={`flex min-h-screen flex-col transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'
        }`}
      >
        {/* Top Header */}
        <Header
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          obras={obras}
          selectedObraId={selectedObraId}
          onSelectObra={(id) => {
            setSelectedObraId(id);
            setPage(1);
          }}
          onOpenNovoLancamento={() => {
            setSelectedLancamento(null);
            setIsReadOnlyLancamento(false);
            setIsLancamentoModalOpen(true);
          }}
          currentUser={currentUser}
          pageTitle={pageTitles[currentTab] || 'Painel'}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleCollapseSidebar={handleToggleCollapse}
        />

        {/* Content Viewport */}
        <main
          className={`flex-1 p-4 sm:p-6 lg:p-8 w-full mx-auto transition-all duration-300 ${
            isSidebarCollapsed ? 'max-w-[1700px]' : 'max-w-7xl'
          }`}
        >
          {currentTab === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              loading={loadingMetrics}
              selectedObra={selectedObra}
              onNavigateLancamentos={() => setCurrentTab('lancamentos')}
              onOpenNovoLancamento={() => {
                setSelectedLancamento(null);
                setIsReadOnlyLancamento(false);
                setIsLancamentoModalOpen(true);
              }}
            />
          )}

          {currentTab === 'lancamentos' && (
            <LancamentosView
              lancamentos={lancamentos}
              total={totalLancamentos}
              page={page}
              totalPages={totalPages}
              limit={limit}
              somaBruto={somaBruto}
              somaLiquido={somaLiquido}
              loading={loadingLancamentos}
              obras={obras}
              selectedObraId={selectedObraId}
              onSelectObra={setSelectedObraId}
              currentUser={currentUser}
              searchTerm={searchTerm}
              onSearchChange={(val) => {
                setSearchTerm(val);
                setPage(1);
              }}
              filterCategoria={filterCategoria}
              onFilterCategoriaChange={(val) => {
                setFilterCategoria(val);
                setPage(1);
              }}
              filterStatus={filterStatus}
              onFilterStatusChange={(val) => {
                setFilterStatus(val);
                setPage(1);
              }}
              dataLancInicio={dataLancInicio}
              onDataLancInicioChange={(val) => {
                setDataLancInicio(val);
                setPage(1);
              }}
              dataLancFim={dataLancFim}
              onDataLancFimChange={(val) => {
                setDataLancFim(val);
                setPage(1);
              }}
              dataPagInicio={dataPagInicio}
              onDataPagInicioChange={(val) => {
                setDataPagInicio(val);
                setPage(1);
              }}
              dataPagFim={dataPagFim}
              onDataPagFimChange={(val) => {
                setDataPagFim(val);
                setPage(1);
              }}
              onPageChange={(p) => setPage(p)}
              onLimitChange={(l) => {
                setLimit(l);
                setPage(1);
              }}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              onOpenNovoLancamento={() => {
                setSelectedLancamento(null);
                setIsReadOnlyLancamento(false);
                setIsLancamentoModalOpen(true);
              }}
              onEditLancamento={(l) => {
                setSelectedLancamento(l);
                setIsReadOnlyLancamento(false);
                setIsLancamentoModalOpen(true);
              }}
              onViewLancamento={(l) => {
                setSelectedLancamento(l);
                setIsReadOnlyLancamento(true);
                setIsLancamentoModalOpen(true);
              }}
              onDeleteLancamento={handleDeleteLancamento}
              onResetFilters={handleResetFilters}
            />
          )}

          {currentTab === 'importar' && (
            <ImportarPlanilhaView
              obras={obras}
              currentUser={currentUser}
              onSuccessImport={() => {
                fetchLancamentos();
                fetchMetrics(selectedObraId);
              }}
            />
          )}

          {currentTab === 'obras' && (
            <ObrasView
              obras={obras}
              currentUser={currentUser}
              onRefresh={() => {
                fetchObras();
                fetchMetrics(selectedObraId);
              }}
            />
          )}

          {currentTab === 'usuarios' && currentUser.role === 'ADMINISTRADOR' && (
            <UsuariosView currentUser={currentUser} obras={obras} />
          )}

          {currentTab === 'auditoria' && currentUser.role === 'ADMINISTRADOR' && (
            <AuditoriaView currentUser={currentUser} />
          )}
        </main>
      </div>

      {/* Entry Modal (Create / Edit / View) */}
      <LancamentoModal
        isOpen={isLancamentoModalOpen}
        onClose={() => setIsLancamentoModalOpen(false)}
        onSuccess={() => {
          fetchLancamentos();
          fetchMetrics(selectedObraId);
        }}
        lancamento={selectedLancamento}
        obras={obras}
        defaultObraId={selectedObraId}
        currentUser={currentUser}
        isReadOnly={isReadOnlyLancamento}
      />

      {/* Supabase Integration Guide Modal */}
      <SupabaseGuideModal
        isOpen={isSupabaseGuideOpen}
        onClose={() => setIsSupabaseGuideOpen(false)}
      />
    </div>
  );
}
