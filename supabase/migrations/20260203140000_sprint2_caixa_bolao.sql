-- Migration: Caixa Bolão - Sistema de Vendas de Cotas
-- Data: 2026-02-03
-- Sprint 2: Separar Caixa Bolão do Caixa TFL

-- 1. CRIAR TABELA DE SESSÕES CAIXA BOLÃO
CREATE TABLE IF NOT EXISTS public.caixa_bolao_sessoes (
    id SERIAL PRIMARY KEY,
    responsavel_id UUID NOT NULL REFERENCES public.usuarios(id),
    tipo_responsavel TEXT NOT NULL CHECK (tipo_responsavel IN ('op_admin', 'gerente')),
    data_abertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_fechamento TIMESTAMP WITH TIME ZONE,
    
    -- Totalizadores calculados (todas vendas de bolão do período)
    total_vendido NUMERIC(12, 2) DEFAULT 0,
    total_dinheiro NUMERIC(12, 2) DEFAULT 0,
    total_pix NUMERIC(12, 2) DEFAULT 0,
    
    -- Valores informados no fechamento
    dinheiro_informado NUMERIC(12, 2),
    pix_informado NUMERIC(12, 2),
    
    -- Status
    status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
    status_validacao TEXT DEFAULT 'pendente' CHECK (status_validacao IN ('pendente', 'aprovado', 'rejeitado')),
    
    -- Validação gerencial (se Op. Admin fechar, Gerente valida)
    validado_por_id UUID REFERENCES public.usuarios(id),
    data_validacao TIMESTAMP WITH TIME ZONE,
    
    -- Observações
    observacoes TEXT,
    observacoes_gerente TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.caixa_bolao_sessoes IS
'Sessões de Caixa Bolão - Gerenciado por Op. Admin ou Gerente, consolida TODAS vendas de bolão';

COMMENT ON COLUMN public.caixa_bolao_sessoes.tipo_responsavel IS
'Quem abriu o caixa: op_admin (Operador Admin) ou gerente';

COMMENT ON COLUMN public.caixa_bolao_sessoes.total_vendido IS
'Total calculado de TODAS vendas de bolão (de todos operadores)';

-- 2. ADICIONAR CAMPO DE SESSÃO BOLÃO NAS VENDAS
ALTER TABLE public.vendas_boloes
ADD COLUMN IF NOT EXISTS caixa_bolao_sessao_id INTEGER REFERENCES public.caixa_bolao_sessoes(id);

COMMENT ON COLUMN public.vendas_boloes.caixa_bolao_sessao_id IS
'Sessão de Caixa Bolão à qual esta venda pertence';

-- 3. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_caixa_bolao_sessoes_responsavel 
ON public.caixa_bolao_sessoes(responsavel_id);

CREATE INDEX IF NOT EXISTS idx_caixa_bolao_sessoes_status 
ON public.caixa_bolao_sessoes(status) 
WHERE status = 'aberto';

CREATE INDEX IF NOT EXISTS idx_caixa_bolao_sessoes_validacao 
ON public.caixa_bolao_sessoes(status_validacao) 
WHERE status_validacao = 'pendente';

CREATE INDEX IF NOT EXISTS idx_vendas_boloes_sessao 
ON public.vendas_boloes(caixa_bolao_sessao_id);

-- 4. FUNÇÃO PARA ATUALIZAR UPDATED_AT
CREATE OR REPLACE FUNCTION public.update_caixa_bolao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_caixa_bolao_updated_at ON public.caixa_bolao_sessoes;
CREATE TRIGGER trigger_update_caixa_bolao_updated_at
    BEFORE UPDATE ON public.caixa_bolao_sessoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_caixa_bolao_updated_at();

-- 5. RLS (Row Level Security)
ALTER TABLE public.caixa_bolao_sessoes ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários autenticados podem ler suas próprias sessões
DROP POLICY IF EXISTS select_caixa_bolao_sessoes ON public.caixa_bolao_sessoes;
CREATE POLICY select_caixa_bolao_sessoes ON public.caixa_bolao_sessoes
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Policy: Op. Admin e Gerente podem inserir sessões
DROP POLICY IF EXISTS insert_caixa_bolao_sessoes ON public.caixa_bolao_sessoes;
CREATE POLICY insert_caixa_bolao_sessoes ON public.caixa_bolao_sessoes
    FOR INSERT
    WITH CHECK (
        auth.uid() = responsavel_id AND
        tipo_responsavel IN ('op_admin', 'gerente')
    );

-- Policy: Responsável pode atualizar sua sessão
DROP POLICY IF EXISTS update_caixa_bolao_sessoes ON public.caixa_bolao_sessoes;
CREATE POLICY update_caixa_bolao_sessoes ON public.caixa_bolao_sessoes
    FOR UPDATE
    USING (auth.uid() = responsavel_id OR auth.uid() = validado_por_id);

-- 6. GRANT PERMISSIONS
GRANT SELECT, INSERT, UPDATE ON public.caixa_bolao_sessoes TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.caixa_bolao_sessoes_id_seq TO authenticated;
