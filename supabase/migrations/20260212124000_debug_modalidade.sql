-- ===================================================================
-- DIAGNÓSTICO PROFUNDO: POR QUE A MODALIDADE ESTÁ "VARIÁVEL"?
-- ===================================================================

SELECT 
    c.id as conta_id,
    c.item as nome_na_conta,
    c.item_financeiro_id as link_id,
    
    -- Dados da Categoria Vinculada (se houver link)
    i.item as nome_categoria_linkada,
    i.tipo_recorrencia as recorrencia_categoria_linkada,
    i.fixo as is_fixo_categoria,
    
    -- Dados da Categoria por Nome (se o link falhou)
    i_nome.id as id_por_nome,
    i_nome.tipo_recorrencia as recorrencia_por_nome

FROM public.financeiro_contas c
LEFT JOIN public.financeiro_itens_plano i ON c.item_financeiro_id = i.id
LEFT JOIN public.financeiro_itens_plano i_nome ON c.item = i_nome.item AND c.loja_id = i_nome.loja_id

WHERE 
    c.data_vencimento BETWEEN '2026-01-01' AND '2026-01-31'
    AND c.item IN (
        'Vale Transporte', 
        'Seguro Lot', 
        'Cofre Inteligente', 
        'Internet', 
        'CEFOR', 
        'SELOMA', 
        'Água', 
        'ALUGUEL', 
        'CONTADORA', 
        'Téc. Segurança', 
        'ChatCase', 
        'Simples Nacional', 
        'OLHO VIVO', 
        'Plano Corporativo TIM'
    );
