/*
  # Tipos e Enums Base do Sistema MegaMais
  
  1. Tipos Criados
    - `user_role`: Níveis de acesso (admin, gerente, operador)
    - `bolao_status`: Status do bolão (disponivel, finalizado, cancelado)
    - `caixa_status`: Status da sessão de caixa (aberto, fechado, conferido, discrepante)
    - `fin_tipo_conta`: Tipo de transação financeira (receita, despesa)
    - `fin_status_conta`: Status de pagamento (pendente, pago, atrasado, cancelado)
    - `fin_metodo_pagamento`: Formas de pagamento (pix, dinheiro, boleto, cartao_debito, cartao_credito)
    - `terminal_status`: Status do terminal TFL (ativo, manutencao, inativo)
    - `metodo_pagamento_venda`: Métodos de pagamento em vendas
    - `status_prestacao_venda`: Status de prestação de contas
    - `status_validacao_gerencial`: Status de validação gerencial
    
  2. Notas Importantes
    - Estes enums são usados em toda a aplicação
    - Mantenha consistência com os tipos TypeScript do frontend
*/

-- Enum para roles de usuários
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'gerente', 'operador');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para status de bolões
DO $$ BEGIN
    CREATE TYPE bolao_status AS ENUM ('disponivel', 'finalizado', 'cancelado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para status de sessão de caixa
DO $$ BEGIN
    CREATE TYPE caixa_status AS ENUM ('aberto', 'fechado', 'conferido', 'discrepante');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para tipo de conta financeira
DO $$ BEGIN
    CREATE TYPE fin_tipo_conta AS ENUM ('receita', 'despesa');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para status de conta financeira
DO $$ BEGIN
    CREATE TYPE fin_status_conta AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para métodos de pagamento financeiro
DO $$ BEGIN
    CREATE TYPE fin_metodo_pagamento AS ENUM ('pix', 'dinheiro', 'boleto', 'cartao_debito', 'cartao_credito');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para status de terminal
DO $$ BEGIN
    CREATE TYPE terminal_status AS ENUM ('ativo', 'manutencao', 'inativo');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para métodos de pagamento em vendas
DO $$ BEGIN
    CREATE TYPE metodo_pagamento_venda AS ENUM ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para status de prestação de contas
DO $$ BEGIN
    CREATE TYPE status_prestacao_venda AS ENUM ('pendente', 'concluido');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para status de validação gerencial
DO $$ BEGIN
    CREATE TYPE status_validacao_gerencial AS ENUM ('pendente', 'aprovado', 'rejeitado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;