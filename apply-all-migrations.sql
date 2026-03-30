-- Script para aplicar todas as migrations em ordem
-- Este arquivo consolida todas as migrations necessárias

-- ============================================================================
-- MIGRATION 001: Tipos e Enums Base
-- ============================================================================

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
