# Fluxo de Desenvolvimento e Deploy — MegaMais

**Versão:** Beta v2.5.15  
**Última Atualização:** 10/02/2026

---

## 🚀 Como funciona o Deploy Automático?

O projeto está configurado com **Integração Contínua (CI/CD)** via Vercel.

Sempre que um código novo é enviado para a branch `main` do GitHub, a Vercel detecta, realiza o build e coloca no ar automaticamente.

---

## ⚠️ REGRA DE OURO

> **NUNCA faça push sem rodar `npm run build` com sucesso.**
>
> Se o build falhar no seu PC, ele vai falhar na Vercel e **derrubar o sistema em produção**.

---

## 🛠️ Fluxo de Trabalho

### 1. Antes de começar
```bash
git pull origin main
npm install  # Caso haja mudanças no package.json
```

### 2. Durante o desenvolvimento
```bash
npm run dev
# Testar tudo em http://localhost:3000
```

### 3. Antes de subir (OBRIGATÓRIO)
```bash
npm run build
# ✅ Se passar → Pode subir
# ❌ Se falhar → CORRIJA antes de continuar
```

### 4. Enviar para produção
```bash
git add .
git commit -m "v2.5.15 - Descrição clara do que foi feito"
git push origin main
```

### 5. Monitorar
- Acompanhe o deploy no [Dashboard da Vercel](https://vercel.com/dashboard).
- Verifique se o status mudou para **"Ready"** (verde).

---

## 📦 Variáveis de Ambiente e Banco de Dados

### Variáveis
- Se criar uma nova variável no `.env.local`, lembre-se de adicioná-la também no painel da Vercel (**Settings > Environment Variables**).

### Migrations (Banco de Dados)
- A Vercel **não** executa migrations. Elas precisam ser aplicadas manualmente no SQL Editor do Supabase.
- Sempre crie um arquivo em `supabase/migrations/` com formato: `YYYYMMDDHHMMSS_descricao.sql`.
- Execute o script no Supabase **antes** de fazer push do código que depende dele.

---

## 🆘 Resolução de Problemas

| Problema | Solução |
|----------|---------|
| Tela travada em "Aguarde..." | Falta de dados no banco. Acesse `/debug-deploy` |
| Build falha na Vercel | Rode `npm run build` localmente para diagnosticar |
| Módulo financeiro vazio | Verifique se as migrations de recorrências foram aplicadas |
| Erro de permissão | Confirme que o usuário tem role `admin` em `perfis` |

---

**Status Atual:** ✅ Configurado e Operacional (Beta v2.5.15)
