# 🚦 Estado Atual e Próximos Passos

> **Versão:** Beta v2.5.22 | **Data:** 19/02/2026

## Status por Módulo

| # | Módulo | Status | Maturidade | Observações |
|---|---|---|---|---|
| 1 | Dashboard Estratégico | ✅ Funcional | 80% | Drill-down usa mock data em alguns KPIs |
| 2 | Bolões & Loterias | ✅ Funcional | 95% | Módulo mais maduro, com auditoria completa |
| 3 | Gestão de Caixa | ✅ Funcional | 90% | Integração TFL + validação gerencial |
| 4 | Financeiro | ⚠️ Com ajustes | 75% | Bug "Salvando..." em investigação |
| 5 | Cofre | ✅ Funcional | 85% | Simples e estável |
| 6 | Conciliação Bancária | ✅ Funcional | 70% | Funcional mas pode ser aprimorada |
| 7 | Cadastros (5 sub) | ✅ Funcional | 85% | Todos os 5 sub-módulos funcionam |
| 8 | Painel Operador | ✅ Funcional | 80% | Com metas de comissão |
| 9 | Calendário/Sorteios | ✅ Funcional | 70% | Básico |
| 10 | Relatórios | ✅ Funcional | 60% | Pode crescer muito |
| 11 | Configurações | ✅ Funcional | 70% | Parâmetros básicos |
| 12 | Validação Gerencial | ✅ Funcional | 85% | Admin aprova/rejeita caixas |
| 13 | Notificações | ✅ Funcional | 60% | Sem push, apenas in-app |

## Evolução recente (v2.5.22)

### Correções aplicadas
- ✅ Padronização de nomenclatura de modalidades (FIXA→FIXO_MENSAL, etc.)
- ✅ Diferenciação Fixo Mensal vs Fixo Variável (campo `frequencia`)
- ✅ Eliminação do motor de recorrência automática (registros fantasma)
- ✅ Timeout de 15s nas operações financeiras (evita hang infinito)
- ✅ Remoção de console.logs e polling desnecessário
- ✅ Fix de RLS no módulo financeiro
- ✅ Importação de dados da filial Aririzal

### Bug em investigação
- ⚠️ **"Salvando..." infinito** no modal de edição financeira — timeout adicionado como safety net, causa raiz em investigação (provável RLS `WITH CHECK`)

## Filiais ativas

| Filial | Dados importados | Status |
|---|---|---|
| Natureza | ✅ Completo (Jan/2026+) | Operacional |
| Aririzal | ✅ Importado (Jan/2026+) | Operacional |

## Banco de Dados

| Métrica | Valor |
|---|---|
| Tabelas | ~20 |
| Migrations | 40+ scripts SQL |
| Functions RPC | 4 ativas |
| Views | 1 (`financeiro_resumo_mensal`) |
| Storage buckets | `comprovantes` (provas de pagamento) |

## O que é "Beta"?

O sistema está em **Beta** porque:
1. Está em uso real pelas filiais (dados de produção)
2. Alguns módulos ainda podem ser aprimorados (relatórios, notificações)
3. O design visual pode ser refinado
4. Não passou por testes automatizados formais (suíte Vitest/Playwright planejada)

## Próximos passos sugeridos

### Curto prazo (1-2 semanas)
- [ ] Resolver bug do "Salvando..." no financeiro
- [ ] Testes automatizados (Vitest para lógica, Playwright para fluxos)
- [ ] Melhorar relatórios com mais gráficos e filtros

### Médio prazo (1-2 meses)
- [ ] OCR para comprovantes (Google Vision API configurada)
- [ ] Push notifications (Supabase Realtime)
- [ ] Dashboard com dados 100% reais (remover mock data)
- [ ] Painel de produtividade mais detalhado

### Longo prazo (3-6 meses)
- [ ] App mobile (React Native ou PWA)
- [ ] Integração com APIs da Caixa Econômica
- [ ] Multi-empresa (mais de uma rede de lotéricas)
- [ ] IA para previsão de fluxo de caixa
