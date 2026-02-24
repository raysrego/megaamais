import { z } from 'zod';

// Schema para Categoria
export const CategoriaProdutoSchema = z.object({
    id: z.number().optional(),
    nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    icone: z.string().default('box'),
    cor: z.string().optional(),
    ativo: z.boolean().default(true)
});

export type CategoriaProduto = z.infer<typeof CategoriaProdutoSchema>;

export const JogoSchema = z.object({
    id: z.number().optional(),
    nome: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
    slug: z.string().optional(),
    cor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Cor inválida"),
    corDestaque: z.string().optional(),
    icone: z.string(),
    diasSorteio: z.array(z.number()).default([]), // Pode ser vazio para produtos físicos
    minDezenas: z.number().default(0),
    maxDezenas: z.number().default(0),
    horarioFechamento: z.string().optional(),
    ativo: z.boolean().default(true),

    // Novos campos 2.0
    categoriaId: z.number().optional(), // Opcional no submit, mas obrigatório no banco (default Loterias)
    gerenciaEstoque: z.boolean().default(false),
    precoPadrao: z.number().min(0).default(0),

    // Campos virtuais (não salvos diretamente na tb produtos, mas usados na UI)
    estoqueAtual: z.number().optional()
});

export type Jogo = z.infer<typeof JogoSchema>;

export const DIAS_SEMANA = [
    { id: 1, label: 'Seg', nome: 'Segunda-feira' },
    { id: 2, label: 'Ter', nome: 'Terça-feira' },
    { id: 3, label: 'Qua', nome: 'Quarta-feira' },
    { id: 4, label: 'Qui', nome: 'Quinta-feira' },
    { id: 5, label: 'Sex', nome: 'Sexta-feira' },
    { id: 6, label: 'Sáb', nome: 'Sábado' }
];

export const ICONES_DISPONIVEIS = [
    { value: 'clover', label: 'Trevo (Sorte)' },
    { value: 'dollar', label: 'Cifrão (Finanças)' },
    { value: 'star', label: 'Estrela (Destaque)' },
    { value: 'trophy', label: 'Troféu (Vitória)' },
    { value: 'zap', label: 'Raio (Rápido)' },
    { value: 'target', label: 'Alvo (Objetivo)' },
    { value: 'award', label: 'Medalha (Prêmio)' },
    { value: 'crown', label: 'Coroa (Rei)' },
];
