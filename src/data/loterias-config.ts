export interface LoteriaVisualConfig {
    nome: string;
    cor: string;
    corDestaque: string;
    corTexto: string;
    temPlus?: boolean;
}

export const LOTERIAS_OFFICIAL: Record<string, LoteriaVisualConfig> = {
    'mega-sena': {
        nome: 'Mega-Sena',
        cor: '#209869',
        corDestaque: '#B5DBAA',
        corTexto: '#FFFFFF'
    },
    'lotofacil': {
        nome: 'Lotofácil',
        cor: '#930089',
        corDestaque: '#D58EC6',
        corTexto: '#FFFFFF'
    },
    'quina': {
        nome: 'Quina',
        cor: '#260085',
        corDestaque: '#5B55A2',
        corTexto: '#FFFFFF'
    },
    'milionaria': {
        nome: '+Milionária',
        cor: '#1C307D',
        corDestaque: '#FFFFFF',
        corTexto: '#FFFFFF',
        temPlus: true
    },
    'dupla-sena': {
        nome: 'Dupla Sena',
        cor: '#A6133C',
        corDestaque: '#D98BA3',
        corTexto: '#FFFFFF'
    },
    'dia-de-sorte': {
        nome: 'Dia de Sorte',
        cor: '#CBAC19',
        corDestaque: '#EFCF5A',
        corTexto: '#FFFFFF'
    },
    'timemania': {
        nome: 'Timemania',
        cor: '#FFF100',
        corDestaque: '#009646',
        corTexto: '#041E42' // Azul marinho pro texto pois o fundo é amarelo
    },
    'loteira-federal': {
        nome: 'Federal',
        cor: '#1A4997',
        corDestaque: '#99B9E1',
        corTexto: '#FFFFFF'
    },
    'lotomania': {
        nome: 'Lotomania',
        cor: '#F28000',
        corDestaque: '#FAD3A7',
        corTexto: '#FFFFFF'
    },
    'loteca': {
        nome: 'Loteca',
        cor: '#A41C24',
        corDestaque: '#FFFFFF',
        corTexto: '#FFFFFF'
    },
    'super-sete': {
        nome: 'Super Sete',
        cor: '#93C83D',
        corDestaque: '#D0E5A7',
        corTexto: '#006B3F'
    }
};
