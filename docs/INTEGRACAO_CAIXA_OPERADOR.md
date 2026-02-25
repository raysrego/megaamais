# Integração de Movimentações do Operador

## Visão Geral

Este documento descreve como todas as movimentações do operador são compartilhadas e refletidas entre os diferentes componentes do sistema de caixa.

## Arquitetura de Dados

### Tabela Central: `caixa_movimentacoes`

Todas as movimentações passam pela tabela `caixa_movimentacoes`, que é a fonte única de verdade para:
- Movimentações do Caixa TFL (Terminal)
- Vendas de Bolões
- Sangrias e Depósitos no Cofre
- Todas as entradas e saídas registradas

```sql
caixa_movimentacoes
├── id (PK)
├── sessao_id (FK -> caixa_sessoes)
├── tipo (entrada/saida/sangria/deposito/etc)
├── valor
├── descricao
├── metodo_pagamento
├── categoria_operacional_id (FK)
└── created_at
```

## Componentes e Seus Papéis

### 1. **VisaoOperadorCaixa** (`src/components/caixa/VisaoOperadorCaixa.tsx`)

**Responsabilidade:** Interface principal do operador para gerenciar caixa TFL e Bolão

**Funcionalidades:**
- Abertura de sessão de caixa
- Lançamento de movimentações via `ModalMovimentacaoGeral`
- Exibição de histórico de movimentações em tempo real
- Fechamento de caixa TFL
- Acesso ao Caixa Bolão (via abas)

**Integração:**
- Usa hook `useCaixa()` para gerenciar sessão e movimentações
- Todas as movimentações são salvas via `registrarMovimentacao()`
- Hook se conecta automaticamente à tabela `caixa_movimentacoes`

### 2. **ModalMovimentacaoGeral** (`src/components/caixa/ModalMovimentacaoGeral.tsx`)

**Responsabilidade:** Modal unificado para lançamento de todas as movimentações operacionais

**Funcionalidades:**
- Seleção de tipo: Entrada ou Saída
- Categorias dinâmicas da tabela `categorias_operacionais`
- **Atalhos rápidos para Sangria e Cofre** (quando saída selecionada)
- Detecção automática de tipo baseado na categoria
  - Categoria com "sangria" → `tipo: 'sangria'`
  - Categoria com "cofre" ou "deposito" → `tipo: 'deposito'`
- Valor, data e descrição personalizáveis

**Integração:**
- Recebe callback `onSave` que chama `registrarMovimentacao()` do `useCaixa`
- Movimentação é inserida em `caixa_movimentacoes` com `sessao_id` da sessão ativa
- Atualiza automaticamente o saldo calculado da sessão

### 3. **VisaoGestorCaixa** (`src/components/caixa/VisaoGestorCaixa.tsx`)

**Responsabilidade:** Visão consolidada de todas as sessões e movimentações para gestores

**Funcionalidades:**
- Feed em tempo real de todas as movimentações (Supabase Realtime)
- KPIs consolidados (saldo, sangrias, entradas)
- Status de terminais ativos
- Auditoria de fechamentos

**Integração:**
- Usa hook `useGestorCaixa()` para buscar todas as sessões e movimentações
- Consulta `caixa_movimentacoes` com join em `caixa_sessoes`
- Exibe movimentações de TODOS os operadores em tempo real
- **Reflexão automática:** Quando operador lança movimentação, aparece aqui instantaneamente

### 4. **ModalFechamentoCaixaBolao** (`src/components/caixa/ModalFechamentoCaixaBolao.tsx`)

**Responsabilidade:** Fechamento específico do Caixa Bolão

**Funcionalidades:**
- Consolidação de vendas de bolões por operador
- Conferência de valores (dinheiro vs PIX)
- Registro de divergências
- Fechamento da sessão Bolão

**Integração:**
- Usa hook `useCaixaBolao()` para gerenciar vendas
- Vendas de bolão são registradas em `vendas_boloes`
- **Importante:** Vendas de bolão NÃO vão para `caixa_movimentacoes` (fluxo separado)
- Mas sangrias/depósitos feitos pelo operador vão para `caixa_movimentacoes`

