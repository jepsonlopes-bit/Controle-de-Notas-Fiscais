'use client';

import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Building2,
  Upload,
  Users,
  ShieldCheck,
  Database,
  LogOut,
  ChevronRight,
  X,
} from 'lucide-react';
import { UserProfile } from '@/lib/types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentUser: UserProfile;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenSupabaseGuide: () => void;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  currentUser,
  onLogout,
  isOpenMobile,
  onCloseMobile,
  onOpenSupabaseGuide,
}: SidebarProps) {
  const isAdmin = currentUser.role === 'ADMINISTRADOR';

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Painel Geral',
      icon: LayoutDashboard,
      adminOnly: false,
    },
    {
      id: 'lancamentos',
      label: 'Lançamentos',
      icon: FileSpreadsheet,
      adminOnly: false,
    },
    {
      id: 'importar',
      label: 'Importar Planilha',
      icon: Upload,
      adminOnly: false,
    },
    {
      id: 'obras',
      label: 'Gestão de Obras',
      icon: Building2,
      adminOnly: false,
    },
    {
      id: 'usuarios',
      label: 'Usuários & Acessos',
      icon: Users,
      adminOnly: true,
    },
    {
      id: 'auditoria',
      label: 'Trilha de Auditoria',
      icon: ShieldCheck,
      adminOnly: true,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col bg-slate-900 text-slate-100 transition-transform duration-200 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-lg shadow-sm">
              NF
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-white leading-tight">
                Controle de NFs
              </span>
              <span className="text-xs text-slate-400">e Medições de Obras</span>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current User Card */}
        <div className="border-b border-slate-800 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-slate-800/60 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white uppercase">
              {currentUser.nome.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{currentUser.nome}</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span
                  className={
                    isAdmin ? 'font-medium text-emerald-400' : 'text-slate-300'
                  }
                >
                  {isAdmin ? 'Administrador' : 'Usuário Padrão'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
          <div className="px-2 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Menu Principal
          </div>
          {menuItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const active = currentTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-white' : 'text-slate-400 group-hover:text-white'
                    }`}
                  />
                  <span className="whitespace-nowrap">{item.label}</span>
                </div>
                {active && <ChevronRight className="h-4 w-4 shrink-0 text-white" />}
              </button>
            );
          })}

          {/* Database Integration Guide Link */}
          <div className="pt-4">
            <div className="px-2 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Integração Cloud
            </div>
            <button
              onClick={() => {
                onOpenSupabaseGuide();
                onCloseMobile();
              }}
              className="group flex w-full items-center gap-3 rounded-lg border border-slate-700/80 bg-slate-800/40 px-3 py-2 text-xs font-medium text-slate-300 hover:border-emerald-500/50 hover:bg-slate-800 hover:text-white"
            >
              <Database className="h-4 w-4 shrink-0 text-emerald-400" />
              <div className="text-left">
                <p className="font-semibold text-slate-200">Conectar Supabase</p>
                <p className="text-[10px] text-slate-400">Guia RLS & Migração SQL</p>
              </div>
            </button>
          </div>
        </nav>

        {/* Footer with Logout */}
        <div className="border-t border-slate-800 p-4">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-rose-950/40 hover:text-rose-400"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>
    </>
  );
}
