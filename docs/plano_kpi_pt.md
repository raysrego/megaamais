# Plano de Implementação - Padronização de Cards de KPI

## Objetivo
Padronizar todos os cards de indicadores (KPIs) em todo o aplicativo para remover inconsistências visuais, corrigir problemas com bordas coloridas e aplicar uma identidade "MegaB" premium e moderna, compatível com os modos Claro e Escuro.

## Restrições do Usuário
- "Atualmente estão muito inconsistentes com bordas coloridas diversas e meio bugadas".
- "Usar um padrão em todos os kpis mas mantendo a identidade moderna".
- As cores devem ser flexíveis (Modo Escuro/Claro).

## Design Proposto
- **Container**: `bg-bg-card` com `border-border`.
- **Forma**: `rounded-2xl` (combina com o NotificationDropdown).
- **Interatividade**: Elevação sutil ao passar o mouse (hover) e mudança na cor da borda (`hover:border-primary-blue-light/30`).
- **Iconografia**:
  - Tamanho consistente de `20px` ou `24px`.
  - Envolvido em um container colorido sutil (ex: `bg-primary/10 text-primary`).
- **Tipografia**:
  - Rótulo (Label): `text-[10px] font-bold uppercase tracking-widest text-text-muted`.
  - Valor: `text-2xl font-black text-text-primary`.
  - Tendência (Trend): Texto menor com cor específica (verde/vermelho) e ícone de seta.
- **Variantes**: Em vez de bordas totalmente coloridas, usar acentos sutis através da cor do ícone ou um efeito de brilho muito fino, mantendo o padrão neutro para não conflitar com o tema.

## Etapas

### 1. Atualizar `src/components/ui/KPICard.tsx`
Refatorar o componente para:
- Aceitar uma prop `variant` mais clara que mapeie para cores semânticas (primary, success, warning, danger, info).
- Usar classes Tailwind diretamente em vez de depender de classes CSS customizadas no `main.css`.
- Suportar estado de carregamento (Skeleton).
- Suportar "Tendência" com formatação adequada.

### 2. Limpar `main.css`
- Remover as classes legadas `.kpi-card`, `.kpi-header`, etc., para forçar o uso do novo componente e evitar conflitos de estilo.

### 3. Migração
Substituir as implementações manuais de KPI nos seguintes arquivos:
- [ ] `src/app/(dashboard)/page.tsx` (Home do Dashboard)
- [ ] `src/app/(dashboard)/operador/page.tsx`
- [ ] `src/app/(dashboard)/boloes/page.tsx`
- [ ] `src/components/financeiro/VisaoGestor.tsx`
- [ ] `src/components/boloes/SalesAuditTab.tsx`
- [ ] `src/components/boloes/OperatorSettlementTab.tsx`

### 4. Verificação
- Verificar responsividade.
- Verificar alternância entre Modo Claro/Escuro.
- Garantir que não haja "pulos" visuais ou mudanças bruscas de layout.

## Detalhes Técnicos

```tsx
// Interface proposta para o KPICard
interface KPICardProps {
    label: string;
    value: React.ReactNode;
    icon: LucideIcon;
    trend?: {
        value: string | number;
        label?: string; // ex: "vs mês passado"
        direction: 'up' | 'down' | 'neutral';
    };
    variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
    loading?: boolean;
    onClick?: () => void;
    className?: string; // Permite sobreposição para ajustes de layout
}
```
