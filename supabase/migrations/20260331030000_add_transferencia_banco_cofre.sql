/*
  # Adicionar tipo transferencia_banco ao cofre

  ## Mudanças

  1. **Modificar constraint de tipos em cofre_movimentacoes**
     - Adiciona o tipo 'transferencia_banco' aos tipos válidos
     - Adiciona coluna conta_bancaria_destino_id para referenciar a conta de destino
     - Adiciona coluna usuario_id para registrar quem fez a transferência

  2. **Índices para performance**
     - Adiciona índice para consultas de conciliação
     - Adiciona índice para fechamentos aprovados

  3. **View consolidada**
     - Cria view vw_depositos_recebidos para facilitar consultas na tela de conciliação
*/

-- Remover constraint antiga e adicionar nova com o tipo transferencia_banco
DO $$
BEGIN
    -- Dropar constraint antiga se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'cofre_movimentacoes_tipo_check'
        AND table_name = 'cofre_movimentacoes'
    ) THEN
        ALTER TABLE cofre_movimentacoes DROP CONSTRAINT cofre_movimentacoes_tipo_check;
    END IF;
    
    -- Adicionar nova constraint com transferencia_banco
    ALTER TABLE cofre_movimentacoes
    ADD CONSTRAINT cofre_movimentacoes_tipo_check
    CHECK (tipo IN ('entrada_sangria', 'saida_deposito', 'ajuste_entrada', 'ajuste_saida', 'transferencia_banco'));
END $$;

-- Adicionar coluna conta_bancaria_destino_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cofre_movimentacoes'
        AND column_name = 'conta_bancaria_destino_id'
    ) THEN
        ALTER TABLE cofre_movimentacoes
        ADD COLUMN conta_bancaria_destino_id UUID REFERENCES financeiro_contas_bancarias(id);
    END IF;
END $$;

-- Adicionar coluna usuario_id se não existir (para registrar quem fez o depósito)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cofre_movimentacoes'
        AND column_name = 'usuario_id'
    ) THEN
        ALTER TABLE cofre_movimentacoes
        ADD COLUMN usuario_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Adicionar coluna data_deposito para registrar quando o depósito foi feito no banco
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cofre_movimentacoes'
        AND column_name = 'data_deposito'
    ) THEN
        ALTER TABLE cofre_movimentacoes
        ADD COLUMN data_deposito TIMESTAMPTZ;
    END IF;
END $$;

-- Índice para otimizar consultas de conciliação
CREATE INDEX IF NOT EXISTS idx_cofre_movimentacoes_conciliacao
ON cofre_movimentacoes(loja_id, tipo, data_movimentacao)
WHERE tipo = 'transferencia_banco' AND deleted_at IS NULL;

-- Índice para consultas de fechamentos aprovados
CREATE INDEX IF NOT EXISTS idx_caixa_fechamentos_conciliacao
ON caixa_fechamentos(loja_id, status, data_fechamento)
WHERE status = 'aprovado';

-- Criar view consolidada para depósitos recebidos
CREATE OR REPLACE VIEW vw_depositos_recebidos AS
SELECT
    cm.id,
    cm.loja_id,
    cm.valor,
    cm.data_movimentacao,
    cm.data_deposito,
    cm.observacoes,
    cm.usuario_id,
    cm.conta_bancaria_destino_id,
    u.nome_completo as operador_nome,
    fcb.nome as conta_nome,
    fb.nome as banco_nome,
    e.nome_fantasia as loja_nome
FROM cofre_movimentacoes cm
LEFT JOIN usuarios u ON cm.usuario_id = u.id
LEFT JOIN financeiro_contas_bancarias fcb ON cm.conta_bancaria_destino_id = fcb.id
LEFT JOIN financeiro_bancos fb ON fcb.banco_id = fb.id
LEFT JOIN empresas e ON cm.loja_id = e.id
WHERE cm.tipo = 'transferencia_banco' AND cm.deleted_at IS NULL
ORDER BY cm.data_movimentacao DESC;

-- Comentários
COMMENT ON VIEW vw_depositos_recebidos IS 'View consolidada de depósitos recebidos (transferências do cofre para contas bancárias) para tela de conciliação';
COMMENT ON COLUMN cofre_movimentacoes.conta_bancaria_destino_id IS 'Conta bancária de destino quando tipo = transferencia_banco';
COMMENT ON COLUMN cofre_movimentacoes.usuario_id IS 'Usuário que registrou a movimentação';
COMMENT ON COLUMN cofre_movimentacoes.data_deposito IS 'Data em que o depósito foi efetivamente realizado no banco';

-- Conceder permissão de SELECT na view
GRANT SELECT ON vw_depositos_recebidos TO authenticated;
