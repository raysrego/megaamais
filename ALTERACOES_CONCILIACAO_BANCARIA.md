# Alterações na Tela de Conciliação Bancária

## Data: 31/03/2026

### Resumo das Mudanças

A tela de Conciliação Bancária foi simplificada e otimizada para focar nos dados essenciais: **entradas auditadas dos TFLs** e **depósitos recebidos do cofre**.

---

## 1. Filtros Simplificados

### Antes:
- Filial
- Conta Bancária
- Mês de Referência

### Depois:
- **Filial** (mantido)
- **Mês de Referência** (mantido)
- ❌ Conta Bancária (removido - agora consolida todas as contas)

---

## 2. Cards de Resumo

### Cards sempre visíveis (mesmo com valores zerados):

#### Card 1: Total de Entradas Auditadas (TFL)
- Mostra o total de entradas provenientes dos fechamentos de caixa aprovados
- Detalhamento por forma de pagamento:
  - PIX
  - Dinheiro
- Quantidade de fechamentos aprovados no mês

#### Card 2: Depósitos Recebidos
- Mostra o total de valores debitados do cofre e depositados em contas bancárias
- Quantidade de depósitos registrados no mês
- Descrição: "Valores debitados do cofre e depositados em contas bancárias"

### Removidos:
- ❌ Card "Saldo Inicial"
- ❌ Card "Total Enviado ao Cofre"
- ❌ Card "Saldo Atual no Cofre"
- ❌ Seção "Conciliação do Cofre"

---

## 3. Histórico de Depósitos

### Título atualizado:
- **"Histórico de Depósitos Recebidos"**

### Filtros aprimorados:
1. **Data Início** (mantido)
2. **Data Fim** (mantido)
3. **Banco** (novo - filtro por texto)
4. **Operador** (novo - filtro por texto)

### Funcionalidades:
- Contador: "Exibindo X de Y depósitos"
- Botão "Limpar Filtros" para resetar todos os filtros de uma vez
- Ordenação por data decrescente

---

## 4. Mudanças no Banco de Dados

### Migration: `20260331030000_add_transferencia_banco_cofre.sql`

#### Alterações na tabela `cofre_movimentacoes`:

1. **Novo tipo de movimentação**: `transferencia_banco`
   - Constraint atualizada para incluir este novo tipo

2. **Novas colunas**:
   - `conta_bancaria_destino_id` (UUID) - Referência para `financeiro_contas_bancarias`
   - `usuario_id` (UUID) - Referência para `auth.users` (quem registrou)
   - `data_deposito` (TIMESTAMPTZ) - Data efetiva do depósito no banco

3. **Novos índices**:
   - `idx_cofre_movimentacoes_conciliacao` - Otimiza consultas de conciliação
   - `idx_caixa_fechamentos_conciliacao` - Otimiza consultas de fechamentos aprovados

4. **Nova view**: `vw_depositos_recebidos`
   - Consolida informações de depósitos com dados de banco, conta e operador
   - Facilita consultas na tela de conciliação
   - Filtra apenas movimentações do tipo `transferencia_banco` não deletadas

---

## 5. Lógica de Negócio

### Cálculo de Entradas Auditadas:
```typescript
// Busca fechamentos de caixa aprovados no mês
SELECT total_entradas_pix, total_entradas_dinheiro, 
       total_bolao_pix, total_bolao_dinheiro
FROM caixa_fechamentos
WHERE loja_id = ? 
  AND status = 'aprovado'
  AND data_fechamento BETWEEN ? AND ?
```

### Cálculo de Depósitos Recebidos:
```typescript
// Busca transferências do cofre para banco no mês
SELECT * FROM cofre_movimentacoes
WHERE loja_id = ?
  AND tipo = 'transferencia_banco'
  AND data_movimentacao BETWEEN ? AND ?
  AND deleted_at IS NULL
```

---

## 6. Comportamento da Interface

### Cards sempre exibem valores:
- Se não houver dados: **R$ 0,00**
- Se houver dados: **Valor calculado**

### Mensagem de estado vazio:
Aparece apenas quando **nenhuma filial está selecionada**:
> "Selecione uma filial e mês para visualizar a conciliação"

### Loading:
- Exibido durante carregamento inicial
- Exibido ao trocar filtros (filial/mês)

---

## 7. Melhorias de Performance

1. **Índices otimizados** para consultas frequentes
2. **Consultas separadas** para evitar joins complexos
3. **View pré-calculada** para depósitos recebidos
4. **Filtros do lado do cliente** para histórico de depósitos

---

## 8. Próximos Passos

Para aplicar as mudanças no banco de dados de produção:

```bash
# Aplicar a migration
psql -f supabase/migrations/20260331030000_add_transferencia_banco_cofre.sql
```

Ou usando a ferramenta Supabase:
```bash
supabase db push
```

---

## Arquivos Modificados

1. **Frontend**:
   - `src/app/(dashboard)/conciliacao/page.tsx`

2. **Migrations**:
   - `supabase/migrations/20260331030000_add_transferencia_banco_cofre.sql` (nova)

3. **Documentação**:
   - `ALTERACOES_CONCILIACAO_BANCARIA.md` (este arquivo)
