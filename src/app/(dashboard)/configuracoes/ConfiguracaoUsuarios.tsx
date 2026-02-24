'use client';

import { useState, useEffect } from 'react';
import {
    Users,
    Plus,
    Shield,
    UserCog,
    Loader2,
    Lock,
    Store,
    Power,
    Edit2
} from 'lucide-react';
import { usePerfil } from '@/hooks/usePerfil';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { createNewUser, updateUserAdmin, toggleUserStatus } from '@/actions/admin';
import { getUsersAction } from '@/hooks/actions';
import { useLoja } from '@/contexts/LojaContext';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';

// Componente de Modal para Adição/Edição
function ModalUserForm({
    user,
    onClose,
    onSuccess,
    lojas
}: {
    user?: any,
    onClose: () => void,
    onSuccess: () => void,
    lojas: any[]
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [role, setRole] = useState(user?.role || 'operador');

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        setError(null);

        try {
            if (user) {
                // Modo Edição
                const nome = formData.get('nome') as string;
                const newRole = formData.get('role') as string;
                const loja_id = formData.get('loja_id') as string;
                const password = formData.get('password') as string;

                const res = await updateUserAdmin(user.id, {
                    nome,
                    role: newRole,
                    loja_id: (newRole === 'admin') ? null : (loja_id || null),
                    password: password || undefined
                });

                if (res.error) setError(res.error);
                else onSuccess();
            } else {
                // Modo Criação
                const res = await createNewUser(null, formData);
                if (res.error) setError(res.error);
                else onSuccess();
            }
        } catch (err) {
            setError('Erro inesperado.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            padding: '1rem'
        }}>
            <div style={{
                background: 'var(--bg-dark)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '400px',
                padding: '1.75rem',
                boxShadow: 'none',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background Glow */}
                <div style={{
                    position: 'absolute',
                    top: '-60px',
                    right: '-60px',
                    width: '120px',
                    height: '120px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    filter: 'blur(40px)',
                    borderRadius: '50%',
                    pointerEvents: 'none'
                }} />

                <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.025em'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary-blue-light)'
                    }}>
                        <UserCog size={20} />
                    </div>
                    {user ? 'Editar Perfil' : 'Novo Membro'}
                </h3>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: 'var(--danger)',
                        padding: '0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'start',
                        gap: '0.5rem'
                    }}>
                        <Lock size={16} style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 700 }}>{error}</span>
                    </div>
                )}

                <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', zIndex: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem', display: 'block', letterSpacing: '0.1em', marginLeft: '0.25rem' }}>Nome Completo</label>
                        <input name="nome" defaultValue={user?.nome} required className="input" style={{ padding: '1rem', borderRadius: '16px', fontWeight: 700 }} placeholder="Ex: João da Silva" />
                    </div>

                    {!user && (
                        <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem', display: 'block', letterSpacing: '0.1em', marginLeft: '0.25rem' }}>Email de Acesso</label>
                            <input name="email" type="email" required className="input" style={{ padding: '1rem', borderRadius: '16px', fontWeight: 700 }} placeholder="email@exemplo.com" />
                        </div>
                    )}

                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem', display: 'block', letterSpacing: '0.1em', marginLeft: '0.25rem' }}>
                            {user ? 'Redefinir Senha (opcional)' : 'Senha de Acesso'}
                        </label>
                        <input name="password" type="password" required={!user} minLength={6} className="input" style={{ padding: '1rem', borderRadius: '16px', fontWeight: 700 }} placeholder="******" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                            <label style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem', display: 'block', letterSpacing: '0.1em', marginLeft: '0.25rem' }}>Nível de Permissão</label>
                            <select
                                name="role"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="input"
                                style={{ padding: '1rem', borderRadius: '16px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                <option value="operador">Operador PDV</option>
                                <option value="op_admin">Gestor de Bolões</option>
                                <option value="gerente">Gerente de Unidade</option>
                                <option value="admin">Administrador Master</option>
                            </select>
                        </div>

                        {role !== 'admin' && (
                            <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                                <label style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem', display: 'block', letterSpacing: '0.1em', marginLeft: '0.25rem' }}>Unidade Vinculada</label>
                                <select
                                    name="loja_id"
                                    required
                                    defaultValue={user?.loja_id}
                                    className="input"
                                    style={{ padding: '1rem', borderRadius: '16px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    <option value="">Selecionar Loja...</option>
                                    {lojas.map(loja => (
                                        <option key={loja.id} value={loja.id}>{loja.nome_fantasia}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                        <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {loading ? <Loader2 className="animate-spin" size={16} /> : (user ? 'Atualizar' : 'Salvar')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function ConfiguracaoUsuarios() {
    const { isAdmin } = usePerfil();
    const { lojasDisponiveis } = useLoja();
    const supabase = createBrowserSupabaseClient();
    const { toast } = useToast();
    const confirm = useConfirm();

    const [users, setUsers] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [modalConfig, setModalConfig] = useState<{ show: boolean, user?: any }>({ show: false });

    useEffect(() => {
        if (isAdmin) {
            loadUsers();
        }
    }, [isAdmin]);

    async function loadUsers() {
        setLoadingData(true);
        try {
            const result = await getUsersAction();
            if (result.error) {
                console.error('[CONFIG_USUARIOS] Erro ao carregar usuários:', result.error);
                toast({ message: 'Erro ao carregar usuários: ' + result.error, type: 'error' });
            } else if (result.data) {
                setUsers(result.data);
            }
        } catch (err: any) {
            console.error('[CONFIG_USUARIOS] Erro crítico:', err);
        } finally {
            setLoadingData(false);
        }
    }

    async function handleToggleStatus(user: any) {
        const action = user.ativo ? 'inativar' : 'ativar';
        const confirmMsg = user.ativo
            ? `Deseja inativar ${user.nome}? Ele perderá acesso ao sistema imediatamente.`
            : `Deseja ativar o acesso de ${user.nome}?`;

        const confirmed = await confirm({
            title: 'Alterar Status do Usuário',
            description: confirmMsg,
            variant: user.ativo ? 'danger' : 'neutral',
            confirmLabel: user.ativo ? 'Sim, Inativar' : 'Sim, Ativar'
        });

        if (!confirmed) return;

        const res = await toggleUserStatus(user.id, !user.ativo);
        if (res.success) {
            toast({ message: `Usuário ${user.ativo ? 'inativado' : 'ativado'} com sucesso!`, type: 'success' });
            loadUsers();
        } else {
            toast({ message: `Erro ao ${action}: ` + res.error, type: 'error' });
        }
    }

    if (!isAdmin) return <div className="p-8 text-slate-500 font-medium italic">Privilégios de Administrador Master necessários.</div>;

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
                paddingBottom: '1.25rem',
                borderBottom: '1px solid var(--border)'
            }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{
                        fontSize: '1.5rem',
                        fontWeight: 900,
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        letterSpacing: '-0.025em'
                    }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary-blue-light)',
                            boxShadow: 'none'
                        }}>
                            <Users size={22} />
                        </div>
                        Controle de Equipe
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 500 }}>
                        Gestão centralizada de permissões e acessos.
                    </p>
                </div>
                <button
                    onClick={() => setModalConfig({ show: true })}
                    className="btn btn-primary"
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        boxShadow: 'none'
                    }}
                >
                    <Plus size={18} strokeWidth={3} /> Novo Usuário
                </button>
            </div>

            {loadingData ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8rem 0',
                    gap: '2rem'
                }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            border: '4px solid rgba(59, 130, 246, 0.1)',
                            borderTopColor: 'var(--primary-blue-light)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        <Users style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            color: 'rgba(59, 130, 246, 0.3)'
                        }} size={32} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.025em', display: 'block' }}>Carregando dados...</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500, marginTop: '0.25rem' }}>Sincronizando com a base segura</span>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {users.map(u => (
                        <div key={u.id} style={{
                            padding: '1.25rem',
                            borderRadius: '24px',
                            border: '1px solid var(--border)',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.5s ease',
                            background: u.ativo ? 'var(--bg-card-subtle)' : 'rgba(239, 68, 68, 0.05)',
                            opacity: u.ativo ? 1 : 0.6,
                            filter: u.ativo ? 'none' : 'grayscale(1)',
                            boxShadow: 'none'
                        }} className="group-hover:">
                            {/* Ambient Glow */}
                            <div style={{
                                position: 'absolute',
                                inset: '-1px',
                                background: 'linear-gradient(90deg, rgba(59, 130, 246, 0), rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0))',
                                opacity: 0,
                                transition: 'opacity 0.7s ease',
                                pointerEvents: 'none'
                            }} className="ambient-glow" />

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                    <div style={{
                                        width: '56px',
                                        height: '56px',
                                        borderRadius: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 900,
                                        fontSize: '1.25rem',
                                        color: '#fff',
                                        boxShadow: 'none',
                                        background: u.role === 'admin' ? 'linear-gradient(135deg, #a855f7, #4f46e5)' :
                                            u.role === 'gerente' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' :
                                                u.role === 'op_admin' ? 'linear-gradient(135deg, #10b981, #0d9488)' :
                                                    '#1e293b'
                                    }}>
                                        {u.nome?.[0]?.toUpperCase() || '?'}
                                    </div>

                                    <div>
                                        <div style={{
                                            fontWeight: 900,
                                            fontSize: '1.15rem',
                                            color: 'var(--text-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            marginBottom: '0.25rem',
                                            letterSpacing: '-0.025em'
                                        }}>
                                            {u.nome}
                                            {u.role === 'admin' && <Shield size={18} style={{ color: '#a78bfa', fill: 'rgba(167, 139, 250, 0.1)' }} />}
                                            {!u.ativo && <span style={{ fontSize: '9px', background: 'var(--danger)', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.025em' }}>Bloqueado</span>}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.25rem' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: u.ativo ? 'var(--success)' : 'var(--danger)'
                                                }} />
                                                <Store size={14} style={{ color: 'var(--text-muted)' }} />
                                                {u.loja_id ? lojasDisponiveis.find(l => l.id === u.loja_id)?.nome_fantasia || 'Ponto de Venda' : (u.role === 'admin' ? 'Acesso Global' : 'Vinculação Pendente')}
                                            </div>
                                            <div style={{
                                                fontSize: '0.65rem',
                                                fontWeight: 900,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.1em',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '100px',
                                                border: '1px solid var(--border)',
                                                background: u.role === 'admin' ? 'rgba(168, 85, 247, 0.1)' :
                                                    u.role === 'gerente' ? 'rgba(59, 130, 246, 0.1)' :
                                                        u.role === 'op_admin' ? 'rgba(16, 185, 129, 0.1)' :
                                                            'rgba(30, 41, 59, 0.5)',
                                                color: u.role === 'admin' ? '#a855f7' :
                                                    u.role === 'gerente' ? '#3b82f6' :
                                                        u.role === 'op_admin' ? '#10b981' :
                                                            'var(--text-muted)'
                                            }}>
                                                {u.role.replace('_', ' ')}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <button
                                        onClick={() => setModalConfig({ show: true, user: u })}
                                        className="btn btn-ghost"
                                        style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border)' }}
                                        title="Editar Configurações"
                                    >
                                        <Edit2 size={20} />
                                    </button>

                                    <button
                                        onClick={() => handleToggleStatus(u)}
                                        disabled={u.role === 'admin'}
                                        className="btn btn-ghost"
                                        style={{
                                            padding: '0.75rem',
                                            borderRadius: '12px',
                                            border: '1px solid var(--border)',
                                            color: u.ativo ? 'var(--danger)' : 'var(--success)',
                                            opacity: u.role === 'admin' ? 0 : 1,
                                            pointerEvents: u.role === 'admin' ? 'none' : 'auto'
                                        }}
                                        title={u.ativo ? 'Inativar Usuário' : 'Reativar Usuário'}
                                    >
                                        <Power size={22} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {users.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            padding: '8rem 0',
                            border: '2px dashed var(--border)',
                            borderRadius: '48px',
                            background: 'var(--bg-card-subtle)'
                        }}>
                            <div style={{
                                width: '112px',
                                height: '112px',
                                background: 'var(--bg-dark)',
                                borderRadius: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 2rem',
                                boxShadow: 'none'
                            }}>
                                <Users size={48} style={{ color: 'var(--text-muted)', opacity: 0.2 }} />
                            </div>
                            <h4 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-secondary)', letterSpacing: '-0.025em' }}>Equipe Inexistente</h4>
                            <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem', maxWidth: '320px', margin: '0.75rem auto 0', fontWeight: 500 }}>
                                Você ainda não cadastrou membros para sua operação MegaB.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {modalConfig.show && (
                <ModalUserForm
                    user={modalConfig.user}
                    lojas={lojasDisponiveis}
                    onClose={() => setModalConfig({ show: false })}
                    onSuccess={() => {
                        setModalConfig({ show: false });
                        loadUsers();
                    }}
                />
            )}
        </div>
    );
}


