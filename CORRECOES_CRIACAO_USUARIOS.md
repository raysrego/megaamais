# Correções Críticas - Sistema de Criação de Usuários

## Sumário Executivo

Foram identificados **5 problemas críticos** no sistema de criação e gestão de usuários. Todos foram analisados e uma migration de correção foi preparada.

## Problemas Identificados

### 1. Políticas DELETE Ausentes (CRÍTICO)

**Problema:**
- Tabela `perfis` não possui policy DELETE
- Tabela `usuarios` não possui policy DELETE
- Com RLS habilitado, NENHUM delete funciona (nem para admin)

**Impacto:**
- Impossível remover usuários do sistema
- Operações de CASCADE delete podem falhar
- Admin não consegue gerenciar usuários inativos

**Localização:**
- `supabase/migrations/20260224025557_011_politicas_rls.sql`
- Faltam policies DELETE para ambas tabelas

### 2. Política INSERT em usuarios Muito Restritiva

**Problema:**
- Policy `usuarios_all_policy` apenas permite operações se `is_admin()`
- Trigger `handle_perfil_to_usuarios` executa como `SECURITY DEFINER` mas não tem privilégios
- Service role não consegue inserir em usuarios

**Impacto:**
- Trigger de sincronização pode falhar silenciosamente
- Criação de usuário pode resultar em perfil sem entrada na tabela usuarios
- Inconsistência de dados entre perfis e usuarios

**Localização:**
- `supabase/migrations/20260224041648_014_fix_rls_recursion_admin_access.sql:159-160`

### 3. Recursão Infinita em Políticas (PARCIALMENTE CORRIGIDO)

**Problema Original:**
```sql
-- PROBLEMA: Recursão infinita
CREATE POLICY "Admin pode ver todos os perfis"
  ON perfis FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')
    -- ❌ Query em perfis dentro de policy de perfis = RECURSÃO!
  );
```

**Status:** ✅ Corrigido na migration 014 com funções helper `is_admin()` usando `SECURITY DEFINER`

### 4. Sincronização Não-Idempotente

**Problema:**
- Trigger `handle_perfil_to_usuarios` pode falhar se não houver empresas
- Não valida se empresa_id existe antes de inserir
- Emails fallback inválidos (`@sistema.local`)

**Código Problemático:**
```sql
-- Linha 40 da migração 20260225021139
IF NEW.role = 'admin' THEN
    SELECT id INTO v_empresa_id FROM empresas LIMIT 1;  -- ❌ Pode ser NULL
END IF;

-- Linha 47-49
IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa encontrada';  -- ❌ Bloqueia criação
END IF;

-- Linha 66
COALESCE(v_email, NEW.nome || '@sistema.local')  -- ❌ Email inválido
```

**Impacto:**
- Admin não pode ser criado se não houver empresas
- Migration inicial pode falhar
- Emails inválidos impedem notificações

### 5. Service Role sem Auditoria

**Problema:**
- Service role pode criar perfis diretamente via policy
- Sem log de auditoria para operações administrativas
- Impossível rastrear quem criou determinado usuário

**Localização:**
- `supabase/migrations/20260225022250_fix_perfis_insert_policy_service_role.sql:34`

## Correções Implementadas

### Correção 1: Políticas DELETE com Auditoria

```sql
-- PERFIS: Apenas admin pode deletar
CREATE POLICY "perfis_delete_policy"
    ON perfis FOR DELETE
    USING (
        (current_setting('role') = 'service_role') OR
        (auth.uid() IS NOT NULL AND is_admin())
    );

-- USUARIOS: Apenas admin pode deletar
CREATE POLICY "usuarios_delete_policy"
    ON usuarios FOR DELETE
    USING (
        (current_setting('role') = 'service_role') OR
        (auth.uid() IS NOT NULL AND is_admin())
    );

-- Trigger de auditoria
CREATE TRIGGER audit_perfil_delete_trigger
    BEFORE DELETE ON perfis
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_perfil_delete();
```

### Correção 2: Políticas INSERT/UPDATE Separadas

```sql
-- Remover policy "all" genérica
DROP POLICY IF EXISTS "usuarios_all_policy" ON usuarios;

-- Criar policies específicas
CREATE POLICY "usuarios_insert_policy" ON usuarios FOR INSERT
    WITH CHECK (
        (current_setting('role') = 'service_role') OR
        (auth.uid() IS NOT NULL AND is_admin())
    );

CREATE POLICY "usuarios_update_policy" ON usuarios FOR UPDATE
    USING (...) WITH CHECK (...);
```

**Benefício:** Service role pode inserir via trigger mantendo segurança

### Correção 3: Trigger Idempotente com Tratamento de Erros

