-- ==========================================
-- MEGA B - INFRAESTRUTURA BANCÁRIA V1
-- Versão: 1.0 (2026-02-02)
-- Objetivo: Rastrear PIX e DEPÓSITOS DE COFRE
-- ==========================================

-- 1. TABELA DE BANCOS (CATÁLOGO)
CREATE TABLE IF NOT EXISTS public.financeiro_bancos (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE, -- Ex: 001, 033, 237
    nome TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir principais bancos brasileiros
INSERT INTO public.financeiro_bancos (codigo, nome) VALUES
('001', 'Banco do Brasil'),
('033', 'Santander'),
('237', 'Bradesco'),
('341', 'Itaú'),
('104', 'Caixa Econômica'),
('260', 'Nubank'),
('077', 'Inter')
ON CONFLICT (codigo) DO NOTHING;

-- 2. REFINAMENTO DE CONTAS BANCÁRIAS
-- Garantir que a tabela tenha as colunas certas e vínculo com bancos
ALTER TABLE public.financeiro_contas_bancarias ADD COLUMN IF NOT EXISTS banco_id INTEGER REFERENCES public.financeiro_bancos(id);
ALTER TABLE public.financeiro_contas_bancarias ADD COLUMN IF NOT EXISTS agencia TEXT;
ALTER TABLE public.financeiro_contas_bancarias ADD COLUMN IF NOT EXISTS conta_numero TEXT;
ALTER TABLE public.financeiro_contas_bancarias ADD COLUMN IF NOT EXISTS is_padrao_pix BOOLEAN DEFAULT FALSE;
ALTER TABLE public.financeiro_contas_bancarias ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id);

-- 3. TABELA DE TRANSAÇÕES BANCÁRIAS (EXTRATO)
CREATE TABLE IF NOT EXISTS public.financeiro_transacoes_bancarias (
    id BIGSERIAL PRIMARY KEY,
    conta_id UUID REFERENCES public.financeiro_contas_bancarias(id) NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor NUMERIC(15,2) NOT NULL,
    categoria TEXT NOT NULL, -- Ex: 'Venda PIX', 'Depósito Cofre', 'Pagamento'
    descricao TEXT,
    data_transacao TIMESTAMPTZ DEFAULT NOW(),
    
    -- Rastreabilidade
    usuario_id UUID REFERENCES auth.users(id),
    loja_id UUID REFERENCES public.lojas(id),
    
    -- Referências cruzadas
    venda_id BIGINT, -- Se for venda direta
    encalhe_id BIGINT, -- Se for custo de encalhe
    cofre_mov_id BIGINT REFERENCES public.cofre_movimentacoes(id), -- Se for depósito vindo do cofre
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ATUALIZAR FUNÇÃO DE LIQUIDAÇÃO PARA INCLUIR BANCO (PIX)
CREATE OR REPLACE FUNCTION public.confirmar_liquidacao_operador(
    p_operador_id UUID,
    p_master_id UUID,
    p_loja_id UUID,
    p_valor_especie NUMERIC,
    p_valor_pix NUMERIC
) RETURNS void AS $$
DECLARE
    v_mov_id BIGINT;
    v_conta_pix_id UUID;
BEGIN
    -- 1. Obter a conta PIX padrão da loja
    SELECT id INTO v_conta_pix_id 
    FROM public.financeiro_contas_bancarias 
    WHERE loja_id = p_loja_id AND is_padrao_pix = TRUE 
    LIMIT 1;

    -- 2. Criar entrada no Cofre se houver valor em espécie (DINHEIRO)
    IF p_valor_especie > 0 THEN
        INSERT INTO public.cofre_movimentacoes (
            tipo, 
            valor, 
            operador_id, 
            loja_id, 
            observacoes,
            status
        ) VALUES (
            'entrada_sangria', 
            p_valor_especie, 
            p_master_id, 
            p_loja_id, 
            'Acerto de contas bolão - Espécie - Operador: ' || (SELECT nome FROM public.perfis WHERE id = p_operador_id),
            'concluido'
        ) RETURNING id INTO v_mov_id;
    END IF;

    -- 3. Criar transação bancária se houver valor em PIX
    IF p_valor_pix > 0 AND v_conta_pix_id IS NOT NULL THEN
        INSERT INTO public.financeiro_transacoes_bancarias (
            conta_id,
            tipo,
            valor,
            categoria,
            descricao,
            usuario_id,
            loja_id
        ) VALUES (
            v_conta_pix_id,
            'entrada',
            p_valor_pix,
            'Venda Bolão (PIX)',
            'Acerto de contas bolão - PIX - Operador: ' || (SELECT nome FROM public.perfis WHERE id = p_operador_id),
            p_master_id,
            p_loja_id
        );
        
        -- Atualizar saldo da conta bancária
        UPDATE public.financeiro_contas_bancarias 
        SET saldo_atual = saldo_atual + p_valor_pix 
        WHERE id = v_conta_pix_id;
    END IF;

    -- 4. Marcar vendas como liquidadas
    UPDATE public.vendas_boloes
    SET 
        liquidado_em = NOW(),
        liquidado_por = p_master_id,
        cofre_mov_id = v_mov_id
    WHERE usuario_id = p_operador_id
    AND liquidado_em IS NULL;
    
END;
$$ LANGUAGE plpgsql;
