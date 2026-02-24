# Guia de Deploy — MegaMais (Vercel)

**Versão:** Beta v2.5.15  
**Última Atualização:** 10/02/2026

---

## Pré-requisitos

1. Conta na [Vercel](https://vercel.com).
2. Repositório GitHub conectado.
3. Projeto Supabase configurado e migrations aplicadas.

---

## 1. Configuração do Projeto na Vercel

1. Importe o projeto do repositório GitHub.
2. Framework Preset: **Next.js**.
3. Root Directory: `prototipos/megab_next` (monorepo).
4. Build Command: `npm run build`.
5. Install Command: `npm install`.

---

## 2. Variáveis de Ambiente

Configure na seção **Settings > Environment Variables** da Vercel:

| Variável | Descrição | Obrigatória |
|----------|-----------|:-----------:|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta (service_role) — **nunca expor no client!** | ✅ |
| `GOOGLE_VISION_API_KEY` | Google Cloud Vision (OCR, se aplicável) | Opcional |

> ⚠️ Se criar uma nova variável no `.env.local`, **adicione-a também na Vercel**.

---

## 3. Migrations (Banco de Dados)

> **A Vercel NÃO executa migrations.** O deploy só atualiza o código frontend.

Para alterações no banco de dados:
1. Crie um script SQL em `supabase/migrations/` com o formato: `YYYYMMDDHHMMSS_descricao.sql`
2. Execute o script no **SQL Editor** do Supabase (painel web).
3. Faça commit do arquivo de migration junto com o código.

---

## 4. Checklist Pós-Deploy

Após o deploy ser concluído na Vercel (status "Ready"):

1. ✅ Acesse a URL de produção.
2. ✅ Faça login com um usuário admin.
3. ✅ Verifique o **Dashboard Financeiro** — KPIs e gráficos carregando.
4. ✅ Verifique **Cadastros > Categorias** — lista de itens financeiros visível.
5. ✅ Abra o **Caixa** e inicie uma sessão.
6. ✅ Se houver problemas, acesse `/debug-deploy` para diagnóstico.

---

## 5. Solução de Problemas

| Problema | Solução |
|----------|---------|
| Erro de Build | Rode `npm run build` localmente e corrija antes de fazer push |
| Conexão Supabase falha | Verifique variáveis de ambiente (sem espaços extras) |
| Tabelas não encontradas | Execute as migrations pendentes no SQL Editor do Supabase |
| Tela travada em "Aguarde..." | Acesse `/debug-deploy` para diagnóstico detalhado |
| Dados financeiros não aparecem | Verifique se a migration de recorrências foi aplicada |

---

**Status do Build:** ✅ Aprovado (Beta v2.5.15)