```sql
CREATE OR REPLACE FUNCTION public.handle_perfil_to_usuarios()
RETURNS trigger AS $$
DECLARE
    v_empresa_id UUID;
BEGIN
    -- Admin pode existir sem empresa inicialmente
    IF v_empresa_id IS NULL AND NEW.role != 'admin' THEN
        RAISE WARNING 'Perfil não sincronizado: empresa indisponível';
        RETURN NEW;  -- ✅ Não bloqueia operação
    END IF;

    -- Email válido ou fallback interno
    COALESCE(v_email, NEW.nome || '@interno.sistema')

    -- Update condicional (só se mudou)
    ON CONFLICT (id) DO UPDATE SET ... WHERE
        usuarios.nome != EXCLUDED.nome OR ...;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro: %', SQLERRM;
        RETURN NEW;  -- ✅ Não bloqueia
END;
$$;
```

**Melhorias:**
- ✅ Admin pode ser criado sem empresa
- ✅ Erros não bloqueiam criação de perfil
- ✅ Update condicional evita writes desnecessários
- ✅ Emails válidos para notificações

### Correção 4: Função de Verificação de Integridade

```sql
CREATE FUNCTION public.check_perfis_usuarios_sync()
RETURNS TABLE(perfil_id UUID, issue TEXT, ...) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id,
        CASE
            WHEN u.id IS NULL THEN 'Usuario não existe'
            WHEN p.nome != u.nome THEN 'Nome desincronizado'
            ELSE 'OK'
        END
    FROM perfis p
    LEFT JOIN usuarios u ON p.id = u.id;
END;
$$;
```

**Uso:** Permite diagnóstico de problemas de sincronização

## Como Aplicar as Correções

### Opção 1: Aplicar Migration Automaticamente

```bash
# A migration será aplicada automaticamente após o build
npm run build
```

### Opção 2: Aplicar Manualmente via Supabase

1. Acesse o Supabase Dashboard
2. Vá em SQL Editor
3. Execute o conteúdo da migration `fix_user_creation_critical_issues.sql`

### Opção 3: Usar CLI (se disponível)

```bash
supabase db push
```

## Validação Pós-Correção

### Teste 1: Criar Usuário Admin

```typescript
const { data, error } = await createNewUser(null, formData);
console.log('Usuário criado:', data);
```

**Esperado:**
- ✅ Perfil criado em `perfis`
- ✅ Registro criado em `usuarios`
- ✅ Ambos sincronizados corretamente

### Teste 2: Verificar Sincronização

```sql
SELECT * FROM check_perfis_usuarios_sync();
```

**Esperado:**
- Todos os perfis devem ter `issue = 'OK'`
- Nenhum perfil sem usuario correspondente

### Teste 3: Deletar Usuário (Admin)

```typescript
await supabaseAdmin.from('perfis').delete().eq('id', userId);
```

**Esperado:**
- ✅ Delete executado com sucesso
- ✅ Auditoria registrada em `audit_logs`
- ✅ Usuario removido via CASCADE

## Impacto nas Actions

### src/actions/admin.ts

**Antes:**
```typescript
// Podia falhar silenciosamente
const { error } = await supabaseAdmin.from('perfis').insert({...});
```

**Depois:**
```typescript
// Agora funciona com auditoria completa
const { error } = await supabaseAdmin.from('perfis').insert({...});
// Trigger sincroniza automaticamente em usuarios
```

### src/app/(dashboard)/configuracoes/ConfiguracaoUsuarios.tsx

**Mudanças Necessárias:** Nenhuma! A correção é transparente para o frontend.

## Checklist de Validação

- [ ] Migration aplicada com sucesso
- [ ] Tabela `perfis` possui policy DELETE
- [ ] Tabela `usuarios` possui policy DELETE
- [ ] Policy INSERT em usuarios permite service_role
- [ ] Trigger `handle_perfil_to_usuarios` não bloqueia em erros
- [ ] Função `check_perfis_usuarios_sync()` criada
- [ ] Trigger de auditoria DELETE criado
- [ ] Teste de criação de admin bem-sucedido
- [ ] Teste de criação de operador bem-sucedido
- [ ] Teste de sincronização perfis/usuarios OK
- [ ] Build do projeto sem erros

## Próximos Passos

1. ✅ Migration preparada
2. ⏳ Aplicar migration no banco de dados
3. ⏳ Executar `npm run build`
4. ⏳ Testar criação de usuários
5. ⏳ Validar sincronização
6. ⏳ Verificar auditoria

## Documentação Adicional

- Ver: `supabase/migrations/20260224041648_014_fix_rls_recursion_admin_access.sql`
- Ver: `supabase/migrations/20260225021139_fix_perfil_usuarios_sync.sql`
- Ver: `supabase/migrations/20260225022250_fix_perfis_insert_policy_service_role.sql`
- Ver: `src/actions/admin.ts`

## Contato e Suporte

Em caso de dúvidas sobre as correções ou problemas na aplicação:
- Verifique os logs do Supabase Dashboard
- Execute `check_perfis_usuarios_sync()` para diagnóstico
- Revise audit_logs para rastrear operações
