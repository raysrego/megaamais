'use client';

import { Users, Package, Building, FileText, Plus, ChevronRight, Monitor } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { useState } from 'react';

const cadastros = [
    { id: 'produtos', nome: 'Produtos', descricao: 'Gerenciar catálogo de produtos e serviços', icon: Package, count: 45, link: '/cadastros/produtos' },
    { id: 'terminais', nome: 'Terminais TFL', descricao: 'Cadastro de terminais físicos de venda', icon: Monitor, count: 4, link: '/cadastros/terminais' },
    { id: 'fornecedores', nome: 'Fornecedores', descricao: 'Gerenciar fornecedores e distribuidores', icon: Building, count: 12 },
    { id: 'funcionarios', nome: 'Funcionários', descricao: 'Equipe e colaboradores da lotérica', icon: Users, count: 8 },
    { id: 'clientes', nome: 'Clientes VIP', descricao: 'Clientes frequentes e cartela fidelidade', icon: Users, count: 156 },
    { id: 'plano-contas', nome: 'Plano de Contas', descricao: 'Categorias de receitas e despesas', icon: FileText, count: 24 },
];

export default function CadastrosPage() {
    const [loading] = useState(false); // Placeholder para futura integração

    if (loading) return <LoadingState type="list" />;

    return (
        <div className="dashboard-content">
            <PageHeader title="Cadastros" />

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {cadastros.map(cad => (
                    <Link key={cad.id} href={cad.link || '/cadastros'} className="card" style={{ cursor: 'pointer', transition: 'all 0.2s ease', textDecoration: 'none', color: 'inherit' }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="kpi-icon">
                                    <cad.icon size={20} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>{cad.nome}</h3>
                                    <p className="text-sm text-muted">{cad.descricao}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="badge success">{cad.count} registros</span>
                                <ChevronRight size={18} className="text-muted" />
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-primary">
                    <Plus size={16} /> Novo Cadastro
                </button>
            </div>
        </div>
    );
}
