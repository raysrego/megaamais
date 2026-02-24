# 🔔 Supabase Realtime - Notificações Instantâneas

## 📋 Visão Geral

Sistema de notificações em **tempo real** usando **Supabase Realtime** (websocket push).

Substituiu o polling (refresh a cada 5 min) por **notificações instantâneas** quando eventos ocorrem no banco de dados.

---

## ✨ Como Funciona

### **Antes (Polling)**
```typescript
// Verificava mudanças a cada 5 minutos
setInterval(() => {
    fetchNotificacoes(); // Busca no banco
}, 5 * 60 * 1000);
```

❌ **Problemas:**
- Atraso de até 5 minutos
- Desperdício de requisições
- Não escalável

---

### **Agora (Realtime)**
```typescript
// Websocket: servidor PUSH quando algo muda
supabase
  .channel('financeiro-notifications')
  .on('INSERT', payload => {
    // ⚡ Notificação INSTANTÂNEA!
    fetchNotificacoes();
  })
  .subscribe();
```

✅ **Vantagens:**
- **Instantâneo** (< 1 segundo)
- Sem desperdício de requisições
- Escalável para milhares de usuários

---

## 🎯 Eventos Monitorados

| Tabela | Evento | Ação |
|--------|--------|------|
| `financeiro_contas` | INSERT | Nova conta criada → Notificação |
| `financeiro_contas` | UPDATE | Status mudou → Atualizar badge |
| `financeiro_contas` | DELETE | Conta removida → Limpar notificação |
| `caixa_sessoes` | INSERT/UPDATE | Caixa aberto/fechado → Alert |
| `boloes` | INSERT | Novo bolão → Atualizar dashboard |
| `vendas_boloes` | INSERT | Venda realizada → Notificação |
| `cofre_movimentacoes` | INSERT | Movimentação → Alert gerente |

---

## 🔌 Canais por Loja

O sistema cria canais **isolados por loja** para evitar que um operador veja notificações de outras filiais:

```typescript
// Operador da Loja A
canal: 'financeiro-notifications-loja-a'

// Operador da Loja B
canal: 'financeiro-notifications-loja-b'

// Admin (vê tudo)
canal: 'financeiro-notifications-global'
```

---

## 🧪 Como Testar

### **Teste 1: Nova Conta Financeira**
1. Abra 2 abas do navegador (Admin + Gerente)
2. Admin cria uma nova despesa no Financeiro
3. **Resultado esperado:** Gerente recebe notificação instantânea (badge atualiza sozinho)

### **Teste 2: Baixa de Conta**
1. Admin dá baixa em uma conta pendente
2. **Resultado esperado:** Notificação some automaticamente para todos

### **Teste 3: Fechamento de Caixa**
1. Operador fecha o caixa TFL
2. **Resultado esperado:** Gerente recebe alerta de fechamento pendente

---

## 🛠️ Arquivos Modificados

```
✅ src/hooks/useNotificacoes.ts
   - Adicionado Supabase Realtime
   - Removido polling (setInterval)
   - Subscriptions para INSERT/UPDATE/DELETE

✅ supabase/migrations/20260203203000_enable_realtime.sql
   - Habilitado replicação para tabelas críticas
   - ALTER PUBLICATION supabase_realtime
```

---

## 📊 Performance

| Métrica | Polling (5min) | Realtime |
|---------|----------------|----------|
| **Latência** | Até 5 minutos | < 1 segundo |
| **Requisições/hora** | 12 por usuário | 0 (push) |
| **Escalabilidade** | Ruim | Excelente |
| **Uso de recursos** | Alto | Baixo |

---

## 🔒 Segurança

✅ **Row Level Security (RLS)** continua ativo  
✅ Usuários só veem notificações da **sua loja**  
✅ Admin vê notificações de **todas as lojas**  
✅ Canal único por loja (isolamento)

---

## 🐛 Debug

Para verificar se o Realtime está funcionando, abra o Console do navegador:

```javascript
// Deve aparecer:
✅ Realtime conectado para notificações financeiras

// Quando criar uma conta:
🔔 Nova conta criada (Realtime): { id: 123, ... }

// Ao desmontar o componente:
🔌 Realtime desconectado
```

---

## 🚀 Próximos Passos

- [ ] Adicionar notificações de bolões vencedores
- [ ] Notificar operadores sobre metas atingidas
- [ ] Alertas de sangrias pendentes no cofre
- [ ] Notificações de auditoria (divergências)

---

## 📚 Referências

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
