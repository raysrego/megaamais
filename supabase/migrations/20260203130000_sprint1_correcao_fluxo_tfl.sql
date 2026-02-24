-- Migration: Adicionar campos para PIX TFL e Validação Gerencial
-- Data: 2026-02-03
-- Sprint 1: Correção do Fluxo TFL

-- 1. ADICIONAR CAMPO PIX TFL (do relatório do terminal)
ALTER TABLE public.caixa_sessoes
ADD COLUMN IF NOT EXISTS tfl_pix_total NUMERIC(12, 2) DEFAULT 0;

COMMENT ON COLUMN public.caixa_sessoes.tfl_pix_total IS
'Total de PIX registrado no relatório do TFL (QR Code da maquininha)';

-- 2. ADICIONAR CAMPOS DE VALIDAÇÃO GERENCIAL
ALTER TABLE public.caixa_sessoes
ADD COLUMN IF NOT EXISTS status_validacao TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS validado_por_id UUID REFERENCES public.usuarios(id),
ADD COLUMN IF NOT EXISTS data_validacao TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS observacoes_gerente TEXT;

-- Constraint para status_validacao
ALTER TABLE public.caixa_sessoes
ADD CONSTRAINT chk_status_validacao 
CHECK (status_validacao IN ('pendente', 'aprovado', 'rejeitado'));

COMMENT ON COLUMN public.caixa_sessoes.status_validacao IS
'Status da validação gerencial: pendente (após fechamento), aprovado, ou rejeitado';

COMMENT ON COLUMN public.caixa_sessoes.validado_por_id IS
'ID do gerente que validou o fechamento';

COMMENT ON COLUMN public.caixa_sessoes.data_validacao IS
'Data e hora em que o gerente validou/rejeitou';

COMMENT ON COLUMN public.caixa_sessoes.observacoes_gerente IS
'Observações do gerente sobre o fechamento (motivo de rejeição, etc)';

-- 3. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_status_validacao 
ON public.caixa_sessoes(status_validacao) 
WHERE status_validacao = 'pendente';

CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_validado_por 
ON public.caixa_sessoes(validado_por_id);

-- 4. ATUALIZAR SESSÕES ANTIGAS (já fechadas)
-- Marcar como 'aprovado' automaticamente (não tinham validação antes)
UPDATE public.caixa_sessoes
SET status_validacao = 'aprovado'
WHERE status IN ('fechado', 'conferido') 
AND status_validacao = 'pendente';

-- 5. ADICIONAR CAMPOS PARA SEPARAÇÃO DE PIX MANUAL
-- (Cálculo será feito via Server Action, mas registrar no fechamento)
ALTER TABLE public.caixa_sessoes
ADD COLUMN IF NOT EXISTS total_pix_manual NUMERIC(12, 2) DEFAULT 0;

COMMENT ON COLUMN public.caixa_sessoes.total_pix_manual IS
'Total de PIX lançados manualmente (outras chaves, não do TFL)';

-- 6. ADICIONAR CAMPO PARA SALDO LÍQUIDO CALCULADO
ALTER TABLE public.caixa_sessoes
ADD COLUMN IF NOT EXISTS saldo_liquido_final NUMERIC(12, 2);

COMMENT ON COLUMN public.caixa_sessoes.saldo_liquido_final IS
'Saldo Líquido = Saldo TFL - PIX TFL - PIX Manual - Sangrias - Depósitos';

-- 7. ADICIONAR CAMPOS PARA SANGRIAS E DEPÓSITOS
-- (já existem em movimentações, mas registrar totalizadores no fechamento)
ALTER TABLE public.caixa_sessoes
ADD COLUMN IF NOT EXISTS total_sangrias NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_depositos_filial NUMERIC(12, 2) DEFAULT 0;

COMMENT ON COLUMN public.caixa_sessoes.total_sangrias IS
'Total de sangrias (retiradas para cofre) informadas no fechamento';

COMMENT ON COLUMN public.caixa_sessoes.total_depositos_filial IS
'Total de depósitos em outras filiais informados no fechamento';
