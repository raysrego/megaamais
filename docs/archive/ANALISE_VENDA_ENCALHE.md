# 🔍 Análise: Venda de Cotas & Encalhe Automático

**Data:** 2026-02-03 10:13  
**Status:** Verificação de funcionalidades existentes

---

## ✅ SITUAÇÃO ATUAL

### 1. **Modal de Venda de Cotas** 
**Status:** ✅ **JÁ EXISTE**

- Interface visual confirmada pelo usuário (modal "LOTERIAS CAIXA")
- Mostra bolões por loteria (+Milionária, etc)
- Permite selecionar cotas para venda
- **Backend:** Função `registrarVendaBolao()` implementada (RPC atômica)

### 2. **Registro de Vendedor (NOME vs ID)**
**Status:** ✅ **JÁ IMPLEMENTADO CORRETAMENTE**

**View de Auditoria:**
```sql
CREATE OR REPLACE VIEW public.vw_auditoria_vendas_detalhada AS
SELECT 
    v.id as venda_id,
    v.created_at as data_venda,
    u.nome as vendedor,  -- ✅ NOME do usuário (Ane, Ildo, Patricia)
    p.nome as loteria,
    b.concurso,
    v.quantidade_cotas,
    v.valor_total,
    v.metodo_pagamento,
    l.nome_fantasia as filial
FROM public.vendas_boloes v
JOIN public.perfis u ON u.id = v.usuario_id  -- ✅ JOIN com perfis
JOIN public.boloes b ON b.id = v.bolao_id
JOIN public.produtos p ON p.id = b.produto_id
LEFT JOIN public.lojas l ON l.id = u.loja_id;
```

**Server Action:**
```typescript
vendedor: item.vendedor  // ✅ Já retorna o NOME
```

**Componente Frontend (`SalesAuditTab`):**
```typescript
// ✅ Exibe o nome do vendedor na tabela
```

**Conclusão:** 🟢 Sistema JÁ registra e exibe o NOME do vendedor (não o ID).

---

## 🤖 ENCALHE AUTOMÁTICO

### Requisito do Usuário:
> "Eu quero que o sistema **automaticamente** marque as cotas que não foram vendidas **após a hora do sorteio** (tempo limite de venda) como Encalhe."

### Status Atual: 🟡 **SEMI-IMPLEMENTADO**

**O que JÁ existe:**

1. **Função SQL criada** (migration `20260202120000_motor_encalhe_v2.sql`):
```sql
CREATE OR REPLACE FUNCTION public.processar_encalhe_automatico()
RETURNS void AS $$
BEGIN
    -- Marcar cotas não vendidas como encalhe
    UPDATE public.cotas_boloes c
    SET status = 'encalhe_casa'
    FROM public.boloes b
    JOIN public.produtos p ON p.id = b.produto_id
    WHERE c.bolao_id = b.id
    AND c.status = 'disponivel'
    AND b.status = 'disponivel'
    AND (b.data_sorteio::timestamp + p.horario_fechamento::time) < NOW();
    
    -- Atualizar status do bolão para 'finalizado'
    UPDATE public.boloes b
    SET status = 'finalizado'
    FROM public.produtos p
    WHERE p.id = b.produto_id
    AND b.status = 'disponivel'
    AND (b.data_sorteio::timestamp + p.horario_fechamento::time) < NOW();
END;
$$ LANGUAGE plpgsql;
```

**✅ Lógica correta:**
- Verifica `data_sorteio + horario_fechamento` (ex: 20/02/2026 às 19:00)
- Compara com hora atual (fuso Brasília)
- Marca cotas disponíveis como `encalhe_casa`
- Atualiza bolão para `finalizado`

---

### 🔴 O que FALTA: AUTOMATIZAÇÃO

**Problema:** A função `processar_encalhe_automatico()` existe, mas **NÃO é chamada automaticamente**.

**Soluções possíveis:**

#### Opção 1: **Supabase Edge Function** (RECOMENDADO para deploy rápido)
```typescript
// supabase/functions/cron-encalhe/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  const { error } = await supabase.rpc('processar_encalhe_automatico')
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})
```

**Agendar com Supabase Cron:**
```sql
SELECT cron.schedule(
    'processar-encalhe',
    '*/30 * * * *',  -- A cada 30 minutos
    $$
    SELECT net.http_post(
        url := 'https://[PROJECT_ID].supabase.co/functions/v1/cron-encalhe',
        headers := '{"Authorization": "Bearer [ANON_KEY]"}'::jsonb
    );
    $$
);
```

**✅ Vantagens:**
- Nativo do Supabase
- Grátis no plano free
- Fácil de configurar

---

#### Opção 2: **pg_cron** (Postgres Nativo)
```sql
-- Requer extensão pg_cron (disponível no Supabase)
SELECT cron.schedule(
    'processar-encalhe',
    '*/30 * * * *',
    'SELECT public.processar_encalhe_automatico();'
);
```

**⚠️ Atenção:** Supabase pode ter limitações no plano free para pg_cron.

---

#### Opção 3: **Next.js Route Handler + Vercel Cron** (Se deploy no Vercel)
```typescript
// app/api/cron/encalhe/route.ts
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  // Verificar segredo (Vercel Cron Header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase.rpc('processar_encalhe_automatico')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
```

**vercel.json:**
```json
{
  "crons": [{
    "path": "/api/cron/encalhe",
    "schedule": "*/30 * * * *"
  }]
}
```

**✅ Vantagens:**
- Integrado com o deploy Next.js
- Logs visíveis no Vercel Dashboard
- Grátis no plan Pro (não no Hobby)

---

## 📊 AUDITORIA DE ENCALHE