### 5. **Página do Operador** (`src/app/(dashboard)/operador/page.tsx`)

**Responsabilidade:** Hub de performance e histórico do operador

**Funcionalidades:**
- Aba "Meu Desempenho": Vendas e comissões
- **Aba "Minhas Movimentações"**: Histórico completo de entradas/saídas
- Aba "Gestão de Equipe": Performance da equipe (gestores)

**Integração:**
- Nova aba usa hook `useMovimentacoesOperador()`
- Busca movimentações de TODAS as sessões do operador
- Filtro por data
- Exibe: tipo, categoria, valor, loja, sessão
- **Reflexão total:** Toda movimentação feita em qualquer componente aparece aqui

## Fluxo de Dados Completo

```
Operador abre ModalMovimentacaoGeral
        ↓
Seleciona tipo (Entrada/Saída)
        ↓
Clica atalho "Sangria" ou "Cofre" OU seleciona categoria manual
        ↓
Preenche valor, data, descrição
        ↓
Confirma → onSave() callback
        ↓
VisaoOperadorCaixa recebe e chama registrarMovimentacao()
        ↓
useCaixa() faz INSERT em caixa_movimentacoes
        {
          sessao_id: sessao_ativa.id,
          tipo: 'sangria' | 'deposito' | 'entrada' | 'saida',
          valor: -100 (se saída),
          categoria_operacional_id: 5,
          metodo_pagamento: 'dinheiro',
          descricao: 'Sangria para cofre',
          created_at: now()
        }
        ↓
Trigger/Function atualiza valor_final_calculado da sessão
        ↓
Supabase Realtime notifica todos os componentes conectados
        ↓
┌─────────────────────────────────────────────────────┐
│ REFLEXÃO AUTOMÁTICA EM TEMPO REAL:                  │
├─────────────────────────────────────────────────────┤
│ ✓ VisaoOperadorCaixa → Atualiza lista lateral      │
│ ✓ VisaoGestorCaixa → Aparece no feed ao vivo       │
│ ✓ Página Operador → Aparece na aba Movimentações   │
│ ✓ Saldo da sessão → Recalculado automaticamente    │
└─────────────────────────────────────────────────────┘
```

## Hooks e Suas Responsabilidades

### `useCaixa()`
- Gerencia sessão ativa do operador
- CRUD de movimentações
- Abertura e fechamento de caixa TFL
- Subscrição Realtime em `caixa_movimentacoes` da sessão ativa

### `useGestorCaixa()`
- Visão consolidada de TODAS as sessões
- Movimentações recentes de todos os operadores
- KPIs calculados em tempo real
- Subscrição Realtime em TODAS as movimentações

### `useCaixaBolao()`
- Gerenciamento de vendas de bolões
- Cálculo de totais por sessão
- Fechamento de sessão Bolão
- **Separado:** Não usa `caixa_movimentacoes`, usa `vendas_boloes`

### `useMovimentacoesOperador()`
- Histórico completo de movimentações do operador
- Busca por múltiplas sessões
- Filtro por data
- Enriquecimento com dados de loja e sessão

## Políticas RLS (Row Level Security)

### `caixa_movimentacoes`

**Operador:**
- SELECT: Apenas suas próprias sessões
- INSERT: Apenas em suas sessões ativas
- UPDATE: Apenas suas movimentações não deletadas
- DELETE: Soft delete apenas suas movimentações

**Gestor/Admin:**
- SELECT: Todas as movimentações da empresa
- UPDATE: Todas as movimentações
- DELETE: Todas as movimentações

**Garantia:** RLS garante que operador só vê/modifica suas próprias movimentações, mas gestor vê tudo.

## Categorias Operacionais

Categorias são configuradas em `categorias_operacionais` por empresa:

**Exemplos de Saídas:**
- Sangria (tipo: 'saida') → vira tipo 'sangria' na movimentação
- Depósito Cofre (tipo: 'saida') → vira tipo 'deposito' na movimentação
- Pagamento Fornecedor (tipo: 'saida') → vira tipo 'pagamento'

**Exemplos de Entradas:**
- Venda Balcão (tipo: 'entrada') → vira tipo 'venda'
- PIX Recebido (tipo: 'entrada') → vira tipo 'pix'
- Suprimento (tipo: 'entrada') → vira tipo 'suprimento'

