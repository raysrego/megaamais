'use client';

import { useState } from 'react';
import { Settings, Bell, Palette, Shield, Database, Building, Save, Moon, Sun, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { ConfiguracaoUsuarios } from './ConfiguracaoUsuarios';
import { usePerfil } from '@/hooks/usePerfil';

export default function ConfiguracoesPage() {
    const { isAdmin } = usePerfil();
    const [loading] = useState(false);
    const [activeTab, setActiveTab] = useState('aparencia');
    const [tema, setTema] = useState<'dark' | 'light'>('dark');
    const [notificacoes, setNotificacoes] = useState(true);

    const menuItems = [
        { id: 'aparencia', label: 'Aparência', icon: Palette, masterOnly: false },
        { id: 'usuarios', label: 'Usuários', icon: Users, masterOnly: true },
        { id: 'notificacoes', label: 'Notificações', icon: Bell, masterOnly: false },
        { id: 'empresa', label: 'Grupos & Empresas', icon: Building, masterOnly: true },
        { id: 'seguranca', label: 'Segurança', icon: Shield, masterOnly: false },
        { id: 'dados', label: 'Dados', icon: Database, masterOnly: true },
    ];

    const renderPlaceholder = (title: string) => (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 2rem',
            textAlign: 'center',
            background: 'var(--bg-card)',
            borderRadius: '24px',
            border: '1px dashed var(--border)'
        }}>
            <div style={{
                width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.1))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--accent-blue)'
            }}>
                <Settings size={40} className="animate-pulse" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>{title} em Preparação</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', lineHeight: '1.6', fontSize: '0.9rem' }}>
                Estamos aprimorando esta funcionalidade para oferecer o controle definitivo da sua loteria. Em breve estará disponível nesta seção.
            </p>
        </div>
    );

    if (loading) return <LoadingState type="form" />;

    return (
        <div className="dashboard-content">
            <PageHeader title="Configurações" />

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '2rem', alignItems: 'start' }}>
                {/* Menu lateral Premium */}
                <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: '24px',
                    padding: '1.25rem',
                    border: '1px solid var(--border)',
                    boxShadow: 'none'
                }}>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {menuItems.map((item) => {
                            if (item.masterOnly && !isAdmin) return null;
                            const isActive = activeTab === item.id;
                            const Icon = item.icon;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        padding: '1.15rem 1.5rem',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        background: isActive ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'var(--bg-card-hover)',
                                        color: isActive ? '#fff' : 'var(--text-secondary)',
                                        width: '100%',
                                        textAlign: 'left',
                                        border: '1px solid ' + (isActive ? 'transparent' : 'var(--border-light)')
                                    }}
                                    className={isActive ? '' : 'sidebar-item-hover'}
                                >
                                    <Icon size={20} style={{
                                        color: isActive ? '#fff' : (item.id === 'aparencia' ? '#60a5fa' :
                                            item.id === 'usuarios' ? '#a78bfa' :
                                                item.id === 'notificacoes' ? '#fbbf24' :
                                                    item.id === 'empresa' ? '#34d399' :
                                                        item.id === 'seguranca' ? '#f87171' : '#94a3b8'),
                                        opacity: isActive ? 1 : 0.8
                                    }} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Conteúdo Central */}
                <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: '24px',
                    padding: '2rem',
                    border: '1px solid var(--border)',
                    minHeight: '500px'
                }}>
                    {activeTab === 'usuarios' && isAdmin && (
                        <ConfiguracaoUsuarios />
                    )}

                    {activeTab === 'aparencia' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Palette className="text-blue-500" size={24} /> Aparência e Experiência
                            </h3>

                            <div style={{ display: 'grid', gap: '2rem' }}>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>Tema Visual</label>
                                    <div className="flex gap-3">
                                        <button
                                            className={`btn ${tema === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setTema('dark')}
                                            style={{ flex: 1, height: '50px', borderRadius: '14px' }}
                                        >
                                            <Moon size={18} /> Escuro Deep
                                        </button>
                                        <button
                                            className={`btn ${tema === 'light' ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setTema('light')}
                                            style={{ flex: 1, height: '50px', borderRadius: '14px' }}
                                        >
                                            <Sun size={18} /> Claro Soft
                                        </button>
                                    </div>
                                </div>

                                <div style={{ padding: '1.25rem', background: 'var(--bg-card-subtle)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>Preferências Rápidas</label>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>Notificações em tempo real</p>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Receber alertas de novos bolões e vendas</p>
                                        </div>
                                        <button
                                            onClick={() => setNotificacoes(!notificacoes)}
                                            style={{
                                                width: 56,
                                                height: 28,
                                                borderRadius: 14,
                                                background: notificacoes ? 'var(--primary-blue-light)' : 'var(--border)',
                                                border: '1px solid var(--border)',
                                                cursor: 'pointer',
                                                position: 'relative',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}
                                        >
                                            <span style={{
                                                position: 'absolute',
                                                top: 4,
                                                left: notificacoes ? 32 : 4,
                                                width: 20,
                                                height: 20,
                                                borderRadius: '50%',
                                                background: 'white',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                boxShadow: 'none'
                                            }} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary" style={{ padding: '0.8rem 2.5rem', borderRadius: '12px', fontWeight: 800 }}>
                                    <Save size={18} /> Salvar Preferências
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notificacoes' && renderPlaceholder('Centro de Notificações')}
                    {activeTab === 'empresa' && (
                        <GestaoGruposEmpresas />
                    )}
                    {activeTab === 'seguranca' && renderPlaceholder('Proteção e Autenticação')}
                    {activeTab === 'dados' && isAdmin && (
                        <SaneamentoDadosFinanceiros />
                    )}
                </div>
            </div>
        </div>
    );
}

import { SaneamentoDadosFinanceiros } from '@/components/configuracoes/SaneamentoDadosFinanceiros';
import { GestaoGruposEmpresas } from '@/components/configuracoes/GestaoGruposEmpresas';

