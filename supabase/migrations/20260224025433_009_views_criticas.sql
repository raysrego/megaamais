/*
  # Views Críticas do Sistema
  
  1. Views Criadas
    - `vw_auditoria_completa`
      - Auditoria unificada de vendas e encalhes
      - Une vendas_boloes com dados de bolões, produtos, usuários e empresas
      - Retorna histórico completo com tipo (venda), responsável, loteria, valores
      
    - `vw_prestacao_contas_operadores`
      - Resumo de pendências por operador
      - Agrega vendas pendentes por método de pagamento
      - Total em espécie, PIX, cartão e geral
      
    - `vw_performance_operadores`
      - Performance de vendas dos operadores
      - Cálculo de comissões (30% do lucro)
      - Sistema de tiers (Bronze, Prata, Ouro, Diamante)
      - Metas: Bronze R$10k, Prata R$20k, Ouro R$25k, Diamante R$30k
      
    - `cofre_saldo_atual`
      - Saldo atual do cofre por loja
      - Soma entradas e sangrias, subtrai saídas e depósitos
      
    - `cofre_sangrias_pendentes`
      - Sangrias que ainda não foram confirmadas no cofre
      - Join entre caixa_movimentacoes e cofre_movimentacoes
      
  2. Performance
    - Views otimizadas com índices adequados
    - Usadas extensivamente pelo frontend
    
  3. Uso
    - Dashboard de gestão
    - Relatórios gerenciais
    - Auditoria e compliance
    - Prestação de contas
*/

-- View: Auditoria Completa (vendas + encalhes)
CREATE OR REPLACE VIEW vw_auditoria_completa AS
SELECT 
    'venda' AS tipo_registro,
    v.id AS registro_id,
    v.created_at AS data_registro,
    u.nome AS responsavel,
    p.nome AS loteria,
    p.cor AS loteria_cor,
    b.concurso,
    b.data_sorteio,
    v.quantidade_cotas,
    v.valor_total,
    v.valor_total / NULLIF(v.quantidade_cotas, 0) AS valor_unitario,
    v.metodo_pagamento,
    e.nome_fantasia AS filial,
    b.status AS status_final,
    v.loja_id
FROM vendas_boloes v
JOIN boloes b ON v.bolao_id = b.id
JOIN produtos p ON b.produto_id = p.id
JOIN perfis u ON v.usuario_id = u.id
LEFT JOIN empresas e ON v.loja_id = e.id
WHERE v.deleted_at IS NULL;

-- View: Prestação de Contas Operadores
CREATE OR REPLACE VIEW vw_prestacao_contas_operadores AS
SELECT 
    v.usuario_id AS operador_id,
    u.nome AS operador_nome,
    e.nome_fantasia AS filial,
    v.loja_id,
    SUM(CASE WHEN v.metodo_pagamento = 'dinheiro' THEN v.valor_total ELSE 0 END) AS total_especie,
    SUM(CASE WHEN v.metodo_pagamento = 'pix' THEN v.valor_total ELSE 0 END) AS total_pix,
    SUM(CASE WHEN v.metodo_pagamento IN ('cartao_debito', 'cartao_credito') THEN v.valor_total ELSE 0 END) AS total_cartao,
    SUM(v.valor_total) AS total_geral,
    COUNT(*) AS qtd_vendas,
    MAX(v.created_at) AS ultima_venda
FROM vendas_boloes v
JOIN perfis u ON v.usuario_id = u.id
LEFT JOIN empresas e ON v.loja_id = e.id
WHERE v.status_prestacao = 'pendente'
  AND v.deleted_at IS NULL
GROUP BY v.usuario_id, u.nome, e.nome_fantasia, v.loja_id;

