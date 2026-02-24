# 🔍 Auditoria Financeira - MegaB v2.5.13
**Data:** 10/02/2026  
**Conselheiro:** MegaB Strategic Advisor  
**Objetivo:** Diagnosticar e corrigir 3 problemas críticos do módulo financeiro

---

## 📋 RESUMO EXECUTIVO

### Arquitetura Atual

O módulo financeiro é composto por **2 tabelas principais** com **1 relacionamento opcional**:

```
┌─────────────────────────────────┐
│ financeiro_itens_plano          │ ← CATEGORIAS/PLANO DE CONTAS
├─────────────────────────────────┤
│ id (SERIAL PK)                  │
│ item (TEXT UNIQUE)              │ ← Nome (ex: "Aluguel")
│ tipo (receita/despesa)          │
│ fixo (BOOLEAN)                  │ ← Ignorado! Usar tipo_recorrencia
│ tipo_recorrencia (ENUM)         │ ← FIXA/VARIAVEL/NENHUMA
│ dia_vencimento (INTEGER)        │
│ valor_padrao (NUMERIC)          │
│ loja_id (UUID FK)               │ ← Multi-tenant
│ ordem, ativo, created_at...     │
└─────────────────────────────────┘
           ↑ (FK opcional)
           │
┌─────────────────────────────────┐
│ financeiro_contas               │ ← MOVIMENTAÇÕES REAIS
├─────────────────────────────────┤
│ id (SERIAL PK)                  │
│ tipo (receita/despesa)          │
│ descricao (TEXT)                │
│ valor (NUMERIC)                 │
│ item (TEXT)                     │ ← Redundância histórica
│ item_financeiro_id (INTEGER)   │ ← FK para itens_plano (NOVO)
│ data_vencimento, status, ...    │
│ loja_id (UUID FK)               │
└─────────────────────────────────┘
```

---

## 🐛 PROBLEMAS IDENTIFICADOS

### ❌ **Problema 1: Não consegue EXCLUIR categorias**

**Root Cause:** Constraint FK sem `ON DELETE CASCADE/SET NULL`

**Explicação:**
```sql
-- Hook atual (useItensFinanceiros.ts linha 109-113)
const excluirItem = async (id: number) => {
    // Tenta desvincular lançamentos primeiro
    await supabase
        .from('financeiro_contas')
        .update({ item_financeiro_id: null })
        .eq('item_financeiro_id', id);
    
    // Depois tenta excluir
    await supabase
        .from('financeiro_itens_plano')
        .delete()
        .eq('id', id);
}
```

**Porém:** O RLS da tabela `financeiro_itens_plano` está **bloqueando a exclusão**!

```sql
-- Migração 20260204110000_hardened_rls_multitenant.sql (linha 57-59)
CREATE POLICY "itens_plano_isolation_delete" ON public.financeiro_itens_plano
    FOR DELETE TO authenticated
    USING (public.is_master() OR loja_id = public.get_my_loja_id());
```

**Hipóteses de falha:**
1. O usuário não é `is_master()` (Admin)
2. O `loja_id` da categoria não corresponde ao `get_my_loja_id()` do usuário
3. Existe um GRANT faltando (`DELETE` permission)

---

### ❌ **Problema 2: Não consegue ATUALIZAR tipo_recorrencia (Modalidade)**

**Root Cause:** Atualização acontece no frontend, mas não reflete nas movimentações

**Explicação:**

No `VisaoGestor.tsx` (linhas 298-307):
```tsx
const catAtual = categorias.find(c => c.item === formData.item);
if (catAtual && catAtual.tipo_recorrencia !== formData.modalidade) {
    await atualizarItem(catAtual.id, {
        tipo_recorrencia: formData.modalidade,
        fixo: formData.modalidade !== 'NENHUMA'
    });
    await fetchItens(lojaAtual?.id || null);
}
```

**O que você vê:**  
Altera "Aluguel" de `VARIAVEL` para `FIXA` no modal → Salva → **Categoria atualiza**, mas **movimentações antigas continuam com badge "Fixo Variável"**

**Por quê?**  
As movimentações em `financeiro_contas` **não têm coluna `tipo_recorrencia`**! Elas apenas herdam da categoria via JOIN.

```tsx
// VisaoGestor.tsx linha 761-778 (Como os badges são renderizados)
let cat = categorias.find(c => c.id === t.item_financeiro_id);
if (!cat) cat = categorias.find(c => c.item === t.item);

if (cat?.tipo_recorrencia === 'FIXA') {
    return <span className="bg-indigo-500/10">Fixo Mensal</span>;
} else if (cat?.tipo_recorrencia === 'VARIAVEL') {
    return <span className="bg-pink-500/10">Fixo Variável</span>;
}
```

