# Correções e Novas Migrations - MegaMais

Este documento descreve as correções aplicadas para resolver erros de console e as novas migrations criadas.

## Problemas Identificados e Resolvidos

### 1. Função RPC `get_my_profile` Ausente
**Erro:** `Could not find the function public.get_my_profile without parameters`

**Causa:** O hook `usePerfil.tsx` estava tentando chamar uma função RPC que não existia no banco.

**Solução:** Criada migration `012_funcoes_perfil_usuario.sql`

### 2. Funções de Dashboard Ausentes
**Erro:** Várias funções RPC usadas pelos actions não existiam

**Causa:** Actions tentavam chamar RPCs não implementadas

**Solução:** Criada migration `013_funcoes_dashboard_admin.sql`

---

## Migration 012: Funções de Perfil de Usuário

**Arquivo:** `012_funcoes_perfil_usuario.sql`
**Data:** 2026-02-24

### Funções Criadas

#### 1. `get_my_profile()`
Retorna o perfil completo do usuário autenticado.

**Uso:**
```typescript
const { data, error } = await supabase.rpc('get_my_profile');
```

**Retorno:**
```typescript
{
  id: UUID,
  role: 'admin' | 'gerente' | 'operador',
  nome: string,
  avatar_url: string | null,
  loja_id: UUID | null,
  ativo: boolean,
  created_at: timestamp,
  updated_at: timestamp
}
```

**Segurança:**
- Usa `auth.uid()` para garantir que usuário só acessa próprio perfil
- `SECURITY DEFINER` para bypass de RLS

#### 2. `update_my_profile(p_nome, p_avatar_url)`
Atualiza dados do perfil do usuário autenticado.

**Uso:**
```typescript
await supabase.rpc('update_my_profile', {
  p_nome: 'Novo Nome',
  p_avatar_url: 'https://...'
});
```

**Parâmetros:**
- `p_nome` (TEXT, opcional): Novo nome do usuário
- `p_avatar_url` (TEXT, opcional): Nova URL do avatar

**Segurança:**
- Usuário só pode atualizar próprio perfil
- Atualiza `updated_at` automaticamente

#### 3. `get_user_full_info()`
Retorna informações completas do usuário incluindo dados da empresa.

**Uso:**
```typescript
const { data, error } = await supabase.rpc('get_user_full_info');
```

**Retorno:**
```typescript
{
  id: UUID,
  role: user_role,
  nome: string,
  avatar_url: string | null,
  loja_id: UUID | null,
  loja_nome: string | null,
  loja_nome_fantasia: string | null,
  ativo: boolean
}
```

**Características:**
- JOIN com tabela `empresas`
- Retorna nome completo e fantasia da loja
- Útil para exibir informações completas no perfil

---

## Migration 013: Funções de Dashboard e Administração

**Arquivo:** `013_funcoes_dashboard_admin.sql`
**Data:** 2026-02-24

### Funções Criadas

#### 1. `get_dashboard_metrics(p_loja_id)`
Retorna métricas agregadas do dashboard para uma loja específica.

**Uso:**
```typescript
const { data, error } = await supabase.rpc('get_dashboard_metrics', {
  p_loja_id: lojaId
});
```

**Parâmetros:**
- `p_loja_id` (UUID): ID da loja

**Retorno:**
```json
{
  "total_vendas": 150000.00,
  "total_encalhes": 5000.00,
  "saldo_cofre": 12000.00,
  "caixas_abertos": 3,
  "vendas_mes": 45000.00,
  "comissoes_pendentes": 8500.00
}
```

**Métricas Calculadas:**
- **total_vendas**: Soma de todas as vendas (histórico completo)
- **total_encalhes**: Soma de despesas de encalhe
- **saldo_cofre**: Saldo atual do cofre (via view)
- **caixas_abertos**: Quantidade de sessões de caixa abertas
- **vendas_mes**: Total de vendas do mês corrente
- **comissoes_pendentes**: Total de prestações pendentes

#### 2. `get_admin_dashboard_summary()`
Retorna resumo consolidado de todas as filiais (apenas admin).

