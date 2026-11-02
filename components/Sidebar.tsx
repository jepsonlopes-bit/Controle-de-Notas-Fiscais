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
  PanelLeftClose,
  PanelLeftOpen,
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  currentUser,
  onLogout,
  isOpenMobile,
  onCloseMobile,
  onOpenSupabaseGuide,
  isCollapsed = false,
  onToggleCollapse,
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
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-100 transition-all duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-72'}`}
      >
        {/* Brand Header */}
        <div
          className={`flex h-16 items-center border-b border-slate-800 transition-all ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-5'
          }`}
        >
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={onToggleCollapse}
                className="group flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-sm hover:bg-emerald-500 transition-colors"
                title="Expandir menu lateral"
              >
                NF
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-base shadow-sm">
                  NF
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm font-semibold tracking-tight text-white leading-tight">
                    Controle de NFs
                  </span>
                  <span className="truncate text-xs text-slate-400">e Medições de Obras</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Desktop Collapse Button */}
                <button
                  onClick={onToggleCollapse}
                  className="hidden rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors lg:flex"
                  title="Recolher menu lateral"
                  aria-label="Recolher menu lateral"
                >
                  <PanelLeftClose className="h-5 w-5" />
                </button>

                {/* Mobile Close Button */}
                <button
                  onClick={onCloseMobile}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
                  aria-label="Fechar menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Current User Card */}
        <div className={`border-b border-slate-800 transition-all ${isCollapsed ? 'p-2' : 'p-4'}`}>
          {isCollapsed ? (
            <div
              className="flex justify-center"
              title={`${currentUser.nome} (${isAdmin ? 'Administrador' : 'Usuário Padrão'})`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-emerald-400 ring-2 ring-slate-700 uppercase">
                {currentUser.nome.charAt(0)}
              </div>
            </div>
          ) : (
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
          )}
        </div>

        {/* Navigation Items */}
        <nav
          className={`flex-1 space-y-1.5 overflow-y-auto transition-all ${
            isCollapsed ? 'p-2' : 'p-4'
          }`}
        >
          {!isCollapsed && (
            <div className="px-2 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Menu Principal
            </div>
          )}

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
                title={item.label}
                className={`group flex items-center rounded-lg transition-colors ${
                  isCollapsed
                    ? 'w-full justify-center p-3'
                    : 'w-full justify-between px-3 py-2.5 text-sm font-medium'
                } ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-white' : 'text-slate-400 group-hover:text-white'
                    }`}
                  />
                  {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </div>
                {!isCollapsed && active && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-white" />
                )}
              </button>
            );
          })}

          {/* Database Integration Guide Link */}
          <div className="pt-4">
            {!isCollapsed && (
              <div className="px-2 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                Integração Cloud
              </div>
            )}
            <button
              onClick={() => {
                onOpenSupabaseGuide();
                onCloseMobile();
              }}
              title="Conectar Supabase (Guia RLS & Migração SQL)"
              className={`group flex items-center rounded-lg border border-slate-700/80 bg-slate-800/40 text-xs font-medium text-slate-300 hover:border-emerald-500/50 hover:bg-slate-800 hover:text-white transition-colors ${
                isCollapsed ? 'w-full justify-center p-3' : 'w-full gap-3 px-3 py-2'
              }`}
            >
              <Database className="h-4 w-4 shrink-0 text-emerald-400" />
              {!isCollapsed && (
                <div className="text-left">
                  <p className="font-semibold text-slate-200">Conectar Supabase</p>
                  <p className="text-[10px] text-slate-400">Guia RLS & Migração SQL</p>
                </div>
              )}
            </button>
          </div>
        </nav>

        {/* Footer with Toggle and Logout */}
        <div className={`border-t border-slate-800 space-y-1.5 transition-all ${isCollapsed ? 'p-2' : 'p-4'}`}>
          {/* Quick Toggle in Footer for Desktop */}
          <button
            onClick={onToggleCollapse}
            className={`hidden lg:flex w-full items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white ${
              isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2 text-xs font-medium'
            }`}
            title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span>Recolher Menu Lateral</span>
              </>
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Sair do Sistema"
            className={`flex w-full items-center rounded-lg transition-colors hover:bg-rose-950/40 hover:text-rose-400 ${
              isCollapsed
                ? 'justify-center p-2.5 text-slate-400'
                : 'gap-3 px-3 py-2.5 text-sm font-medium text-slate-300'
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Sair do Sistema</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