**Problema:** Se você atualizou "Aluguel" no banco de `VARIAVEL` → `FIXA`, mas o componente React não refez a query de categorias, ele continua mostrando o cache antigo.

**Solução Implementada (mas pode ter bug):**  
Linha 306: `await fetchItens(lojaAtual?.id || null);`

**Mas:** O estado `categorias` vem de `useItensFinanceiros`, que usa `useState`. Se o componente não re-renderizar, o badge continua desatualizado.

---

### ❌ **Problema 3: Itens "FIXA" não aparecem automaticamente nos meses**

**Root Cause:** Função `processar_recorrencias_financeiras()` só processa mês atual, e apenas itens com `tipo_recorrencia = 'FIXA'`

**Explicação:**

```sql
-- Migration 20260210101000_fix_recurrence_cast.sql (linhas 18-23)
FOR v_categoria IN 
    SELECT * FROM financeiro_itens_plano 
    WHERE tipo_recorrencia = 'FIXA'   ← CORRETO!
      AND ativo = TRUE
LOOP
    FOR v_mes_loop IN v_mes_atual..12 LOOP  ← Só do mês atual até Dezembro!
```

**O que você esperava:**  
Cria "Aluguel" com modalidade "Fixo Mensal" → Aparece automaticamente em Jan, Fev, Mar... Dez

**O que acontece:**  
Só gera do **mês atual pra frente**. Se estamos em Fevereiro, não gera Janeiro retroativo.

**Além disso:**  
Você precisa **clicar manualmente** no botão "Gerar Recorrências" para executar a função!

```tsx
// VisaoGestor.tsx linhas 461-472
<button onClick={handleProcessarRecorrencias}>
    <Zap /> Gerar Recorrências
</button>
```

**Não existe trigger automático mensal!**

---

## ✅ SOLUÇÕES PROPOSTAS

### 🔧 **Solução 1: Permitir DELETE de Categorias**

**Opção A: Corrigir permissões RLS (Recomendado)**

```sql
-- Migration: 20260210120000_fix_delete_categories_v2_5_14.sql

-- Adicionar permissão GRANT DELETE (caso esteja faltando)
GRANT DELETE ON financeiro_itens_plano TO authenticated;

-- Adicionar CASCADE à FK (segurança extra)
ALTER TABLE financeiro_contas 
DROP CONSTRAINT IF EXISTS financeiro_contas_item_financeiro_id_fkey;

ALTER TABLE financeiro_contas
ADD CONSTRAINT financeiro_contas_item_financeiro_id_fkey
FOREIGN KEY (item_financeiro_id) REFERENCES financeiro_itens_plano(id)
ON DELETE SET NULL;  -- ← Ao deletar categoria, movimentações ficam órfãs (mas preservadas)

COMMENT ON CONSTRAINT financeiro_contas_item_financeiro_id_fkey 
ON financeiro_contas IS 
'FK opcional para classificação. ON DELETE SET NULL preserva histórico mesmo se categoria for removida.';
```

**Opção B: Soft Delete (Melhor prática empresarial)**

```sql
-- Adicionar flag de "arquivamento"
ALTER TABLE financeiro_itens_plano ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;

-- Atualizar query do hook para filtrar arquivados
-- useItensFinanceiros.ts (linha 46):
.select('*')
.eq('arquivado', false)  // ← Só mostra ativos
```

---

### 🔧 **Solução 2: Atualização de Modalidade refletir em tempo real**

**Root Cause Confirmado:** O `fetchItens()` está sendo chamado, mas o componente não está re-renderizando porque `categorias` é derivado de `itens`.

**Fix Definitivo:**

```typescript
// useItensFinanceiros.ts (linha 89-105)
const atualizarItem = async (id: number, updates: Partial<ItemFinanceiro>) => {
    const { data, error } = await supabase
        .from('financeiro_itens_plano')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    
    // ✅ FIX: Forçar atualização do estado local IMEDIATAMENTE
    setItens(prev => prev.map(c => c.id === id ? data : c).sort((a, b) => a.ordem - b.ordem));
    
    return data;
};
```

**Porém:** O componente `VisaoGestor` também precisa re-fetch das **transações** para pegar o novo `item_financeiro_id`:

```tsx
// VisaoGestor.tsx (após salvar no handleSave, linha 336)
await fetchItens(lojaAtual?.id || null);
fetchTransacoes(ano, 0, lojaAtual?.id || null);  // ← Refresh completo!
```

---

### 🔧 **Solução 3: Gerar recorrências para TODO O ANO (não só mês atual)**

**Migration: 20260210130000_full_year_recurrence_v2_5_14.sql**

