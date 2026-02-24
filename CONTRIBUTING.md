# Guia de Contribuição — MegaMais

**Versão:** Beta v2.5.15  
**Última Atualização:** 10/02/2026

---

## 1. Antes de Tudo

O sistema MegaMais está **em produção real** — usado diariamente pela lotérica. Toda alteração deve ser tratada com responsabilidade.

> **Regra #1:** SEMPRE rode `npm run build` com sucesso antes de fazer push.
>
> **Regra #2:** Nunca altere tabelas diretamente no banco de produção. Use migrations versionadas.

---

## 2. Padrões de Código

### TypeScript
- **Sem `any`:** Evite o uso de `any`. Sempre tipe variáveis e retornos.
- **Interfaces:** Use interfaces compartilhadas em `src/types/` para manter Frontend e Backend sincronizados.

### Hooks e Server Actions
- **Leitura de dados:** Hooks em `src/hooks/` (ex: `useFinanceiro()`, `useItensFinanceiros()`).
- **Mutações sensíveis:** Server Actions em `src/hooks/actions.ts` e `src/actions/`.
- **Tratamento de Erros:** Retorne `[]` ou `null` em caso de falha não-crítica para não quebrar a UI.

---

## 3. Banco de Dados (Supabase)

- **Migrations versionadas:** Crie scripts SQL em `supabase/migrations/` com formato `YYYYMMDDHHMMSS_descricao.sql`.
- **Clean State:** O banco deve ser recriável a partir de `docs/db/clean_schema.sql` + migrations.
- **Nunca edite produção** diretamente. Execute migrations via SQL Editor do Supabase.

---

## 4. Commits e Versionamento

### Padrão de Commit
```
v2.5.15 - Descrição clara do que foi feito
```

Exemplos de bons commits:
- `v2.5.15 - Fix: Correção do travamento no modal de edição financeira`
- `v2.5.15 - Feat: Adicionado filtro de categorias arquivadas`
- `v2.5.15 - Docs: Atualização da documentação para v2.5.15`

### Branch
- Trabalhamos diretamente na branch `main`.
- NÃO criamos branches de feature (equipe pequena + deploy contínuo).

---

## 5. Fluxo de Trabalho Completo

```
1. git pull origin main
2. npm install (se necessário)
3. npm run dev → Desenvolver e testar
4. npm run build → OBRIGATÓRIO antes de subir
5. git add . → git commit → git push
6. Verificar deploy no Dashboard da Vercel
```

---

## 6. Para Conselheiros (Agentes IA)

Se você é um Conselheiro (IA) ativado para trabalhar neste projeto:
1. Leia **`docs/ONBOARDING_CONSELHEIRO.md`** antes de qualquer ação.
2. Siga as Regras de Ouro descritas naquele documento.
3. Sempre rode `npm run build` após suas modificações.
4. Se o build falhar, **corrija antes de fazer push**.

---

**Versão:** Beta v2.5.15
