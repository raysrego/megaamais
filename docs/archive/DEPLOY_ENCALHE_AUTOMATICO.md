# 📘 Guia de Deploy - Encalhe Automático

## 🎯 Edge Function Criada

**Arquivo:** `supabase/functions/cron-encalhe/index.ts`

---

## 📋 Passo a Passo para Deploy

### 1️⃣ Instalar Supabase CLI (se ainda não tiver)

```bash
npm install -g supabase
```

### 2️⃣ Fazer Login no Supabase

```bash
supabase login
```

### 3️⃣ Linkar com seu Projeto

```bash
supabase link --project-ref [SEU_PROJECT_ID]
```

Para encontrar o `PROJECT_ID`:
- Acesse: https://supabase.com/dashboard/project/[PROJECT-ID]/settings/general
- Copie o "Reference ID"

### 4️⃣ Deploy da Edge Function

```bash
cd "C:\Users\ROQUE MATCON\Documents\Giroz Sistemas\prototipos\megab_next"

# Deploy
supabase functions deploy cron-encalhe
```

### 5️⃣ Configurar Variáveis de Ambiente (Automático)

As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo Supabase nas Edge Functions.

---

## ⏰ Configurar Cron Job (Automação)

### Opção A: Via Supabase Dashboard (RECOMENDADO)

1. Acesse: https://supabase.com/dashboard/project/[PROJECT_ID]/database/cron-jobs
2. Clique em "Create a cron job"
3. Configure:
   - **Name:** `processar-encalhe-automatico`
   - **Schedule:** `*/30 * * * *` (A cada 30 minutos)
   - **Command:**
   ```sql
   SELECT net.http_post(
       url := 'https://[PROJECT-ID].supabase.co/functions/v1/cron-encalhe',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
   );
   ```

**IMPORTANTE:** Substitua `[PROJECT-ID]` pelo seu Project Reference ID!

---

### Opção B: Via SQL (Alternativa)

Execute este SQL no editor do Supabase:

```sql
-- Habilitar extensão pg_net se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar cron job
SELECT cron.schedule(
    'processar-encalhe-automatico',
    '*/30 * * * *',  -- A cada 30 minutos
    $$
    SELECT net.http_post(
        url := 'https://afrwsvhblgduvrwocwdx.supabase.co/functions/v1/cron-encalhe',
        headers := '{"Authorization": "Bearer [SEU_ANON_KEY]"}'::jsonb
    ) as request_id;
    $$
);
```

**Substitua:**
- `afrwsvhblgduvrwocwdx` pelo seu PROJECT_ID
- `[SEU_ANON_KEY]` pela sua chave anon (encontrada em Project Settings > API)

---

## 🧪 Testar a Edge Function Manualmente

### Via Terminal (Curl)

```bash
curl -L -X POST 'https://[PROJECT-ID].supabase.co/functions/v1/cron-encalhe' \
  -H 'Authorization: Bearer [ANON_KEY]' \
  -H 'Content-Type: application/json' \
  --data '{}'
```

### Via Postman/Insomnia

```
POST https://[PROJECT-ID].supabase.co/functions/v1/cron-encalhe
Headers:
  Authorization: Bearer [ANON_KEY]
  Content-Type: application/json
Body: {}
```

**Resposta Esperada:**
```json
{
  "success": true,
  "timestamp": "2026-02-03T13:25:00.000Z",
  "boloesProcessados": 2,
  "cotasEncalhadas": 15
}
```

---

## 📊 Monitorar Execuções

### 1. Logs da Edge Function

```bash
supabase functions logs cron-encalhe --follow
```

Ou no Dashboard:
- https://supabase.com/dashboard/project/[PROJECT-ID]/functions/cron-encalhe/logs

### 2. Verificar Cron Jobs

```sql
SELECT * FROM cron.job WHERE jobname = 'processar-encalhe-automatico';
```

### 3. Histórico de Execuções

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'processar-encalhe-automatico')
ORDER BY start_time DESC 
LIMIT 10;
```

---

## 🔧 Ajustar Frequência do Cron

### Exemplos de Configuração:

```sql
-- A cada 15 minutos
'*/15 * * * *'

-- A cada 1 hora
'0 * * * *'

-- Apenas durante horário comercial (9h-18h)
'0 9-18 * * *'

-- Apenas de segunda a sexta
'*/30 * * * 1-5'
```

Para atualizar:

```sql
SELECT cron.unschedule('processar-encalhe-automatico');

SELECT cron.schedule(
    'processar-encalhe-automatico',
    '[NOVA_FREQUENCIA]',
    $$ [MESMO_COMANDO] $$
);
```

---

## 🚨 Troubleshooting

### Erro: "Function not found"
- Verifique se o deploy foi feito: `supabase functions list`
- Tente fazer deploy novamente

### Erro: "Permission denied"
- Certifique-se de estar usando SERVICE_ROLE_KEY no cron
- Verifique grants da função RPC

### Cron não executa
```sql
-- Verificar se cron está habilitado
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Se não estiver, habilitar
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Logs não aparecem
- Aguarde alguns minutos após deploy
- Verifique filtros de data no dashboard
- Use `--follow` no CLI para tempo real

---

## ✅ Checklist Final

- [ ] Edge Function deployada (`supabase functions deploy cron-encalhe`)
- [ ] Cron job configurado (via Dashboard ou SQL)
- [ ] Teste manual executado com sucesso
- [ ] Logs monitorados por 1h para confirmar execução
- [ ] Migration `20260203160000_auditoria_unificada.sql` aplicada
- [ ] Frontend atualizado (SalesAuditTab)

**Após isso, o sistema processará encalhes automaticamente a cada 30 minutos!** 🚀

---

## 📞 Suporte

- Logs da Edge Function: `supabase functions logs cron-encalhe`
- Docs oficiais: https://supabase.com/docs/guides/functions
- Discord Supabase: https://discord.supabase.com