```sql
CREATE OR REPLACE FUNCTION public.processar_recorrencias_financeiras()
RETURNS TABLE(processadas INTEGER) AS $$
DECLARE
    v_processadas INTEGER := 0;
    v_ano_atual INTEGER;
    v_mes_loop INTEGER;
    v_categoria RECORD;
    v_vencimento_date DATE;
    v_dia_venc INTEGER;
BEGIN
    v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE);

    FOR v_categoria IN 
        SELECT * FROM financeiro_itens_plano 
        WHERE tipo_recorrencia = 'FIXA' 
          AND ativo = TRUE
    LOOP
        -- ✅ FIX: Gerar de Janeiro a Dezembro (não só do mês atual pra frente)
        FOR v_mes_loop IN 1..12 LOOP
            v_dia_venc := COALESCE(v_categoria.dia_vencimento, 5);
            
            BEGIN
                v_vencimento_date := MAKE_DATE(v_ano_atual, v_mes_loop, v_dia_venc);
            EXCEPTION WHEN others THEN
                v_vencimento_date := (MAKE_DATE(v_ano_atual, v_mes_loop, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
            END;

            IF NOT EXISTS (
                SELECT 1 FROM financeiro_contas
                WHERE item_financeiro_id = v_categoria.id
                  AND EXTRACT(MONTH FROM data_vencimento) = v_mes_loop
                  AND EXTRACT(YEAR FROM data_vencimento) = v_ano_atual
                  AND recorrente = TRUE
            ) THEN
                INSERT INTO financeiro_contas (
                    tipo,
                    descricao,
                    valor,
                    item,
                    data_vencimento,
                    status,
                    recorrente,
                    frequencia,
                    loja_id,
                    item_financeiro_id
                ) VALUES (
                    v_categoria.tipo::fin_tipo_transacao,
                    v_categoria.item,
                    v_categoria.valor_padrao,
                    v_categoria.item,
                    v_vencimento_date,
                    'pendente',
                    TRUE,
                    'mensal',
                    v_categoria.loja_id,
                    v_categoria.id
                );

                v_processadas := v_processadas + 1;
            END IF;

        END LOOP;
    END LOOP;

    RETURN QUERY SELECT v_processadas;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.processar_recorrencias_financeiras IS
'Gera lançamentos recorrentes de FIXA para TODO O ANO (Jan-Dez), evitando duplicatas.';
```

**Execução Automática (Opcional):**

```sql
-- Criar Trigger para rodar automaticamente quando cadastrar nova categoria FIXA
CREATE OR REPLACE FUNCTION trg_auto_gerar_fixa()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo_recorrencia = 'FIXA' AND NEW.ativo = TRUE THEN
        PERFORM processar_recorrencias_financeiras();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_gerar_recorrencias
AFTER INSERT OR UPDATE OF tipo_recorrencia ON financeiro_itens_plano
FOR EACH ROW
WHEN (NEW.tipo_recorrencia = 'FIXA')
EXECUTE FUNCTION trg_auto_gerar_fixa();
```

---

## 🚀 PLANO DE AÇÃO (v2.5.14)

### Passo 1: Corrigir DELETE de Categorias
- [ ] Criar migration `20260210120000_fix_delete_categories_v2_5_14.sql`
- [ ] Adicionar `GRANT DELETE` e `ON DELETE SET NULL` na FK
- [ ] Testar exclusão via UI

### Passo 2: Corrigir Atualização de Modalidade
- [ ] Modificar `handleSave` em `VisaoGestor.tsx` para fazer refresh duplo
- [ ] Validar que badges mudam imediatamente após edição

### Passo 3: Gerar Recorrências para Ano Inteiro
- [ ] Criar migration `20260210130000_full_year_recurrence_v2_5_14.sql`
- [ ] Executar `SELECT processar_recorrencias_financeiras();` manualmente
- [ ] Validar que aparecem 12 meses de "Aluguel" pendentes

### Passo 4: Deploy Git + Vercel
```bash
git add .
git commit -m "v2.5.14 - Fix: Exclusão de categorias, atualização de modalidade e recorrências anuais"
git push origin main
```

---

## 📊 VALIDAÇÃO PÓS-DEPLOY

1. **Teste de Exclusão:**
   - Criar categoria teste "Teste Delete"
   - Associar a 1 movimentação
   - Excluir a categoria → Deve funcionar
   - Movimentação antiga deve ficar com `item_financeiro_id = NULL`

2. **Teste de Modalidade:**
   - Editar "Aluguel" de VARIAVEL → FIXA
   - Verificar que badge muda instantaneamente na lista
   - Verificar que categoria está FIXA no banco

3. **Teste de Recorrências:**
   - Criar "Água" como FIXA, dia 10, R$ 80
   - Clicar "Gerar Recorrências"
   - Verificar que aparecem 12 lançamentos (Jan-Dez) na tabela

---

**Status Final:** 🟡 **PRONTO PARA IMPLEMENTAÇÃO**
