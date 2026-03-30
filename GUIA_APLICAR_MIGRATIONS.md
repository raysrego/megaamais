# Guia para Aplicar Todas as Migrations

## Problema Identificado

O banco de dados Supabase está **completamente vazio**. Por isso, os valores de entrada e saída do operador de caixa não aparecem na auditoria - as colunas necessárias não existem porque as migrations nunca foram aplicadas.

## Solução: Aplicar Todas as Migrations

Existem **28 migrations** que precisam ser aplicadas na ordem correta.

---

## Opção 1: Usar Supabase CLI (Mais Rápido) ⚡

Se você tem o Supabase CLI instalado:

```bash
cd /tmp/cc-agent/65197929/project
supabase db push
```

Isso aplicará automaticamente todas as 28 migrations na ordem correta.

---

## Opção 2: Aplicar Manualmente via SQL Editor 📝

Acesse o **SQL Editor** no Dashboard do Supabase e execute os arquivos SQL na seguinte ordem:

### Fase 1: Tipos e Estrutura Base (4 migrations)

1. `supabase/migrations/20260224025014_001_tipos_e_enums_base.sql`
2. `supabase/migrations/20260224025035_002_estrutura_organizacional.sql`
3. `supabase/migrations/20260224025055_003_autenticacao_usuarios.sql`
4. `supabase/migrations/20260224025124_004_cadastros_produtos_terminais.sql`

### Fase 2: Módulos Principais (7 migrations)

5. `supabase/migrations/20260224025204_005_modulo_financeiro.sql`
6. `supabase/migrations/20260224025304_006_caixa_operacional.sql` ← Cria tabela `caixa_sessoes`
7. `supabase/migrations/20260224025340_007_modulo_boloes.sql`
8. `supabase/migrations/20260224025401_008_auditoria_logs.sql`
9. `supabase/migrations/20260224025433_009_views_criticas.sql`
10. `supabase/migrations/20260224025510_010_funcoes_rpc_criticas.sql`
11. `supabase/migrations/20260224025557_011_politicas_rls.sql`

### Fase 3: Funções e Correções (11 migrations)

12. `supabase/migrations/20260224040652_012_funcoes_perfil_usuario.sql`
13. `supabase/migrations/20260224040716_013_funcoes_dashboard_admin.sql`
14. `supabase/migrations/20260224041648_014_fix_rls_recursion_admin_access.sql`
15. `supabase/migrations/20260224044910_015_fix_financeiro_critical_issues_v2.sql`
16. `supabase/migrations/20260224051722_20260224051705_016_fix_financeiro_delete_policy.sql`
17. `supabase/migrations/20260224060851_fix_financeiro_contas_rls_update_delete.sql`
18. `supabase/migrations/20260224061003_fix_caixa_bolao_sessoes_rls_policies.sql`
19. `supabase/migrations/20260224061029_fix_add_missing_enum_values_status_validacao.sql`
20. `supabase/migrations/20260225005822_create_categorias_operacionais_produtos.sql`
21. `supabase/migrations/20260225005847_fix_caixa_movimentacoes_rls_edit_delete.sql`
22. `supabase/migrations/20260225021139_fix_perfil_usuarios_sync.sql`
23. `supabase/migrations/20260225022250_fix_perfis_insert_policy_service_role.sql`
24. `supabase/migrations/20260225044638_fix_categorias_operacionais_seed.sql`

### Fase 4: Funcionalidades de Bolão (2 migrations)

25. `supabase/migrations/20260226044610_create_vender_cotas_bolao_rpc.sql`
26. `supabase/migrations/20260226045123_fix_vender_cotas_bolao_function.sql`

### Fase 5: CRÍTICA - Evolução do Fechamento de Caixa (4 migrations) ⚠️

**ESTAS SÃO AS MAIS IMPORTANTES PARA RESOLVER O PROBLEMA DE AUDITORIA:**

27. **`supabase/migrations/001_evolucao_fechamento_caixa.sql`** ← **Adiciona as colunas:**
    - `dinheiro_em_maos`
    - `valor_enviado_cofre`
    - `pix_externo_informado`
    - `fundo_caixa_devolvido`
    - `resumo_entradas_pix`
    - `resumo_entradas_dinheiro`
    - `resumo_saidas_sangria`
    - E mais 15+ colunas de auditoria e reconciliação

28. `supabase/migrations/002_conciliacao_bancaria.sql`
29. `supabase/migrations/003_correcoes_criticas.sql` ← Cria a view `vw_auditoria_fechamentos`
30. `supabase/migrations/004_correcoes_bugs_e_views.sql`

---

## Verificação Após Aplicação

Após aplicar todas as migrations, execute esta query no SQL Editor para confirmar:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'caixa_sessoes'
  AND column_name IN (
    'dinheiro_em_maos',
    'valor_enviado_cofre',
    'pix_externo_informado'
  )
ORDER BY column_name;
```

**Resultado esperado:** Você deve ver as 3 colunas do tipo `numeric`.

---

## Resumo

- **Total de migrations:** 28
- **Migration crítica:** `001_evolucao_fechamento_caixa.sql` (nº 27)
- **Problema resolvido:** Valores de entrada/saída aparecerão na auditoria
- **Tempo estimado:** 5-10 minutos (manual) ou 1 minuto (CLI)

---

## Suporte

Se encontrar erros durante a aplicação:

1. Verifique se você está executando as migrations na ordem correta
2. Certifique-se de que cada migration foi aplicada com sucesso antes de passar para a próxima
3. Se uma migration falhar, leia a mensagem de erro - geralmente indica dependências faltando

---

## Melhorias Adicionadas ao Código

Além do guia de migrations, foram adicionados **logs detalhados** na função `fecharCaixaV2` em `src/hooks/useCaixa.ts` para facilitar o debug e verificar se os valores estão sendo enviados corretamente ao banco após as migrations serem aplicadas.
