-- ===================================================================
-- CORREÇÃO CRÍTICA: CRIAR FILIAL NATUREZA
-- Motivo: Tabela de lojas estava vazia, impedindo cadastro de financeiro.
-- ===================================================================

INSERT INTO public.lojas (nome_fantasia, razao_social, cidade, uf, ativo)
VALUES (
    'Lotérica Natureza', 
    'Lotérica Natureza LTDA', 
    'São Luís', 
    'MA', 
    TRUE
)
ON CONFLICT (cnpj) DO NOTHING; -- CNPJ é único, mas como não temos, vai inserir.

-- Retornar o ID criado para confirmação
SELECT * FROM public.lojas;
