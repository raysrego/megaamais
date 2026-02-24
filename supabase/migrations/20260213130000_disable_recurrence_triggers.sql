-- Migration: Disable Recurrence Triggers
-- Description: Desativa o motor automático de geração de recorrências.
--            Agora o usuário deve usar o botão "Replicar Mês Anterior" (Manual) ou lançar individualmente.

-- 1. Remover gatilho de atualização automática ao mudar categoria
DROP TRIGGER IF EXISTS auto_gerar_recorrencias_trigger ON public.financeiro_itens_plano;

-- 2. Remover função vinculada (para limpeza, opcional, mas boa prática manter o código limpo)
DROP FUNCTION IF EXISTS public.trg_auto_gerar_recorrencias_fixa();

-- NOTA: A função base 'processar_recorrencias_financeiras' É MANTIDA 
-- pois ainda pode ser chamada manualmente por botão de administração se desejado,
-- mas não rodará mais "sozinha".
