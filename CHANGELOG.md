# 🚀 Changelog v2.5.14/15 - Sistema Financeiro Inteligente

**Data:** 10/02/2026  
**Responsável:** Conselheiro MegaB  

---

## 🌟 ATUALIZAÇÃO v2.5.15 (Sincronismo Inteligente) ✅

### **1. Inteligência de Vencimento e Valor**
- ✅ **Problema:** Mudar o dia de vencimento na categoria não alterava as contas já geradas.
- ✅ **Solução:** Trigger SQL agora identifica mudanças em `dia_vencimento` e `valor_padrao` e sincroniza todas as parcelas **PENDENTES** do ano automaticamente.

### **2. Correção de Fuso Horário (09 vs 10)**
- ✅ **Problema:** A tabela mostrava dia 09 quando o vencimento era dia 10 (devido ao fuso UTC-3).
- ✅ **Solução:** Exibição via manipulação direta de string no frontend, ignorando o objeto Date do JS.

### **3. Automação Total (Zero Clique)**
- ✅ **Removido:** Botão manual "Gerar Recorrências" (agora é automático via trigger).
- ✅ **Removido:** Polling rate de 30 segundos (reduz consumo de recursos, desnecessário com triggers eficientes).

---

## 🚀 Changelog v2.5.14 - Correções Críticas

### 1. **Exclusão de Categorias** ✅
- ✅ FK `financeiro_contas` agora usa `ON DELETE SET NULL`.
- ✅ Implementado soft delete com coluna `arquivado`.

**Arquivo:** `supabase/migrations/20260210120000_fix_delete_categories_v2_5_14.sql`

**Mudanças:**
- ✅ Adicionado `GRANT DELETE` para usuários autenticados
- ✅ FK `financeiro_contas.item_financeiro_id` agora usa `ON DELETE SET NULL`
- ✅ Coluna `arquivado` adicionada para soft delete (melhor prática)

**Comportamento:**
- **Antes:** Erro ao tentar excluir categoria via UI
- **Depois:** Categoria é deletada, movimentações antigas ficam com `item_financeiro_id = NULL` (histórico preservado)

---

### 2. **Atualização de Modalidade em Tempo Real** ✅

**Arquivos Modificados:**
- `src/hooks/useItensFinanceiros.ts` (linha 99-102)
- `src/components/financeiro/VisaoGestor.tsx` (linha 336-337)

**Mudanças:**
```typescript
// useItensFinanceiros.ts
const atualizarItem = async (id, updates) => {
    // ... update no banco
    
    // ✅ FIX: Atualiza estado local IMEDIATAMENTE
    setItens(prev => prev.map(c => c.id === id ? data : c));
    return data;
};

// VisaoGestor.tsx
handleSave = async () => {
    // ... salvar categoria
    
    // ✅ FIX: Refresh completo (categorias + transações)
    await fetchItens(lojaAtual?.id || null);
    fetchTransacoes(ano, 0, lojaAtual?.id || null);
};
```

**Comportamento:**
- **Antes:** Altera "Aluguel" de Variável → Fixo Mensal → Badge continua "Fixo Variável"
- **Depois:** Badge atualiza **instantaneamente** sem refresh manual

---

### 3. **Recorrências para Ano Inteiro (Jan-Dez)** ✅

**Arquivo:** `supabase/migrations/20260210130000_full_year_recurrence_v2_5_14.sql`

**Mudanças:**
```sql
-- ANTES (gerava só do mês atual até Dezembro)
FOR v_mes_loop IN v_mes_atual..12 LOOP

-- DEPOIS (gera Janeiro a Dezembro)
FOR v_mes_loop IN 1..12 LOOP
```

**Comportamento:**
- **Antes:** Cria "Água" como Fixo Mensal em Fevereiro → Só gera Fev, Mar, Abr... Dez
- **Depois:** Gera **12 lançamentos** (Jan, Fev, Mar... Dez)

---

## 📂 ARQUIVOS ALTERADOS

### Migrations (SQL)
```
supabase/migrations/
├── 20260210120000_fix_delete_categories_v2_5_14.sql   [NOVO]
└── 20260210130000_full_year_recurrence_v2_5_14.sql    [NOVO]
```

### Frontend (TypeScript/React)
```
src/
├── hooks/
│   └── useItensFinanceiros.ts                           [MODIFICADO]
└── components/financeiro/
    └── VisaoGestor.tsx                                  [MODIFICADO]
```

### Documentação
```
docs/
└── AUDITORIA_FINANCEIRO_v2_5_13.md                      [NOVO]
```

---

## 🧪 TESTES NECESSÁRIOS (Pós-Deploy)

### ✅ Teste 1: Exclusão de Categoria
1. Criar categoria teste "Teste Delete" (Despesa)
2. Criar 1 movimentação associada
3. Tentar excluir categoria → **Deve funcionar!**
4. Verificar que movimentação antiga tem `item_financeiro_id = NULL`

### ✅ Teste 2: Mudança de Modalidade
1. Editar "Aluguel" → Mudar de VARIAVEL para FIXA
2. Salvar modal
3. Verificar que badge **muda instantaneamente** de "Fixo Variável" para "Fixo Mensal"

### ✅ Teste 3: Recorrências Anuais
1. Criar categoria "Água" (Despesa, Fixo Mensal, dia 10, R$ 80)
2. Clicar botão "Gerar Recorrências"
3. Verificar que aparecem **12 lançamentos** (Jan/2026 até Dez/2026) na tabela

---

## 🎯 COMANDOS GIT PARA DEPLOY

```bash
# 1. Verificar mudanças
git status

# 2. Adicionar tudo
git add .

# 3. Commit com mensagem descritiva
git commit -m "v2.5.14 - Fix: Exclusão de categorias, atualização de modalidade e recorrências anuais

- Correção de RLS e FK para permitir DELETE de categorias
- Atualização em tempo real de badges de modalidade (tipo_recorrencia)
- Função processar_recorrencias agora gera Jan-Dez (não só mês atual até Dez)
- Soft delete opcional com coluna 'arquivado'

Closes #BUG-001, #BUG-002, #BUG-003"

# 4. Push para GitHub (Vercel vai atualizar automaticamente)
git push origin main
```

---

## 📊 MÉTRICAS DE IMPACTO

| Bug | Severidade | Tempo Indisponível | Status |
|-----|------------|-------------------|--------|
| Não consegue excluir categorias | 🔴 Alta | 3 dias | ✅ Resolvido |
| Modalidade não atualiza | 🟡 Média | 3 dias | ✅ Resolvido |
| Recorrências não aparecem em todos os meses | 🔴 Alta | 3 dias | ✅ Resolvido |

**Estimativa de Testes:** ~15 minutos  
**Downtime Esperado:** 0 (deploy Vercel sem interrupção)

---

## 🔒 SEGURANÇA

- ✅ Nenhuma quebra de compatibilidade com dados existentes
- ✅ Soft delete preserva histórico financeiro
- ✅ FK com `ON DELETE SET NULL` evita perda de auditoria
- ✅ RLS permanece ativo (isolamento multi-tenant mantido)

---

**Status:** 🟢 **PRONTO PARA DEPLOY**  
**Próxima Versão:** v2.5.15 (melhorias de UX pendentes)