**Uso:**
```typescript
const { data, error } = await supabase.rpc('get_admin_dashboard_summary');
```

**Retorno:**
```typescript
[
  {
    loja_id: UUID,
    loja_nome: string,
    total_vendas: number,
    vendas_mes: number,
    saldo_cofre: number,
    caixas_abertos: number,
    operadores_ativos: number
  },
  // ... outras lojas
]
```

**Segurança:**
- Verifica se usuário é admin antes de retornar dados
- Lança exceção se não autorizado

**Características:**
- Agrega dados de todas as lojas ativas
- Útil para visão gerencial consolidada
- Otimizado com GROUP BY

#### 3. `get_financeiro_transactions(p_loja_id, p_ano, p_mes)`
Retorna transações financeiras de um período específico.

**Uso:**
```typescript
const { data, error } = await supabase.rpc('get_financeiro_transactions', {
  p_loja_id: lojaId,
  p_ano: 2026,
  p_mes: 2
});
```

**Parâmetros:**
- `p_loja_id` (UUID): ID da loja (null para todas)
- `p_ano` (INTEGER): Ano desejado
- `p_mes` (INTEGER): Mês desejado (1-12)

**Retorno:**
```typescript
[
  {
    id: bigint,
    tipo: 'receita' | 'despesa',
    descricao: string,
    valor: number,
    valor_realizado: number,
    item: string,
    data_vencimento: date,
    data_pagamento: date | null,
    status: 'pendente' | 'pago' | 'atrasado' | 'cancelado',
    metodo_pagamento: string,
    comprovante_url: string | null,
    usuario_id: UUID,
    created_at: timestamp,
    observacoes: string | null
  },
  // ... outras transações
]
```

**Características:**
- Filtra por ano e mês automaticamente
- Exclui registros soft-deleted
- Ordenado por data de vencimento (mais recente primeiro)
- Suporta null em `p_loja_id` para ver todas as lojas

#### 4. `get_all_users()`
Lista todos os usuários do sistema (apenas admin).

**Uso:**
```typescript
const { data, error } = await supabase.rpc('get_all_users');
```

**Retorno:**
```typescript
[
  {
    id: UUID,
    role: 'admin' | 'gerente' | 'operador',
    nome: string,
    avatar_url: string | null,
    loja_id: UUID | null,
    loja_nome: string | null,
    ativo: boolean,
    created_at: timestamp,
    updated_at: timestamp
  },
  // ... outros usuários
]
```

**Segurança:**
- Verifica se usuário é admin
- Lança exceção se não autorizado

**Características:**
- LEFT JOIN com empresas para mostrar nome da loja
- Ordenado por status (ativos primeiro) e data de criação
- Útil para tela de administração de usuários

---

## Erros de Assets (404/500)

### Problema
Erros nos arquivos:
- `eyJkriijnbaqkewabwtw…a10b-52bc308d398b:1` (500)
- `eyJkriijnbaqkewabwtw…ta_vencimento.asc:1` (500)
- `eyJkriijnbaqkewabwtw…pc/get_my_profile:1` (404)

### Causa Provável
- URLs codificadas em base64 malformadas
- Problemas de cache do browser
- Possível conflito de proxy/middleware

### Solução Recomendada
1. Limpar cache do navegador (Ctrl+Shift+Delete)
2. Fazer hard reload (Ctrl+F5)
3. Verificar middleware.ts não está interferindo em chamadas RPC

**Verificação do middleware:**
```typescript
// middleware.ts - garantir que não intercepta RPC
export async function middleware(request: NextRequest) {
  // Não interceptar chamadas para o Supabase
  if (request.nextUrl.pathname.includes('/rest/v1/rpc')) {
    return NextResponse.next();
  }
  // ... resto do código
}
```

---

## Checklist de Verificação

Após aplicar as migrations, verificar:

- [ ] Função `get_my_profile` retorna perfil corretamente
- [ ] Hook `usePerfil` carrega sem erros
- [ ] Dashboard mostra métricas corretas
- [ ] Admin consegue ver resumo de todas filiais
- [ ] Transações financeiras carregam por período
- [ ] Lista de usuários funciona para admin
- [ ] Sem erros de RPC no console
- [ ] Cache do browser limpo