-- View: Performance Operadores
CREATE OR REPLACE VIEW vw_performance_operadores AS
SELECT 
    v.usuario_id AS operador_id,
    u.nome AS operador_nome,
    v.loja_id,
    e.nome_fantasia AS filial_nome,
    COUNT(*) AS qtd_vendas,
    SUM(v.valor_total) AS total_vendas_bruto,
    SUM(
        (b.preco_venda_cota - b.valor_cota_base) * v.quantidade_cotas * 0.30
    ) AS comissao_total_gerada,
    SUM(
        (b.preco_venda_cota - b.valor_cota_base) * v.quantidade_cotas * 0.70
    ) AS parte_casa_70,
    SUM(
        (b.preco_venda_cota - b.valor_cota_base) * v.quantidade_cotas * 0.30
    ) AS parte_pool_30,
    CASE 
        WHEN SUM(v.valor_total) >= 30000 THEN 4 -- Diamante
        WHEN SUM(v.valor_total) >= 25000 THEN 3 -- Ouro
        WHEN SUM(v.valor_total) >= 20000 THEN 2 -- Prata
        WHEN SUM(v.valor_total) >= 10000 THEN 1 -- Bronze
        ELSE 0
    END AS tier_atingido,
    CASE 
        WHEN SUM(v.valor_total) >= 30000 THEN 1000
        WHEN SUM(v.valor_total) >= 25000 THEN 800
        WHEN SUM(v.valor_total) >= 20000 THEN 700
        WHEN SUM(v.valor_total) >= 10000 THEN 600
        ELSE 0
    END AS premio_a_receber,
    CASE 
        WHEN SUM(v.valor_total) >= 30000 THEN NULL
        WHEN SUM(v.valor_total) >= 25000 THEN 30000
        WHEN SUM(v.valor_total) >= 20000 THEN 25000
        WHEN SUM(v.valor_total) >= 10000 THEN 20000
        ELSE 10000
    END AS proxima_meta_valor,
    CASE 
        WHEN SUM(v.valor_total) >= 30000 THEN 0
        WHEN SUM(v.valor_total) >= 25000 THEN 30000 - SUM(v.valor_total)
        WHEN SUM(v.valor_total) >= 20000 THEN 25000 - SUM(v.valor_total)
        WHEN SUM(v.valor_total) >= 10000 THEN 20000 - SUM(v.valor_total)
        ELSE 10000 - SUM(v.valor_total)
    END AS falta_para_proxima_meta
FROM vendas_boloes v
JOIN boloes b ON v.bolao_id = b.id
JOIN perfis u ON v.usuario_id = u.id
LEFT JOIN empresas e ON v.loja_id = e.id
WHERE v.deleted_at IS NULL
  AND v.created_at >= date_trunc('month', CURRENT_DATE)
GROUP BY v.usuario_id, u.nome, v.loja_id, e.nome_fantasia;

-- View: Saldo do Cofre
CREATE OR REPLACE VIEW cofre_saldo_atual AS
SELECT 
    loja_id,
    SUM(CASE 
        WHEN tipo IN ('entrada_sangria', 'ajuste_entrada') THEN valor
        WHEN tipo IN ('saida_deposito', 'ajuste_saida') THEN -valor
        ELSE 0
    END) AS saldo
FROM cofre_movimentacoes
WHERE deleted_at IS NULL
  AND status = 'concluido'
GROUP BY loja_id;

-- View: Sangrias Pendentes (não confirmadas no cofre)
CREATE OR REPLACE VIEW cofre_sangrias_pendentes AS
SELECT 
    cm.id AS sangria_id,
    cm.valor,
    cm.created_at AS data_hora,
    cs.terminal_id,
    cs.operador_id,
    cm.descricao AS observacao_caixa,
    cs.loja_id
FROM caixa_movimentacoes cm
JOIN caixa_sessoes cs ON cm.sessao_id = cs.id
LEFT JOIN cofre_movimentacoes cfm ON cfm.origem_sangria_id = cm.id
WHERE cm.tipo = 'sangria'
  AND cm.deleted_at IS NULL
  AND cfm.id IS NULL; -- Não tem entrada correspondente no cofre