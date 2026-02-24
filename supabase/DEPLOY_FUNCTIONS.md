# Guia de Deploy - Edge Functions

Este guia mostra como fazer deploy das Edge Functions no Supabase Cloud.

## Pré-requisitos

1. **Instalar Supabase CLI**:
```bash
npm install -g supabase
```

2. **Login no Supabase**:
```bash
supabase login
```

3. **Linkar o projeto local ao Supabase Cloud**:
```bash
supabase link --project-ref SEU_PROJECT_REF
```
> Você encontra o `project-ref` no Dashboard do Supabase → Settings → General

---

## Deploy das Functions

### Deploy Individual

**Relatório Financeiro:**
```bash
supabase functions deploy gerar-relatorio-financeiro
```

**Relatório de Bolões:**
```bash
supabase functions deploy gerar-relatorio-boloes
```

**Exportar PDF:**
```bash
supabase functions deploy exportar-pdf
```

### Deploy de Todas de uma vez

```bash
supabase functions deploy --no-verify-jwt
```

---

## Testar Localmente (Antes do Deploy)

1. **Iniciar Supabase Local:**
```bash
supabase start
```

2. **Servir a function localmente:**
```bash
supabase functions serve gerar-relatorio-financeiro --env-file ./supabase/.env.local
```

3. **Testar via cURL:**
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/gerar-relatorio-financeiro' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"ano": 2026, "mes": 2}'
```

---

## Configurar Variáveis de Ambiente (se necessário)

Se suas functions precisarem de API keys (ex: PDFShift para geração de PDF):

```bash
supabase secrets set PDF_API_KEY=sua_chave_aqui
```

---

## Monitoramento

- **Logs em tempo real:**
```bash
supabase functions logs gerar-relatorio-financeiro
```

- **Ver erros no Dashboard:**
  Supabase Dashboard → Edge Functions → Logs

---

## Exemplo de Uso no Frontend

```typescript
import { useEdgeFunctions } from '@/hooks/useEdgeFunctions';

function MeuComponente() {
  const { gerarRelatorioFinanceiro, loading } = useEdgeFunctions();

  const handleGerar = async () => {
    const resultado = await gerarRelatorioFinanceiro({
      ano: 2026,
      mes: 2,
      loja_id: 'abc123'
    });
    
    console.log('Relatório:', resultado);
  };

  return (
    <button onClick={handleGerar} disabled={loading}>
      {loading ? 'Gerando...' : 'Gerar DRE'}
    </button>
  );
}
```

---

## Troubleshooting

**Erro: "function not found"**
→ Certifique-se de que fez o deploy: `supabase functions deploy nome-da-function`

**Erro: "CORS"**
→ As functions já incluem headers CORS. Se persistir, verifique o domínio no arquivo `cors.ts`

**Erro: "unauthorized"**
→ Certifique-se de que está enviando o token de autenticação no header `Authorization`
