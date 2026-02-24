# Migrations do Sistema MegaMais

Este documento descreve todas as migrations aplicadas ao banco de dados Supabase do sistema MegaMais.

## Estrutura das Migrations

As migrations foram organizadas em ordem lógica de dependências:

### 001 - Tipos e Enums Base
**Arquivo:** `001_tipos_e_enums_base.sql`

Define todos os tipos enumerados usados no sistema:
- `user_role`: Níveis de acesso (admin, gerente, operador)
- `bolao_status`: Status de bolões (disponivel, finalizado, cancelado)
- `caixa_status`: Status de caixa (aberto, fechado, conferido, discrepante)
- `fin_tipo_conta`: Tipo de conta (receita, despesa)
- `fin_status_conta`: Status de pagamento (pendente, pago, atrasado, cancelado)
- `fin_metodo_pagamento`: Métodos de pagamento
- `terminal_status`: Status de terminais TFL
- `metodo_pagamento_venda`: Métodos em vendas
- `status_prestacao_venda`: Status de prestação
- `status_validacao_gerencial`: Status de validação

### 002 - Estrutura Organizacional
**Arquivo:** `002_estrutura_organizacional.sql`

Cria as tabelas base da organização:
- **grupos**: Agrupamento de empresas
- **empresas**: Filiais/lojas (multi-tenant)

Características:
- Suporta hierarquia empresarial
- FK recursiva entre grupos e empresas
- RLS habilitado

### 003 - Autenticação e Usuários
**Arquivo:** `003_autenticacao_usuarios.sql`

Sistema de autenticação:
- **perfis**: Extende `auth.users` do Supabase
- **usuarios**: Dados expandidos de usuários

Recursos:
- Trigger automático para criar perfil ao registrar
- Multi-empresa (array de acessos)
- Soft delete

### 004 - Cadastros (Produtos, Categorias, Terminais)
**Arquivo:** `004_cadastros_produtos_terminais.sql`

Cadastros base do sistema:
- **categorias_produtos**: Classificação de produtos
- **produtos**: Loterias e produtos
- **loja_produtos**: Relacionamento N:N loja-produto
- **terminais**: Terminais TFL

Dados iniciais:
- 3 categorias padrão
- 9 loterias populares pré-cadastradas

### 005 - Módulo Financeiro
**Arquivo:** `005_modulo_financeiro.sql`

Sistema financeiro completo:
- **financeiro_bancos**: Cadastro de bancos
- **financeiro_contas_bancarias**: Contas bancárias
- **financeiro_itens_plano**: Catálogo de categorias financeiras
- **financeiro_contas**: Transações (receitas/despesas)
- **financeiro_transacoes_bancarias**: Para conciliação
- **financeiro_parametros**: Parâmetros configuráveis
- **financeiro_repasses**: Repasses de comissões

Filosofia:
- "Excel Turbo" - lançamentos manuais
- Sem recorrência automática (removido na v2.5.22)
- Storage bucket para comprovantes
- Soft delete

### 006 - Caixa Operacional
**Arquivo:** `006_caixa_operacional.sql`

Sistema de caixa TFL:
- **caixa_sessoes**: Sessões de caixa com dados TFL
- **caixa_movimentacoes**: 11 tipos de movimentações
- **caixa_bolao_sessoes**: Sessões específicas de bolões
- **cofre_movimentacoes**: Gestão do cofre

Recursos críticos:
- Validação gerencial obrigatória
- Cálculo de saldo líquido
- Integração com dados TFL
- Sangrias e depósitos

### 007 - Módulo de Bolões
**Arquivo:** `007_modulo_boloes.sql`

Sistema de bolões:
- **boloes**: Bolões criados
- **cotas_boloes**: Cotas individuais com UID único
- **prestacoes_contas**: Prestações de operadores
- **vendas_boloes**: Registro de vendas
- **boloes_prestacao_contas**: Resultado final do bolão

Regras de negócio:
- UID único por cota (B{bolaoId}-{indice}-{random4})
- Vendas atômicas via RPC
- Encalhe gera despesa automática
- Comissão: 30% operadores, 70% casa

### 008 - Auditoria e Logs
**Arquivo:** `008_auditoria_logs.sql`

Sistema de auditoria:
- **audit_logs**: Logs completos de todas operações
- **rate_limit_log**: Controle de rate limiting

Recursos:
- Função trigger para auditoria automática
- Logs imutáveis
- Rastreamento completo

### 009 - Views Críticas
**Arquivo:** `009_views_criticas.sql`

Views otimizadas:
- **vw_auditoria_completa**: Histórico unificado de vendas
- **vw_prestacao_contas_operadores**: Pendências por operador
- **vw_performance_operadores**: Performance com tiers e comissões
- **cofre_saldo_atual**: Saldo do cofre em tempo real
- **cofre_sangrias_pendentes**: Sangrias não confirmadas

Sistema de Tiers:
- Bronze: R$ 10.000 → R$ 600
- Prata: R$ 20.000 → R$ 700
- Ouro: R$ 25.000 → R$ 800
- Diamante: R$ 30.000 → R$ 1.000

### 010 - Funções RPC Críticas
**Arquivo:** `010_funcoes_rpc_criticas.sql`

Funções para operações atômicas:

#### registrar_venda_bolao()
Venda atômica de cotas:
- Valida disponibilidade
- Marca cotas como vendidas (lock pessimista)
- Atualiza contador do bolão
- Registra movimentação no caixa

#### processar_encalhe_bolao()
Processamento de encalhe:
- Finaliza bolão
- Calcula cotas não vendidas
- Gera despesa financeira automática

#### confirmar_liquidacao_operador()
Liquidação de vendas:
- Cria prestação de contas
- Registra entrada no cofre
- Baixa vendas pendentes

