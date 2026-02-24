'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import {
    LayoutDashboard,
    Ticket,
    Calendar,
    BarChart4,
    Scale,
    Users,
    UserCog,
    DollarSign,
    ShieldCheck,
    FolderCog,
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    Bell,
    Settings,
    Sun,
    Moon,
    LogOut,
    Tag,
    Building2,
    Monitor,
    Package,
    Wallet,
    FileText,
    Home
} from 'lucide-react';
import { logout } from '@/app/login/actions';
import { clearBrowserSupabaseClient } from '@/lib/supabase-browser';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePerfil } from '@/hooks/usePerfil';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotificacoes } from '@/hooks/useNotificacoes';
import { NotificationDropdown } from '@/components/NotificationDropdown';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [cadastrosExpanded, setCadastrosExpanded] = useState(false);
    const { isDarkMode, toggleTheme } = useTheme();
    const pathname = usePathname();
    const { perfil, loading } = usePerfil();
    const { naoLidas } = useNotificacoes();

    // Definição de Permissões por Item
    const allMenuItems = [
        { href: '/inicio', label: 'Início', icon: <Home size={20} />, roles: ['all'] },
        { href: '/', label: 'Painel Estratégico', icon: <LayoutDashboard size={20} />, roles: ['admin'] },
        { href: '/boloes', label: 'Bolões & Loterias', icon: <Ticket size={20} />, roles: ['all'] },
        { href: '/calendario', label: 'Sorteios', icon: <Calendar size={20} />, roles: ['all'] },

        { href: '/conciliacao', label: 'Conciliação Bancária', icon: <Scale size={20} />, roles: ['admin', 'gerente'] },
        { href: '/caixa', label: 'Gestão de Caixa', icon: <Wallet size={20} />, roles: ['all'] },
        { href: '/relatorios', label: 'BI & Relatórios', icon: <FileText size={20} />, roles: ['admin', 'gerente'] },
        { href: '/operador', label: 'Painel do Operador', icon: <UserCog size={20} />, roles: ['all'] },
        { href: '/financeiro', label: 'Financeiro', icon: <DollarSign size={20} />, roles: ['admin', 'gerente'] },
        { href: '/cofre', label: 'Gestão de Cofre', icon: <ShieldCheck size={20} />, roles: ['admin', 'gerente'] },
    ];

    const allCadastrosSubItems = [
        { href: '/cadastros/categorias', label: 'Categorias', icon: <Tag size={18} />, roles: ['admin', 'gerente'] },
        { href: '/cadastros/contas', label: 'Contas Bancárias', icon: <Building2 size={18} />, roles: ['admin', 'gerente'] },
        { href: '/cadastros/jogos', label: 'Jogos', icon: <Ticket size={18} />, roles: ['admin', 'gerente'] },
        { href: '/cadastros/terminais', label: 'Terminais TFL', icon: <Monitor size={18} />, roles: ['admin', 'gerente'] },
        { href: '/cadastros/produtos', label: 'Produtos', icon: <Package size={18} />, roles: ['admin', 'gerente'] },
    ];

    // Filtragem Baseada na Role
    const userRole = perfil?.role || 'operador';

    const menuItems = allMenuItems.filter(item => {
        // [AJUSTE] Não esconder tudo enquanto carrega, apenas o que for restrito
        if (item.roles.includes('all')) return true;
        if (loading) return false; // Esconde apenas itens restritos durante o load
        return item.roles.includes(userRole);
    });

    const cadastrosSubItems = allCadastrosSubItems.filter(item => {
        if (item.roles.includes('all')) return true;
        if (loading) return false;
        return item.roles.includes(userRole);
    });

    const showCadastros = cadastrosSubItems.length > 0;

    return (
        <div className="app-container">
            <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <button
                    className="sidebar-toggle"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    title={sidebarCollapsed ? "Expandir" : "Recolher"}
                >
                    {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                {/* SESSÃO 1: LOGOMARCA */}
                <div className="sidebar-logo">
                    <div className="logo-icon">M</div>
                    {!sidebarCollapsed && <h1>MegaMais</h1>}
                </div>

                {/* SESSÃO 2: MÓDULOS (Flexível) */}
                {/* WRAPPER DE ROLAGEM UNIFICADA: MÓDULOS + FEATURES */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col">
                    <nav className="mb-2">
                        <ul className="nav-menu">
                            {menuItems.map((item) => (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                                    >
                                        {item.icon}
                                        <span className="truncate">{item.label}</span>
                                    </Link>
                                </li>
                            ))}

                            {showCadastros && (
                                <li>
                                    <div
                                        className={`nav-item ${cadastrosExpanded ? 'expanded' : ''}`}
                                        onClick={() => !sidebarCollapsed && setCadastrosExpanded(!cadastrosExpanded)}
                                    >
                                        <FolderCog size={20} />
                                        <span className="truncate flex-1">Cadastros</span>
                                        {!sidebarCollapsed && (
                                            cadastrosExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                                        )}
                                    </div>

                                    {cadastrosExpanded && !sidebarCollapsed && (
                                        <ul className="pl-6 list-none">
                                            {cadastrosSubItems.map((sub) => (
                                                <li key={sub.href}>
                                                    <Link
                                                        href={sub.href}
                                                        className={`nav-item ${pathname === sub.href ? 'active' : ''}`}
                                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
                                                    >
                                                        {sub.icon}
                                                        <span className="truncate">{sub.label}</span>
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            )}
                        </ul>
                    </nav>

                    {/* SESSÃO 3: NOTIFICAÇÕES (Pop-up), CONFIG, DARKMODE (Dentro do Scroll) */}
                    <div className="border-t border-border pt-2 mb-2 mt-auto">
                        <NotificationDropdown isCollapsed={sidebarCollapsed} />
                        <Link href="/configuracoes" className={`nav-item ${pathname === '/configuracoes' ? 'active' : ''}`}>
                            <Settings size={20} />
                            <span className="truncate">Configurações</span>
                        </Link>
                        <div className="nav-item" onClick={toggleTheme}>
                            {!isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                            <span className="truncate">{!isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
                        </div>
                    </div>
                </div>

                {/* SESSÃO 4: USUÁRIO E SAIR */}
                {/* SESSÃO 4: USUÁRIO E SAIR (Unificado) */}
                <div className="border-t border-border pt-2 shrink-0">
                    <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between px-2'} h-12`}>
                        {!loading && perfil && (
                            <div className={`flex items-center gap-2 overflow-hidden ${sidebarCollapsed ? 'justify-center' : ''}`}>
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    background: 'var(--gradient-primary)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 700,
                                    flexShrink: 0,
                                    fontSize: '0.75rem',
                                }}>
                                    {perfil.nome ? perfil.nome.charAt(0).toUpperCase() : 'U'}
                                </div>
                                {!sidebarCollapsed && (
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[0.8rem] font-bold text-text-primary leading-tight truncate">
                                            {perfil.nome || 'Usuário'}
                                        </span>
                                        <span className="text-[0.65rem] text-text-muted capitalize leading-tight">
                                            {perfil.role}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {!sidebarCollapsed && (
                            <>
                                <div className="h-6 w-px bg-border mx-2 shrink-0" />
                                <button
                                    className={`flex items-center justify-center gap-1.5 text-danger hover:bg-danger/10 transition-colors p-1.5 rounded-lg shrink-0`}
                                    onClick={async () => {
                                        localStorage.clear();
                                        sessionStorage.clear();
                                        await logout();
                                        clearBrowserSupabaseClient();
                                        // Forçar recarga total e burlar cache com timestamp
                                        window.location.href = '/login?v=' + Date.now();
                                    }}
                                    title="Sair"
                                >
                                    <LogOut size={16} />
                                    <span className="text-[0.7rem] font-bold">Sair</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </aside>
            <main className="main-content custom-scrollbar">
                {children}
            </main>
        </div>
    );
}