## Atalhos Rápidos no Modal

Quando o operador seleciona **"Saída"**, aparecem dois botões de atalho:

1. **🔻 Sangria**
   - Auto-seleciona categoria "Sangria"
   - Tipo: 'sangria'
   - Reduz saldo do caixa
   - Aparece em relatórios de auditoria

2. **🔒 Cofre**
   - Auto-seleciona categoria "Depósito Cofre" ou "Cofre"
   - Tipo: 'deposito'
   - Registra transferência para cofre
   - Rastreável para conciliação

## Validação e Auditoria

### Fechamento de Caixa TFL
- Operador informa valor físico contado
- Sistema compara com `valor_final_calculado` (soma de movimentações)
- Se divergência > R$ 0.01, exige justificativa
- Status vai para 'pendente' validação gerencial

### Auditoria Gerencial
- Gestor vê todas as sessões pendentes
- Pode aprovar ou rejeitar fechamentos
- Registra observações
- Histórico completo mantido

### Rastreabilidade
- Toda movimentação tem timestamp
- Operador identificado via `sessao.operador_id`
- Categoria rastreada
- Método de pagamento registrado
- Comprovantes podem ser anexados (futura implementação)

## Realtime e Performance

### Supabase Realtime
- Todos os componentes usam subscriptions
- Atualizações instantâneas sem polling
- Filtros aplicados no servidor via RLS
- Baixo overhead de rede

### Otimizações
- Consultas com índices em `sessao_id`, `operador_id`, `created_at`
- Views materializadas para KPIs agregados
- Lazy loading de histórico com paginação
- Cache de sessão ativa no hook

## Casos de Uso

### Caso 1: Operador faz sangria
1. Abre `ModalMovimentacaoGeral`
2. Clica "Saída"
3. Clica atalho "Sangria"
4. Informa R$ 500,00
5. Adiciona descrição "Sangria horário de pico"
6. Confirma
7. **Resultado:**
   - Saldo caixa reduz R$ 500
   - Movimentação aparece na lateral
   - Gestor vê no feed ao vivo
   - Aba "Minhas Movimentações" atualiza

### Caso 2: Operador deposita no cofre
1. Abre `ModalMovimentacaoGeral`
2. Clica "Saída"
3. Clica atalho "Cofre"
4. Informa R$ 1.000,00
5. Confirma
6. **Resultado:**
   - Tipo 'deposito' registrado
   - Saldo caixa reduz R$ 1.000
   - Cofre atualiza (via reconciliação)
   - Rastreável para auditoria

### Caso 3: Gestor audita movimentações
1. Acessa `VisaoGestorCaixa`
2. Vê feed ao vivo de movimentações
3. Identifica sangria de R$ 500
4. Verifica operador e horário
5. Confere contra procedimento
6. **Resultado:**
   - Transparência total
   - Rastreabilidade completa
   - Base para decisões

## Próximas Melhorias

1. **Upload de Comprovantes**
   - Anexar fotos/PDFs nas movimentações
   - Storage Supabase integrado

2. **Limites e Alertas**
   - Limite de sangria por operador
   - Notificações em tempo real
   - Bloqueio automático se limite excedido

3. **Reconciliação Automática**
   - Match de depósitos com entradas no cofre
   - Detecção de divergências
   - Sugestão de correções

4. **Relatórios Avançados**
   - Exportação Excel/PDF
   - Gráficos de tendência
   - Análise por período/operador/categoria

## Conclusão

O sistema de movimentações do operador é completamente integrado e compartilhado entre todos os componentes. A tabela `caixa_movimentacoes` é a fonte única de verdade, garantindo:

✅ **Consistência:** Uma movimentação, múltiplas visualizações
✅ **Tempo Real:** Supabase Realtime para atualizações instantâneas
✅ **Auditoria:** Rastreabilidade completa de ações
✅ **Segurança:** RLS garante acesso apropriado
✅ **Performance:** Índices e otimizações para escala

Todos os componentes confiam na mesma fonte de dados e refletem mudanças automaticamente.
