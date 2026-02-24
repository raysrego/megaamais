# Sprint 8: Edge Functions - MegaB

Sistema de processamento serverless para relatórios pesados e operações assíncronas.

## 📁 Estrutura Criada

```
supabase/
  functions/
    ├── _shared/
    │   ├── cors.ts              # Utilitários CORS
    │   └── database.ts          # Cliente Supabase
    ├── gerar-relatorio-financeiro/
    │   └── index.ts             # DRE e análise financeira
    ├── gerar-relatorio-boloes/
    │   └── index.ts             # CMV e lucratividade
    └── exportar-pdf/
        └── index.ts             # Exportação de PDFs (mock)

src/
  hooks/
    └── useEdgeFunctions.ts      # Hook para consumir functions
  components/
    └── TestadorEdgeFunctions.tsx # Componente de teste
```

---

## 🚀 Edge Functions Disponíveis

### 1. **gerar-relatorio-financeiro**
Gera DRE (Demonstrativo de Resultados) com:
- Total de receitas e despesas
- Lucro líquido e margem de lucro
- Detalhamento por categoria
- Análise mensal para gráficos

**Parâmetros:**
```typescript
{
  ano: number;
  mes?: number;      // 0 = ano todo
  loja_id?: string;  // null = todas
}
```

**Retorno:**
```typescript
{
  periodo: string;
  geradoEm: string;
  resumo: {
    totalReceitas: number;
    totalDespesas: number;
    lucroLiquido: number;
    margemLucro: string;
  };
  detalhamento: {
    receitas: Array<{ item: string, total: number }>;
    despesas: Array<{ item: string, total: number }>;
  };
  analiseAnual: Array<{
    mes: number;
    mesNome: string;
    receitas: number;
    despesas: number;
    lucro: number;
  }>;
}
```

---

### 2. **gerar-relatorio-boloes**
Análise completa de bolões com CMV e lucratividade:
- CMV (Custo da Mercadoria Vendida)
- Margem de contribuição
- Comissões (operador + master)
- Lucro líquido

**Parâmetros:**
```typescript
{
  periodo_inicio?: string;
  periodo_fim?: string;
  loja_id?: string;
  status?: 'ativo' | 'encerrado' | 'cancelado';
}
```

**Retorno:**
```typescript
{
  periodo: { inicio: string, fim: string };
  geradoEm: string;
  resumo: {
    totalBoloes: number;
    cotasVendidas: number;
    faturamentoTotal: number;
    cmvTotal: number;
    lucroBruto: number;
    comissoesTotal: number;
    lucroLiquido: number;
    margemMedia: number;
  };
  boloes: Array<{
    bolao_id: string;
    uid: string;
    modalidade: string;
    financeiro: { ... };
  }>;
}
```

---

### 3. **exportar-pdf**
Exporta relatórios como PDF (atualmente mock, pronto para integração).

**Sugestões de Integração:**
- **Frontend**: `jsPDF` ou `react-pdf`
- **Backend**: API PDFShift (https://pdfshift.io)

---

## 🔧 Como Usar

### 1. Deploy das Functions

```bash
# Fazer login
supabase login

# Linkar projeto
supabase link --project-ref SEU_PROJECT_REF

# Deploy
supabase functions deploy gerar-relatorio-financeiro
supabase functions deploy gerar-relatorio-boloes
supabase functions deploy exportar-pdf
```

### 2. Consumir no Frontend

```typescript
import { useEdgeFunctions } from '@/hooks/useEdgeFunctions';

function MeuComponente() {
  const { gerarRelatorioFinanceiro, loading } = useEdgeFunctions();

  const handleGerar = async () => {
    const resultado = await gerarRelatorioFinanceiro({
      ano: 2026,
      mes: 2
    });
    
    console.log('DRE:', resultado);
  };

  return (
    <button onClick={handleGerar} disabled={loading}>
      Gerar DRE
    </button>
  );
}
```

### 3. Testar no Sistema

Adicione o componente de teste em qualquer página:

```tsx
import { TestadorEdgeFunctions } from '@/components/TestadorEdgeFunctions';

export default function MinhaPage() {
  return (
    <>
      {/* Seu código */}
      <TestadorEdgeFunctions /> {/* Painel de testes flutuante */}
    </>
  );
}
```

---

## 🎯 Vantagens das Edge Functions

1. **Performance**: Processa relatórios pesados sem travar o navegador
2. **Escalabilidade**: Roda no edge (próximo ao usuário) com auto-scaling
3. **Segurança**: Lógica de negócio sensível fica no servidor
4. **Economia**: Só cobra pelo tempo de execução (pay-per-use)

---

## 📊 Próximos Passos

- [ ] Integrar geração real de PDFs (PDFShift ou jsPDF)
- [ ] Criar função para envio de relatórios por e-mail
- [ ] Adicionar cache para relatórios frequentes
- [ ] Implementar webhook para notificações em tempo real
- [ ] Criar função para importação de planilhas (Sprint 9)

---

## 📚 Documentação Completa

Ver: `supabase/DEPLOY_FUNCTIONS.md`

**Status da Sprint 8: ✅ Infraestrutura Pronta**
