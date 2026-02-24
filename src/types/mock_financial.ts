export type TipoOperacaoCaixa =
    | 'venda'             // Venda de cota
    | 'sangria_bolao'     // Dinheiro sai do operador (vai pro Master)
    | 'suprimento_bolao'  // Dinheiro entra no Master (vindo do operador)
    | 'sangria_cofre';    // Master entrega pro cofre

export type FormaPagamento = 'pix' | 'dinheiro';

export type StatusMovimentacao =
    | 'confirmado'        // Dinheiro já está no caixa (ou Pix confirmado)
    | 'pendente_aceite'   // Operador informou que entregou, Master ainda não deu OK (opcional)
    | 'estornado';

export interface MovimentacaoCaixa {
    id: string;
    data: string;
    operador_id: string;
    operador_nome: string;
    tipo: TipoOperacaoCaixa;
    valor: number;
    forma: FormaPagamento;
    descricao: string;
    status: StatusMovimentacao;
    metadata?: {
        bolao_id?: string;
        cota_id?: string;
        comprovante_pix?: string; // URL ou base64 simulado
        caixa_sessao_id?: string;
    };
}

export interface SaldoOperador {
    operador_id: string;
    operador_nome: string;
    saldo_digital: number;      // Pix (já auditado por comprovante/classificação)
    saldo_especie_divida: number; // Dinheiro na mão do operador (A Repassar)
}
