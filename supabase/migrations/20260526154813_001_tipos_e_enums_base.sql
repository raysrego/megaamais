/*
  # Tipos e Enums Base do Sistema MegaMais
  Creates all base ENUM types used throughout the system.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'gerente', 'operador');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bolao_status') THEN
    CREATE TYPE bolao_status AS ENUM ('disponivel', 'finalizado', 'cancelado');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'caixa_status') THEN
    CREATE TYPE caixa_status AS ENUM ('aberto', 'fechado', 'conferido', 'discrepante');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_tipo_conta') THEN
    CREATE TYPE fin_tipo_conta AS ENUM ('receita', 'despesa');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_status_conta') THEN
    CREATE TYPE fin_status_conta AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fin_metodo_pagamento') THEN
    CREATE TYPE fin_metodo_pagamento AS ENUM ('pix', 'dinheiro', 'boleto', 'cartao_debito', 'cartao_credito');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'terminal_status') THEN
    CREATE TYPE terminal_status AS ENUM ('ativo', 'manutencao', 'inativo');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metodo_pagamento_venda') THEN
    CREATE TYPE metodo_pagamento_venda AS ENUM ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_prestacao_venda') THEN
    CREATE TYPE status_prestacao_venda AS ENUM ('pendente', 'concluido');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_validacao_gerencial') THEN
    CREATE TYPE status_validacao_gerencial AS ENUM ('pendente', 'aprovado', 'rejeitado', 'discrepante', 'batido', 'divergente', 'fechado');
  END IF;
END $$;
