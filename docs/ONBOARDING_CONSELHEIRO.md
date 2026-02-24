# 🎯 Guia de Onboarding — Conselheiro MegaMais

**Sistema:** MegaMais — Gestão de Bolões, Loterias e Controle Financeiro  
**Versão Atual:** Beta v2.5.15  
**Status:** ⚡ **EM PRODUÇÃO** (usado diariamente pela lotérica)  
**Última Atualização:** 10/02/2026  

---

## ⚠️ REGRAS DE OURO (LEIA PRIMEIRO!)

> [!CAUTION]
> O sistema está **em produção real**. Trabalhamos diretamente com bancos reais na nuvem (Cloud).
> Qualquer erro de build que suba ao GitHub pode **derrubar a aplicação**. Siga estas regras **SEMPRE**:

### 1. Fluxo Obrigatório de Deploy
```
Desenvolvimento (Banco Real/Cloud) → npm run build → 
   Se SUCESSO: git add . → git commit → git push
   Se ERRO: PARE. Notifique o usuário. Explique o erro. AGUARDE AUTORIZAÇÃO.
   Após autorização: Corrige → Build → Push.
```

### 2. Banco de Dados "Real"
- Trabalhamos conectados diretamente ao Supabase (Cloud).
- Migrations: **SEMPRE** informe ao usuário para executá-las manualmente no SQL Editor do Supabase.
- Nunca assuma que migrations rodam sozinhas.

### 3. Nomenclatura
- O nome oficial do sistema é **MegaMais**.
- O repositório está em `main` (branch principal).
- Commits em português: `feat(modulo): descrição` ou `fix(modulo): descrição`.

---

## 🏗️ Stack Tecnológica

| Camada | Tecnologia | Detalhes |
|--------|-----------|---------|
| **Frontend** | Next.js 14 (App Router) | React 18, TypeScript Strict |
| **Estilo** | TailwindCSS + CSS Variáveis | Dark/Light mode via variáveis CSS |
| **Backend** | Supabase (PostgreSQL) | Auth, RLS, Realtime, Storage |
| **Server Actions** | Next.js Server Actions | `src/hooks/actions.ts` e `src/actions/` |
| **Deploy** | Vercel | CI/CD automático via GitHub push |
| **Animações** | Framer Motion | Transições e modais |
| **Gráficos** | Recharts | Dashboard financeiro |

---

## 📦 Mapa de Módulos (Estado Atual)

| Módulo | Status | Rota | Componente Principal |
|--------|--------|------|---------------------|
| **Dashboard Home** | ✅ Operacional | `/` | `page.tsx` |
| **Painel Estratégico** | ✅ Operacional | `/painel-estrategico` | — |
| **Bolões & Loterias** | ✅ Operacional | `/boloes` | `BoloesPage`, `SalesAuditTab` |
| **Sorteios** | ✅ Operacional | `/sorteios` | — |
| **Conciliação Bancária** | 🟡 Parcial | `/conciliacao` | — |
| **Gestão de Caixa** | ✅ Operacional | `/caixa` | `VisaoOperadorCaixa`, `VisaoGestorCaixa` |
| **Gestão de Cofre** | ✅ Operacional | `/cofre` | — |
| **BI & Relatórios** | ✅ Operacional | `/bi` | — |
| **Painel do Operador** | ✅ Operacional | `/operador` | — |
| **Financeiro** | ⚡ **Foco Atual** | `/financeiro` | `VisaoGestor.tsx` |
| **Cadastros** | ✅ Operacional | `/cadastros/*` | Categorias, Produtos, etc. |
| **Configurações** | ✅ Operacional | `/configuracoes` | Aparência, Usuários, Dados |
| **Saneamento Batch** | ✅ Operacional | Config > Dados | `SaneamentoDadosFinanceiros.tsx` |

---

## 📂 Estrutura de Pastas Essenciais

```
megab_next/
├── src/
│   ├── app/(dashboard)/          # Páginas (App Router)
│   ├── components/               # Componentes React
│   │   ├── financeiro/           # ⚡ Módulo mais ativo
│   │   │   ├── VisaoGestor.tsx   # Dashboard financeiro principal
│   │   │   ├── FinancialGrowthChart.tsx
│   │   │   └── ModalBaixaFinanceira.tsx
│   │   ├── boloes/               # Módulo de bolões
│   │   ├── caixa/                # Módulo de caixa
│   │   ├── configuracoes/        # Configurações do sistema
│   │   │   └── SaneamentoDadosFinanceiros.tsx  # Lançamento batch
│   │   └── ui/                   # Componentes reutilizáveis (KPICard, MoneyInput, etc.)
│   ├── hooks/                    # Hooks de dados
│   │   ├── useFinanceiro.ts      # CRUD financeiro + Server Actions
│   │   ├── useItensFinanceiros.ts # Categorias financeiras
│   │   ├── useLoja.ts            # Contexto de multi-filial
│   │   ├── usePerfil.ts          # Perfil e permissões (RBAC)
│   │   └── actions.ts            # Server Actions centralizadas
│   ├── actions/                  # Server Actions adicionais
│   ├── contexts/                 # React Contexts (Toast, Confirm, Loja)
│   ├── lib/                      # Utilitários (supabase-browser, supabase-server)
│   └── types/                    # Interfaces TypeScript
├── supabase/migrations/          # 99 scripts SQL versionados
├── docs/                         # Documentação técnica
│   ├── db/                       # Scripts SQL essenciais
│   └── archive/                  # Docs históricos arquivados
├── public/                       # Assets estáticos
├── README.md                     # Visão geral do projeto
├── CHANGELOG.md                  # Histórico de mudanças
├── DEPLOY_GUIDE.md               # Guia de deploy na Vercel
├── DEVELOPMENT_WORKFLOW.md       # Fluxo de trabalho
└── CONTRIBUTING.md               # Padrões de contribuição
```