---

## Queries de Teste

### Testar get_my_profile
```sql
SELECT * FROM get_my_profile();
```

### Testar get_dashboard_metrics
```sql
SELECT * FROM get_dashboard_metrics('{loja_id}');
```

### Testar get_admin_dashboard_summary (como admin)
```sql
SELECT * FROM get_admin_dashboard_summary();
```

### Testar get_financeiro_transactions
```sql
SELECT * FROM get_financeiro_transactions('{loja_id}', 2026, 2);
```

### Testar get_all_users (como admin)
```sql
SELECT * FROM get_all_users();
```

---

## Troubleshooting

### Erro: "Acesso negado: apenas administradores"
**Causa:** Tentativa de chamar função restrita sem ser admin

**Solução:** Verificar role do usuário:
```sql
SELECT role FROM perfis WHERE id = auth.uid();
```

### Erro: "Could not find the function"
**Causa:** Migration não foi aplicada

**Solução:** Aplicar migration manualmente:
```bash
psql -d database_url -f 012_funcoes_perfil_usuario.sql
psql -d database_url -f 013_funcoes_dashboard_admin.sql
```

### Erro: "permission denied for function"
**Causa:** Falta permissão de execução

**Solução:** Garantir que funções usam `SECURITY DEFINER`:
```sql
ALTER FUNCTION get_my_profile() SECURITY DEFINER;
```

### Performance lenta
**Causa:** Falta de índices ou queries não otimizadas

**Solução:** Verificar plano de execução:
```sql
EXPLAIN ANALYZE SELECT * FROM get_dashboard_metrics('{loja_id}');
```

---

## Migrations Aplicadas

| # | Nome | Data | Status |
|---|------|------|--------|
| 001 | Tipos e Enums Base | 2026-02-24 | ✅ Aplicado |
| 002 | Estrutura Organizacional | 2026-02-24 | ✅ Aplicado |
| 003 | Autenticação e Usuários | 2026-02-24 | ✅ Aplicado |
| 004 | Cadastros | 2026-02-24 | ✅ Aplicado |
| 005 | Módulo Financeiro | 2026-02-24 | ✅ Aplicado |
| 006 | Caixa Operacional | 2026-02-24 | ✅ Aplicado |
| 007 | Módulo de Bolões | 2026-02-24 | ✅ Aplicado |
| 008 | Auditoria e Logs | 2026-02-24 | ✅ Aplicado |
| 009 | Views Críticas | 2026-02-24 | ✅ Aplicado |
| 010 | Funções RPC Críticas | 2026-02-24 | ✅ Aplicado |
| 011 | Políticas RLS | 2026-02-24 | ✅ Aplicado |
| **012** | **Funções de Perfil** | **2026-02-24** | **✅ Novo** |
| **013** | **Funções Dashboard Admin** | **2026-02-24** | **✅ Novo** |

---

## Próximas Melhorias Sugeridas

### 1. Cache de Queries
Implementar cache para queries frequentes:
- Métricas do dashboard (cache de 5 minutos)
- Lista de usuários (cache de 10 minutos)
- Configurações do sistema

### 2. Notificações em Tempo Real
Usar Supabase Realtime para:
- Novas vendas
- Alterações no cofre
- Fechamentos de caixa pendentes de validação

### 3. Logs Estruturados
Melhorar sistema de logs:
- Rastreamento de performance de RPCs
- Métricas de uso por função
- Alertas automáticos em caso de erro

### 4. Testes Automatizados
Criar testes para funções RPC:
- Unit tests para cada função
- Integration tests para fluxos completos
- Performance tests para queries complexas

---

## Suporte

Para dúvidas ou problemas:
1. Verificar logs do Supabase
2. Consultar este documento
3. Revisar código dos hooks e actions
4. Verificar policies RLS

## Versão

- **Sistema:** MegaMais v2.5.9
- **Migrations:** 013 aplicadas
- **Última atualização:** 2026-02-24
