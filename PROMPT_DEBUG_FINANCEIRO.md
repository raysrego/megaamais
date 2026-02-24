# Prompt para Próximo Agente: Debugging Lento/Intermitente no Financeiro

## Contexto Atual
O sistema está em **Next.js + Supabase**. Acabamos de realizar a importação da filial **Aririzal** e seus itens financeiros.
O usuário relata que, **mesmo com os dados cadastrados (categorias de receita/despesa)**, o front-end falha intermitentemente em carregar essas categorias na tela `SaneamentoDadosFinanceiros`.
A conexão parece "lenta" e muitas vezes o combo box de categorias vem vazio ou demora a popular.

## Sintomas
1.  **Lentidão:** O banco demora a responder queries simples de `financeiro_itens_plano`.
2.  **Falha Silenciosa:** O `useItensFinanceiros` retorna lista vazia ou incompleta às vezes.
3.  **Contexto:** Isso começou a ficar mais evidente após a inserção de muitos itens e a segregação de lojas (Aririzal vs Natureza).

## Suspeitas Técnicas (Investigar nesta ordem)

### 1. RLS (Row Level Security) Mal Otimizado
As políticas de segurança em `financeiro_itens_plano` e `financeiro_contas` podem estar fazendo queries recursivas ou pesadas.
*   **Verificar:** Se as policies usam funções como `get_my_loja_id()` que fazem selects na tabela `perfis` ou `lojas` repetidamente para CADA linha.
*   **Ação:** Otimizar RLS para usar `auth.jwt()` claims se possível, ou criar índices nas colunas usadas nas policies (`loja_id`, `ativo`).

### 2. Falta de Índices (Database Indexing)
A tabela `financeiro_itens_plano` cresceu.
*   **Verificar:** Se existe índice em `loja_id` E `ativo`.
*   **Query Lenta:** O front faz `select * from financeiro_itens_plano where arquivado = false and (loja_id = X or loja_id is null) order by ordem`. Sem índice composto `(loja_id, arquivado)`, isso vira um Scan sequencial pesado.

### 3. Frontend: Race Conditions no `useItensFinanceiros`
O hook `useItensFinanceiros` pode estar sendo chamado múltiplas vezes desnecessariamente ou cancelando requests.
*   **Verificar:** Se o `useEffect` que chama `fetchItens` não está num loop infinito ou dependendo de variáveis instáveis.

### 4. Conexão Supabase (Realtime vs REST)
O sistema pode estar tentando abrir muitos canais de Realtime, o que gargala a conexão em planos gratuitos ou limitados.
*   **Verificar:** Se o `supabase-browser` está criando múltiplas instâncias do cliente.

## Objetivo da Sessão
Realizar um **Diagnóstico de Performance** focado em:
1.  Analisar e otimizar as Policies RLS (`financeiro_itens_plano`).
2.  Criar índices faltantes (`CREATE INDEX idx_itens_plano_loja_arquivado ...`).
3.  Revisar a lógica de fetch do React para garantir que ela seja robusta e faça cache se necessário.