### Requisito:
> "Os registros de vendas de cada cota, cada encalhe e suas classificações e detalhes fiquem registradas como um arquivo de venda na aba de Auditoria de Vendas."

### Status: 🟡 **PARCIALMENTE IMPLEMENTADO**

**O que JÁ existe:**
- ✅ `vw_auditoria_vendas_detalhada` mostra vendas
- ✅ Registra vendedor, loteria, concurso, valor, método

**O que FALTA:**
- 🔴 Encalhes NÃO aparecem na auditoria (apenas vendas)
- 🔴 Não há campo para distinguir "venda" vs "encalhe"

---

### Solução Proposta: **Unificar Auditoria**

#### 1. Criar View Unificada (Vendas + Encalhes)
```sql
CREATE OR REPLACE VIEW public.vw_auditoria_completa AS
-- VENDAS
SELECT 
    'venda'::TEXT as tipo_registro,
    v.id as registro_id,
    v.created_at as data_registro,
    u.nome as responsavel,
    p.nome as loteria,
    b.concurso,
    b.data_sorteio,
    c.uid as cota_uid,
    c.status as status_cota,
    v.valor_total / v.quantidade_cotas as valor_unitario,
    v.metodo_pagamento,
    l.nome_fantasia as filial
FROM public.vendas_boloes v
JOIN public.perfis u ON u.id = v.usuario_id
JOIN public.boloes b ON b.id = v.bolao_id
JOIN public.produtos p ON p.id = b.produto_id
JOIN public.cotas_boloes c ON c.bolao_id = b.id AND c.status = 'vendida'
LEFT JOIN public.lojas l ON l.id = u.loja_id

UNION ALL

-- ENCALHES
SELECT 
    'encalhe'::TEXT as tipo_registro,
    c.id as registro_id,
    COALESCE(c.data_venda, NOW()) as data_registro,
    'SISTEMA'::TEXT as responsavel,
    p.nome as loteria,
    b.concurso,
    b.data_sorteio,
    c.uid as cota_uid,
    c.status as status_cota,
    b.preco_venda_cota as valor_unitario,
    'N/A'::TEXT as metodo_pagamento,
    NULL as filial
FROM public.cotas_boloes c
JOIN public.boloes b ON b.id = c.bolao_id
JOIN public.produtos p ON p.id = b.produto_id
WHERE c.status = 'encalhe_casa'

ORDER BY data_registro DESC;
```

#### 2. Atualizar Server Action
```typescript
export async function getAuditoriaCompleta() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('vw_auditoria_completa')
        .select('*')
        .order('data_registro', { ascending: false });

    if (error) {
        console.error('Error fetching complete audit:', error);
        return [];
    }

    return (data || []).map(item => ({
        tipo: item.tipo_registro,  // 'venda' ou 'encalhe'
        id: item.registro_id,
        dataRegistro: item.data_registro,
        responsavel: item.responsavel,  // Nome vendedor ou 'SISTEMA'
        loteria: item.loteria,
        concurso: item.concurso,
        cotaUid: item.cota_uid,  // Ex: "KT-1234"
        statusCota: item.status_cota,
        valorUnitario: Number(item.valor_unitario),
        metodoPagamento: item.metodo_pagamento,
        filial: item.filial
    }));
}
```

#### 3. Atualizar Frontend (`SalesAuditTab`)
```tsx
// Adicionar coluna "Tipo" na tabela
{item.tipo === 'encalhe' ? (
    <span className="px-2 py-1 bg-warning/10 text-warning rounded text-xs">
        ENCALHE
    </span>
) : (
    <span className="px-2 py-1 bg-success/10 text-success rounded text-xs">
        VENDA
    </span>
)}

// Responsável
{item.tipo === 'encalhe' ? (
    <span className="text-muted italic">Sistema Automático</span>
) : (
    <span>{item.responsavel}</span>
)}
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### 🔴 Para HOJE (Deploy)

- [ ] **1. Escolher método de cron** (Recomendo Supabase Edge Function)
- [ ] **2. Criar Edge Function `cron-encalhe`**
- [ ] **3. Configurar cron job (a cada 30min)**
- [ ] **4. Criar migration com view unificada `vw_auditoria_completa`**
- [ ] **5. Atualizar Server Action `getAuditoriaCompleta()`**
- [ ] **6. Atualizar `SalesAuditTab` para mostrar vendas + encalhes**

### 🟡 Após Deploy (Melhorias)

- [ ] Adicionar notificação quando encalhe for processado
- [ ] Dashboard com KPI de "Taxa de Encalhe %"
- [ ] Relatório mensal de encalhe por loteria

---

## 🎯 RESUMO EXECUTIVO

| Item | Status | Ação Necessária |
|------|--------|----------------|
| **Modal de Venda** | ✅ Pronto | Nenhuma |
| **Nome do Vendedor na Auditoria** | ✅ Implementado | Nenhuma |
| **Função de Encalhe** | ✅ Criada | Automatizar chamada |
| **Cron/Agendamento** | 🔴 Faltando | Criar Edge Function + Cron |
| **Auditoria Unificada** | 🔴 Faltando | Criar view + atualizar frontend |

**Tempo estimado:** 1-2h para implementar tudo

---

## 🚀 RECOMENDAÇÃO

**Para deploy HOJE:**

1. **Implementar Supabase Edge Function + Cron** (30min)
2. **Criar view unificada de auditoria** (20min)
3. **Atualizar frontend da auditoria** (30min)
4. **Testar fluxo completo** (20min)

**Total:** ~1h30 de trabalho focado

**Quer que eu comece criando a Edge Function e a migration agora?** 🚀
