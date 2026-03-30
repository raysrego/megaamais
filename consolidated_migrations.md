# Migrations Consolidadas do MegaMais

## Instruções de Aplicação

Aplique as migrations na seguinte ordem usando o SQL Editor do Supabase:

### Fase 1: Base (Já aplicadas via MCP)
- ✅ 001_tipos_e_enums_base
- ✅ 002_estrutura_organizacional  
- ✅ 003_autenticacao_usuarios
- ✅ 004_cadastros_produtos_terminais

### Fase 2: Módulos Principais (Aplicar nesta ordem)
1. `20260224025204_005_modulo_financeiro.sql`
2. `20260224025304_006_caixa_operacional.sql`
3. `20260224025340_007_modulo_boloes.sql`
4. `20260224025401_008_auditoria_logs.sql`
5. `20260224025433_009_views_criticas.sql`
6. `20260224025510_010_funcoes_rpc_criticas.sql`
7. `20260224025557_011_politicas_rls.sql`

### Fase 3: Funções e Correções
8. `20260224040652_012_funcoes_perfil_usuario.sql`
9. `20260224040716_013_funcoes_dashboard_admin.sql`
10. `20260224041648_014_fix_rls_recursion_admin_access.sql`
11. `20260224044910_015_fix_financeiro_critical_issues_v2.sql`
12. `20260224051722_20260224051705_016_fix_financeiro_delete_policy.sql`
13. `20260224060851_fix_financeiro_contas_rls_update_delete.sql`
14. `20260224061003_fix_caixa_bolao_sessoes_rls_policies.sql`
15. `20260224061029_fix_add_missing_enum_values_status_validacao.sql`
16. `20260225005822_create_categorias_operacionais_produtos.sql`
17. `20260225005847_fix_caixa_movimentacoes_rls_edit_delete.sql`
18. `20260225021139_fix_perfil_usuarios_sync.sql`
19. `20260225022250_fix_perfis_insert_policy_service_role.sql`
20. `20260225044638_fix_categorias_operacionais_seed.sql`
21. `20260226044610_create_vender_cotas_bolao_rpc.sql`
22. `20260226045123_fix_vender_cotas_bolao_function.sql`

### Fase 4: Evolução do Fechamento (CRÍTICA - Resolve o problema de auditoria)
23. **`001_evolucao_fechamento_caixa.sql`** ⚠️ MAIS IMPORTANTE
24. `002_conciliacao_bancaria.sql`
25. `003_correcoes_criticas.sql`
26. `004_correcoes_bugs_e_views.sql`

## Solução Rápida

Execute no terminal:
\`\`\`bash
cd /tmp/cc-agent/65197929/project
supabase db push
\`\`\`

Ou aplique manualmente via SQL Editor do Supabase Dashboard.
