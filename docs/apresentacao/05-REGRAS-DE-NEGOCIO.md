# 📋 Regras de Negócio — MegaMais

## 1. Bolões e Loterias

### Ágio (Taxa Administrativa)
- Valor padrão: **35%** sobre o valor base da cota
- Configurável entre 0% e 35%
- Exemplo: Cota base R$10,00 → Venda R$13,50 → Lucro R$3,50

### Margem de Jogos Avulsos
- Comissão da Caixa Econômica Federal: **8,61%** sobre vendas de jogos individuais
- Este é o lucro da lotérica em vendas avulsas (não-bolão)

### Prazo de Resgate de Prêmios
- **90 dias** a partir da data do sorteio
- Após esse período, prêmios prescrevem

### Validações de Bolão
- Quantidade de cotas: 1 a 1.000
- Preço de venda: R$0,01 a R$100.000
- Taxa administrativa: 0% a 100%
- Concurso: máximo 20 caracteres

---

## 2. Caixa Operacional

### Abertura de Caixa
- Fundo de caixa padrão: **R$100,00** (trocados para início do dia)
- Operador vincula-se ao terminal TFL para rastreabilidade
- Apenas **uma sessão aberta por operador** por vez

### Tipos de Movimentação
| Tipo | Efeito no Saldo | Descrição |
|---|---|---|
| `venda` | ➕ Soma | Venda de bilhetes, jogos |
| `pix` | ➕ Soma | Recebimento via PIX |
| `suprimento` | ➕ Soma | Entrada de dinheiro no caixa |
| `sangria` | ➖ Subtrai | Retirada de dinheiro |
| `pagamento` | ➖ Subtrai | Pagamento de conta |
| `deposito` | ➖ Subtrai | Depósito em outra filial |
| `boleto` | ➖ Subtrai | Pagamento de boleto |
| `estorno` | ➖ Subtrai | Estorno de operação |
| `trocados` | — Neutro | Troca de notas (não altera saldo) |

### Fechamento de Caixa
1. Operador informa valor declarado em mãos
2. Sistema compara com saldo calculado E dados TFL
3. Se houver diferença → Status **"discrepante"**
4. Se tudo bater → Status **"fechado"**
5. Gerente/admin valida o fechamento (aprova ou rejeita)

### Integração TFL (Terminal Full Lotérico)
O fechamento recebe dados do relatório do terminal:
- `tfl_vendas` — Total de vendas no terminal
- `tfl_premios` — Prêmios pagos
- `tfl_contas` — Contas pagas
- `tfl_saldo_projetado` — Saldo esperado
- `tfl_pix_total` — PIX recebido via maquininha

---

## 3. Financeiro — Filosofia "Excel Turbo"

O módulo financeiro foi desenhado para funcionar **como o gestor já trabalha no Excel**, mas melhor:

### O que é o modelo "Excel Turbo"?
- **SEM automação oculta** — O sistema **nunca** gera despesas sozinho
- **O gestor é dono dos dados** — Ele lança, edita, exclui. Como numa planilha, mas com segurança
- **Categorias = catálogo** — São como uma "tabela auxiliar" que pré-preenche valores ao lançar
- **Replicar Mês = o "arrastar para baixo"** — Em vez de copiar células, copia um mês inteiro com um clique

### Modalidades de Despesa
| Modalidade | Exemplo | Como funciona |
|---|---|---|
| **Fixo Mensal** | Aluguel, internet, seguro | Mesmo valor todo mês — ideal pra "Replicar" |
| **Fixo Variável** | Luz, água, telefone | Todo mês, mas valor varia — replica e ajusta |
| **Variável** | Manutenção, material | Eventual — lança manualmente quando acontece |

### Ciclo de vida de um lançamento
```
Criado (Pendente) → Pago (com comprovante) → Finalizado
                  → Atrasado (vencimento passado)
                  → Cancelado (removido)
```

### Replicar Mês — O recurso-chave
- O botão "Replicar Mês" copia todos os lançamentos do mês anterior para o mês atual
- Permite selecionar quais itens replicar (ex: só os fixos mensais)
- Valores são copiados do mês anterior, editáveis antes de confirmar
- **Este é o método principal** para lançar despesas fixas
- Substitui a automação que gerava registros duplicados no passado

### Baixa de Pagamento
- Registra data de pagamento, método (PIX, dinheiro, boleto, cartão) e comprovante
- Comprovante é salvo no Supabase Storage
- Preparado para OCR futuro (Google Vision API configurada)

---

## 4. Metas de Comissão de Operadores

| Nível | Vendas Mínimas | Bônus Mensal |
|---|---|---|
| Bronze ⭐ | R$10.000 | R$600 |
| Prata ⭐⭐ | R$20.000 | R$700 |
| Ouro ⭐⭐⭐ | R$25.000 | R$800 |
| Diamante 💎 | R$30.000 | R$1.000 |

---

## 5. Segurança e Permissões

### Roles (RBAC)
| Role | Pode ver | Pode fazer |
|---|---|---|
| `admin` | Tudo, todas as filiais | Tudo (CRUD completo, validações, config) |
| `gerente` | Sua filial | Financeiro, cofre, validar caixas |
| `operador` | Apenas seu caixa | Abrir/fechar caixa, vender bolões |

### Multi-tenant
- Cada registro tem `loja_id` vinculando à filial
- Admin vê tudo; outros veem apenas sua filial
- Implementado via RLS no PostgreSQL (impossível de burlar)

---

## 6. Validações do Sistema

### Financeiro
- Valor da transação: R$0,01 a R$1.000.000
- Métodos de pagamento aceitos: `dinheiro`, `pix`, `cartao_debito`, `cartao_credito`
- Descrição máxima: 500 caracteres

### Caixa
- Valor inicial: R$0 a R$100.000
- Sangria: valor obrigatoriamente negativo
- Entradas: valor obrigatoriamente positivo