#### realizar_deposito_bancario()
Depósito bancário:
- Cria transação
- Atualiza saldo da conta

#### conciliar_transacao_bancaria()
Conciliação:
- Marca transação como conciliada

#### get_anos_financeiros_disponiveis()
Lista anos com dados financeiros

#### check_rate_limit()
Controle de rate limiting

### 011 - Políticas RLS
**Arquivo:** `011_politicas_rls.sql`

Row Level Security completo:

**Princípios:**
- Multi-tenant por loja_id
- Baseado em roles (admin/gerente/operador)
- Operadores veem apenas próprios dados
- Gerentes veem todos da loja
- Admins veem tudo

**Tabelas protegidas:**
- Perfis e usuários
- Empresas e grupos
- Produtos e categorias
- Terminais
- Financeiro (todas as tabelas)
- Caixa e cofre
- Bolões e vendas
- Auditoria
- Storage (comprovantes)

## Ordem de Aplicação

As migrations devem ser aplicadas nesta ordem:
1. Tipos e Enums
2. Estrutura Organizacional
3. Autenticação
4. Cadastros
5. Financeiro
6. Caixa
7. Bolões
8. Auditoria
9. Views
10. Funções RPC
11. Políticas RLS

## Tabelas Criadas

Total de **30 tabelas** principais:

### Autenticação (3)
- perfis
- usuarios
- grupos

### Organização (1)
- empresas

### Cadastros (4)
- categorias_produtos
- produtos
- loja_produtos
- terminais

### Financeiro (7)
- financeiro_bancos
- financeiro_contas_bancarias
- financeiro_itens_plano
- financeiro_contas
- financeiro_transacoes_bancarias
- financeiro_parametros
- financeiro_repasses

### Caixa (4)
- caixa_sessoes
- caixa_movimentacoes
- caixa_bolao_sessoes
- cofre_movimentacoes

### Bolões (5)
- boloes
- cotas_boloes
- prestacoes_contas
- vendas_boloes
- boloes_prestacao_contas

### Auditoria (2)
- audit_logs
- rate_limit_log

## Views Criadas

Total de **5 views**:
1. vw_auditoria_completa
2. vw_prestacao_contas_operadores
3. vw_performance_operadores
4. cofre_saldo_atual
5. cofre_sangrias_pendentes

## Funções RPC Criadas

Total de **7 funções**:
1. registrar_venda_bolao()
2. processar_encalhe_bolao()
3. confirmar_liquidacao_operador()
4. realizar_deposito_bancario()
5. conciliar_transacao_bancaria()
6. get_anos_financeiros_disponiveis()
7. check_rate_limit()

## Storage Buckets

- **comprovantes**: Para upload de comprovantes financeiros
  - Estrutura: `{loja_id}/{filename}`
  - Policies por loja_id

## Índices Criados

Todos os índices críticos foram criados automaticamente nas migrations:
- Chaves estrangeiras
- Campos de busca frequente (status, datas, loja_id)
- Campos únicos (UID, código, CNPJ)
- Índices compostos para queries complexas

## Dados Iniciais

### Categorias de Produtos
- Loterias
- Serviços
- Produtos

### Bancos
10 bancos principais cadastrados (BB, Caixa, Itaú, Bradesco, Santander, Nubank, Inter, PagSeguro, Mercado Pago, PicPay)

### Loterias
9 loterias populares:
- Mega-Sena
- Lotofácil
- Quina
- Lotomania
- Timemania
- Dupla Sena
- Dia de Sorte
- Super Sete
- +Milionária

### Parâmetros
- Taxa administrativa padrão: 35%
- Comissão operador: 30%
- Comissão casa: 70%

## Segurança

### RLS (Row Level Security)
- Habilitado em TODAS as tabelas
- Policies restritivas por padrão
- Multi-tenant seguro
- Baseado em auth.uid()

### Soft Delete
Tabelas com soft delete:
- financeiro_contas
- caixa_movimentacoes
- cofre_movimentacoes
- vendas_boloes

### Auditoria
- Trigger automático disponível
- Rastreamento de IP e User Agent
- Logs imutáveis

## Consultas Importantes

### Verificar saldo do cofre
```sql
SELECT * FROM cofre_saldo_atual WHERE loja_id = '{uuid}';
```

### Sangrias pendentes
```sql
SELECT * FROM cofre_sangrias_pendentes WHERE loja_id = '{uuid}';
```

### Performance do operador
```sql
SELECT * FROM vw_performance_operadores
WHERE operador_id = '{uuid}';
```

### Prestações pendentes
```sql
SELECT * FROM vw_prestacao_contas_operadores
WHERE loja_id = '{uuid}';
```

## Troubleshooting

### Erro de permissão
Verifique as policies RLS da tabela e o role do usuário.

### Dados não aparecem
Confirme que o usuário está vinculado à loja correta (perfis.loja_id).

### Venda de bolão falha
Verifique se há cotas disponíveis e se a sessão de caixa está aberta.

### Saldo do cofre incorreto
Verifique se todas as sangrias foram confirmadas no cofre.

## Manutenção

### Limpeza de logs antigos
```sql
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year';
DELETE FROM rate_limit_log WHERE created_at < NOW() - INTERVAL '30 days';
```

### Reindexação
```sql
REINDEX TABLE vendas_boloes;
REINDEX TABLE financeiro_contas;
```

### Vacuum
```sql
VACUUM ANALYZE;
```

## Versão do Sistema

- **Versão atual:** 2.5.9 (Beta)
- **Data da última migration:** 2026-02-24
- **Filosofia:** "Excel Turbo" - controle manual total

## Contato

Para dúvidas ou problemas com as migrations, consulte a documentação completa em `/docs/`.
