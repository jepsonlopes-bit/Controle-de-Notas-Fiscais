'use client';

import React from 'react';
import { Menu, Plus, Building2, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Obra, UserProfile } from '@/lib/types';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  obras: Obra[];
  selectedObraId: string;
  onSelectObra: (id: string) => void;
  onOpenNovoLancamento: () => void;
  currentUser: UserProfile;
  pageTitle: string;
  isSidebarCollapsed?: boolean;
  onToggleCollapseSidebar?: () => void;
}

export function Header({
  onOpenMobileSidebar,
  obras,
  selectedObraId,
  onSelectObra,
  onOpenNovoLancamento,
  pageTitle,
  isSidebarCollapsed = false,
  onToggleCollapseSidebar,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      {/* Zone 1: Mobile toggle, Desktop Sidebar Collapse & Breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenMobileSidebar}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop Sidebar Collapse / Expand Button */}
        {onToggleCollapseSidebar && (
          <button
            onClick={onToggleCollapseSidebar}
            className="hidden lg:flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-label={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-5 w-5 text-emerald-600" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs font-medium uppercase tracking-wider text-slate-400">
            Controle Financeiro
          </span>
          <span className="hidden sm:inline text-slate-300">/</span>
          <h1 className="text-base font-semibold text-slate-900">{pageTitle}</h1>
        </div>
      </div>

      {/* Zone 2: Global Obra Selector */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center">
          <div className="pointer-events-none absolute left-3 flex items-center text-slate-400">
            <Building2 className="h-4 w-4" />
          </div>
          <select
            value={selectedObraId}
            onChange={(e) => onSelectObra(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-8 pl-9 text-xs font-medium text-slate-800 transition-colors hover:bg-white focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none sm:text-sm"
          >
            <option value="todas">Todas as Obras (Visão Consolidada)</option>
            {obras.map((obra) => (
              <option key={obra.id} value={obra.id}>
                {obra.codigo} - {obra.nome} {obra.status === 'inativo' ? '(Inativa)' : ''}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 flex items-center text-slate-400">
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Zone 3: Quick primary CTA */}
        <button
          onClick={onOpenNovoLancamento}
          className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 sm:text-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Lançamento</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>
    </header>
  );
}
