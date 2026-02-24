import { z } from 'zod';

export const BolaoStatusSchema = z.enum(['disponivel', 'finalizado', 'cancelado']);

export const BolaoSchema = z.object({
    id: z.number().optional(),
    produtoId: z.number(),
    concurso: z.string().min(1, "O concurso é obrigatório"),
    dataSorteio: z.string().min(1, "A data do sorteio é obrigatória"),
    qtdJogos: z.number().min(1, "Mínimo de 1 jogo"),
    dezenas: z.number().min(1, "Mínimo de 1 dezena"),
    valorCotaBase: z.number().min(0.01, "O valor base deve ser maior que zero"),
    taxaAdministrativa: z.number().default(35),
    qtdCotas: z.number().min(1, "Mínimo de 1 cota"),
    precoVendaCota: z.number(),
    cotasVendidas: z.number().default(0),
    status: BolaoStatusSchema.default('disponivel'),
    createdAt: z.string().optional()
});

export type Bolao = z.infer<typeof BolaoSchema>;

// Tipo para dados do Database (snake_case)
export interface BolaoRow {
    id: number;
    produto_id: number;
    concurso: string;
    data_sorteio: string;
    qtd_jogos: number;
    dezenas: number;
    valor_cota_base: number;
    taxa_administrativa: number;
    qtd_cotas: number;
    preco_venda_cota: number;
    cotas_vendidas: number;
    status: 'disponivel' | 'finalizado' | 'cancelado';
    created_at: string;
}