---

## 🔧 Módulo Financeiro (Foco Atual - Detalhado)

### Arquitetura do Financeiro

```
┌──────────────────────────┐
│ VisaoGestor.tsx          │ ← Dashboard: KPIs, gráfico, tabela de movimentações
│  ├── useFinanceiro()     │ ← Hook: CRUD de transações (financeiro_contas)
│  ├── useItensFinanceiros()│ ← Hook: CRUD de categorias (financeiro_itens_plano)
│  └── ModalBaixaFinanceira│ ← Modal: Dar baixa com comprovante
└──────────────────────────┘
         │
         ▼ (Supabase)
┌──────────────────────────┐
│ financeiro_itens_plano   │ ← Categorias (Aluguel, Folha, etc.)
│  └→ Trigger SQL          │ ← AUTO: Gera 12 meses se tipo_recorrencia='FIXA'
│                          │ ← AUTO: Sincroniza dia_vencimento e valor_padrao
└──────────────────────────┘
         │
         ▼
┌──────────────────────────┐
│ financeiro_contas        │ ← Movimentações (Receitas/Despesas/Pendentes/Pagas)
└──────────────────────────┘
```

### Sistema de Recorrências Automáticas (v2.5.15)
- **Trigger:** `auto_gerar_recorrencias_trigger` em `financeiro_itens_plano`
- **Função:** `processar_recorrencias_financeiras()` — gera Jan-Dez automaticamente
- **Sync Inteligente:** Alterações em `dia_vencimento` ou `valor_padrao` atualizam parcelas PENDENTES
- **Unique Index:** `idx_financeiro_contas_sync_unique` — evita duplicatas por mês/ano/categoria
- **Documentação completa:** `docs/SISTEMA_RECORRENCIAS_AUTOMATICO.md`

### Correção de Fuso Horário (v2.5.15)
- Datas de vencimento exibidas via `string.split('-').reverse().join('/')` para evitar deslocamento UTC-3

---

## 🗃️ Banco de Dados (Supabase)

### Tabelas Principais
| Tabela | Função |
|--------|--------|
| `perfis` | Usuários, roles (admin/operador/master), loja_id |
| `empresas` / `lojas` | Multi-filial (Natureza, etc.) |
| `financeiro_itens_plano` | Categorias financeiras (Aluguel, Folha, FGTS...) |
| `financeiro_contas` | Movimentações financeiras |
| `produtos` | Loterias (Mega-Sena, Quina, etc.) |
| `boloes` | Bolões criados |
| `boloes_cotas` | Cotas de bolões |
| `caixa_sessoes` | Sessões de caixa |
| `caixa_movimentacoes` | Movimentações do caixa |
| `cofre_movimentacoes` | Movimentações do cofre |

### Migrations Importantes (Recentes)
| Migration | Descrição |
|-----------|-----------|
| `20260210120000_fix_delete_categories_v2_5_14.sql` | FK com ON DELETE SET NULL |
| `20260210130000_full_year_recurrence_v2_5_14.sql` | Recorrências Jan-Dez |
| `20260210140000_auto_trigger_recorrencias_v2_5_14.sql` | Trigger automático |
| `20260210150000_smart_sync_recurrences_v2_5_15.sql` | Sync inteligente |

---

## 🐛 Bugs Conhecidos e Limitações

1. **Venda de Cotas de Bolões:** Não há interface frontend para vender cotas (backend `registrarVendaBolao()` existe mas sem modal).
2. **Conciliação Bancária:** Módulo parcialmente implementado.
3. **Coluna `arquivado`:** Adicionada na v2.5.14, mas nem todos os queries filtram por ela ainda.
4. **99 migrations:** Histórico extenso; considerar consolidação futura em `clean_schema.sql`.

---

## 🚀 Como Começar a Trabalhar

```bash
# 1. Garantir que está na versão mais recente
cd prototipos/megab_next
git pull origin main

# 2. Instalar dependências (se necessário)
npm install

# 3. Rodar ambiente de desenvolvimento
npm run dev
# Acessar: http://localhost:3000

# 4. Antes de qualquer push:
npm run build
# Se build OK → git add . → git commit → git push
```

### Workflows Disponíveis
Use os workflows com `/` no chat para ativar contextos especializados:
- `/ativar-conselheiro-megab` — Ativar Conselheiro geral
- `/workspace-c-vendas` — Foco em Vendas e Fiscal
- `/workspace-h-database` — Foco em Banco de Dados
- `/run-tests` — Executar testes

---

**Versão deste documento:** 2.5.15 | **Data:** 10/02/2026
