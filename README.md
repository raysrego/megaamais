# Sistema MegaMais — Gestão de Bolões, Loterias e Controle Financeiro

**Versão:** Beta v2.5.15  
**Status:** ⚡ Em Produção  

---

## 🚀 Visão Geral

O **MegaMais** é uma plataforma completa para gestão de casas lotéricas, substituindo planilhas manuais e sistemas legados. Oferece uma interface moderna com:

- 📊 **Financeiro** — Controle de receitas, despesas, recorrências automáticas e conciliação
- 🎲 **Bolões & Loterias** — Cadastro, venda de cotas, encalhe e auditoria
- 💰 **Gestão de Caixa** — Abertura, movimentações, fechamento e cofre
- 📈 **BI & Relatórios** — Dashboards, KPIs e painel estratégico
- 👥 **Multi-filial** — Suporte a múltiplas lojas com segregação por `loja_id`
- 🔐 **RBAC** — Controle de acesso por perfis (Master, Admin, Operador)

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Next.js 14 (App Router), React 18, TailwindCSS |
| **Backend/DB** | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| **Linguagem** | TypeScript (Strict Mode) |
| **Deploy** | Vercel (CI/CD automático via push no GitHub) |
| **State** | React Hooks + Server Actions |
| **Animações** | Framer Motion |
| **Gráficos** | Recharts |

---

## 🏁 Como Rodar o Projeto

### Pré-requisitos
- Node.js (v18 ou superior)
- Conta no Supabase

### Instalação

1. **Clone o repositório:**
    ```bash
    git clone https://github.com/eduardosousa84eduardosousa-sudo/Giroz-Sistemas.git
    cd prototipos/megab_next
    ```

2. **Instale as dependências:**
    ```bash
    npm install
    ```

3. **Configuração de Ambiente:**
    Crie um arquivo `.env.local` na raiz com suas chaves do Supabase:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=sua_url_aqui
    NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui
    SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_aqui
    ```

4. **Configuração do Banco de Dados:**
    - Acesse `docs/db/clean_schema.sql` e execute no SQL Editor do Supabase.
    - Aplique todas as migrations de `supabase/migrations/` em ordem cronológica.

5. **Rodar o Servidor:**
    ```bash
    npm run dev
    ```
    Acesse `http://localhost:3000`.

---

## 📂 Estrutura de Pastas

| Pasta | Função |
|-------|--------|
| `src/app/(dashboard)/` | Páginas e rotas (App Router) |
| `src/components/` | Componentes por módulo (financeiro, bolões, caixa, ui) |
| `src/hooks/` | Hooks de dados e Server Actions |
| `src/actions/` | Server Actions adicionais |
| `src/contexts/` | React Contexts (Toast, Confirm, Loja) |
| `src/types/` | Interfaces TypeScript |
| `supabase/migrations/` | Scripts SQL versionados |
| `docs/` | Documentação técnica |

---

## 📖 Documentação

- [Guia de Onboarding (Conselheiros)](docs/ONBOARDING_CONSELHEIRO.md) ← **Comece aqui!**
- [Fluxo de Desenvolvimento](DEVELOPMENT_WORKFLOW.md)
- [Guia de Deploy](DEPLOY_GUIDE.md)
- [Padrões de Contribuição](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

---

**Versão:** Beta v2.5.15 | **Última Atualização:** 10/02/2026
