// Mock Data para o Protótipo MegaMais

export interface Lead {
    id: number;
    nome: string;
    telefone: string;
    email: string;
    status: 'novo' | 'em_contato' | 'convertido' | 'perdido';
    vendedor: string;
    valorPotencial: number;
    dataEntrada: string;
    origem: string;
}

export interface Vendedor {
    id: number;
    nome: string;
    avatar: string;
    leadsAtivos: number;
    conversoes: number;
    taxaConversao: number;
}

export interface KPI {
    totalLeads: number;
    leadsNovos: number;
    taxaConversao: number;
    cmvMedio: number;
    cac: number;
    ticketMedio: number;
    receitaMensal: number;
}

// Leads Simulados
export const mockLeads: Lead[] = [
    { id: 1, nome: 'Maria Silva Santos', telefone: '(11) 99999-1234', email: 'maria.silva@email.com', status: 'novo', vendedor: 'João Oliveira', valorPotencial: 450, dataEntrada: '2026-01-22', origem: 'WhatsApp' },
    { id: 2, nome: 'Carlos Eduardo Lima', telefone: '(11) 98888-5678', email: 'carlos.lima@email.com', status: 'em_contato', vendedor: 'Ana Costa', valorPotencial: 1200, dataEntrada: '2026-01-21', origem: 'Facebook' },
    { id: 3, nome: 'Fernanda Rodrigues', telefone: '(11) 97777-9012', email: 'fernanda.r@email.com', status: 'convertido', vendedor: 'João Oliveira', valorPotencial: 800, dataEntrada: '2026-01-20', origem: 'Instagram' },
    { id: 4, nome: 'Roberto Almeida', telefone: '(11) 96666-3456', email: 'roberto.a@email.com', status: 'em_contato', vendedor: 'Pedro Santos', valorPotencial: 2500, dataEntrada: '2026-01-21', origem: 'Site' },
    { id: 5, nome: 'Juliana Mendes', telefone: '(11) 95555-7890', email: 'juliana.m@email.com', status: 'perdido', vendedor: 'Ana Costa', valorPotencial: 350, dataEntrada: '2026-01-19', origem: 'WhatsApp' },
    { id: 6, nome: 'André Souza', telefone: '(11) 94444-2345', email: 'andre.souza@email.com', status: 'novo', vendedor: 'João Oliveira', valorPotencial: 600, dataEntrada: '2026-01-22', origem: 'Indicação' },
    { id: 7, nome: 'Patrícia Ferreira', telefone: '(11) 93333-6789', email: 'patricia.f@email.com', status: 'convertido', vendedor: 'Pedro Santos', valorPotencial: 1800, dataEntrada: '2026-01-18', origem: 'Facebook' },
    { id: 8, nome: 'Lucas Martins', telefone: '(11) 92222-0123', email: 'lucas.m@email.com', status: 'em_contato', vendedor: 'Ana Costa', valorPotencial: 950, dataEntrada: '2026-01-20', origem: 'Instagram' },
    { id: 9, nome: 'Camila Barbosa', telefone: '(11) 91111-4567', email: 'camila.b@email.com', status: 'novo', vendedor: 'Pedro Santos', valorPotencial: 400, dataEntrada: '2026-01-22', origem: 'WhatsApp' },
    { id: 10, nome: 'Ricardo Nunes', telefone: '(11) 90000-8901', email: 'ricardo.n@email.com', status: 'convertido', vendedor: 'João Oliveira', valorPotencial: 3200, dataEntrada: '2026-01-17', origem: 'Site' },
];

// Vendedores Simulados
export const mockVendedores: Vendedor[] = [
    { id: 1, nome: 'João Oliveira', avatar: 'JO', leadsAtivos: 28, conversoes: 12, taxaConversao: 42.8 },
    { id: 2, nome: 'Ana Costa', avatar: 'AC', leadsAtivos: 35, conversoes: 8, taxaConversao: 22.8 },
    { id: 3, nome: 'Pedro Santos', avatar: 'PS', leadsAtivos: 22, conversoes: 15, taxaConversao: 68.2 },
    { id: 4, nome: 'Mariana Lima', avatar: 'ML', leadsAtivos: 18, conversoes: 6, taxaConversao: 33.3 },
];

// KPIs Simulados
export const mockKPIs: KPI = {
    totalLeads: 847,
    leadsNovos: 142,
    taxaConversao: 23.5,
    cmvMedio: 45.80,
    cac: 12.30,
    ticketMedio: 280.00,
    receitaMensal: 158750.00,
};

// Dados do Funil
export const mockFunnel = [
    { etapa: 'Leads Novos', valor: 847, porcentagem: 100 },
    { etapa: 'Em Contato', valor: 523, porcentagem: 61.7 },
    { etapa: 'Negociação', valor: 287, porcentagem: 33.9 },
    { etapa: 'Convertidos', valor: 199, porcentagem: 23.5 },
];

// Dados para gráfico de linha (tendência)
export const mockTrendData = [
    { dia: 'Seg', leads: 45, conversoes: 12 },
    { dia: 'Ter', leads: 52, conversoes: 15 },
    { dia: 'Qua', leads: 48, conversoes: 11 },
    { dia: 'Qui', leads: 70, conversoes: 18 },
    { dia: 'Sex', leads: 65, conversoes: 22 },
    { dia: 'Sáb', leads: 38, conversoes: 8 },
    { dia: 'Dom', leads: 25, conversoes: 6 },
];

// Scripts de Atendimento
export const mockScripts = [
    {
        id: 1,
        nome: 'Primeiro Contato - WhatsApp',
        categoria: 'Inicial',
        texto: 'Olá! Tudo bem? Aqui é o {vendedor} da MegaMais Loterias. Vi que você demonstrou interesse em nossos jogos. Posso te ajudar?',
        ativo: true,
    },
    {
        id: 2,
        nome: 'Follow-up 24h',
        categoria: 'Acompanhamento',
        texto: 'Olá {nome}! Passando para saber se você conseguiu avaliar nossa proposta. Tem alguma dúvida que eu possa esclarecer?',
        ativo: true,
    },
    {
        id: 3,
        nome: 'Oferta Especial',
        categoria: 'Conversão',
        texto: 'Ótima notícia, {nome}! Temos uma promoção especial esta semana: na compra de 3 jogos, você ganha 1 grátis! Posso reservar para você?',
        ativo: true,
    },
    {
        id: 4,
        nome: 'Recuperação de Lead',
        categoria: 'Reativação',
        texto: 'Olá {nome}! Faz um tempo que não conversamos. Vi que você estava interessado em nossos jogos. Posso te contar as novidades?',
        ativo: false,
    },
];

// Regras de Atribuição
export const mockRegrasAtribuicao = [
    { id: 1, nome: 'Round Robin', descricao: 'Distribui leads igualmente entre vendedores', ativo: true },
    { id: 2, nome: 'Por Capacidade', descricao: 'Prioriza vendedores com menos leads ativos', ativo: false },
    { id: 3, nome: 'Por Performance', descricao: 'Prioriza vendedores com maior taxa de conversão', ativo: false },
    { id: 4, nome: 'Por Origem', descricao: 'Atribui baseado na origem do lead', ativo: false },
];

export interface Bolao {
    id: number;
    jogo: string;
    concurso: string;
    valorCota: number;
    totalCotas: number;
    cotasVendidas: number;
    agio: number; // Porcentagem de lucro
    dataSorteio: string;
    cor: string;
}

export const mockBoloes: Bolao[] = [
    {
        id: 1,
        jogo: 'Mega-Sena',
        concurso: '2678',
        valorCota: 50,
        totalCotas: 20,
        cotasVendidas: 15,
        agio: 30,
        dataSorteio: '2026-01-24',
        cor: '#22c55e'
    },
    {
        id: 2,
        jogo: 'Lotofácil',
        concurso: '3012',
        valorCota: 25,
        totalCotas: 40,
        cotasVendidas: 38,
        agio: 25,
        dataSorteio: '2026-01-22',
        cor: '#8b5cf6'
    },
    {
        id: 3,
        jogo: 'Quina',
        concurso: '6345',
        valorCota: 15,
        totalCotas: 30,
        cotasVendidas: 10,
        agio: 40,
        dataSorteio: '2026-01-23',
        cor: '#3b82f6'
    },
    {
        id: 4,
        jogo: 'Mais Milionária',
        concurso: '115',
        valorCota: 100,
        totalCotas: 10,
        cotasVendidas: 2,
        agio: 20,
        dataSorteio: '2026-01-24',
        cor: '#f59e0b'
    }
];

export interface TerminalData {
    id: number;
    numeroTFL: string;
    operador: string;
    volumeVendas: number;
    volumePagamentos: number;
    status: 'online' | 'offline' | 'manutencao';
    tempoMedioAtendimento: string;
}

export const mockTerminais: TerminalData[] = [
    { id: 1, numeroTFL: 'TFL-01', operador: 'Cláudio Silva', volumeVendas: 4500, volumePagamentos: 12000, status: 'online', tempoMedioAtendimento: '1m 20s' },
    { id: 2, numeroTFL: 'TFL-02', operador: 'Marta Souza', volumeVendas: 5800, volumePagamentos: 8500, status: 'online', tempoMedioAtendimento: '1m 45s' },
    { id: 3, numeroTFL: 'TFL-03', operador: 'Junior Lima', volumeVendas: 2100, volumePagamentos: 15400, status: 'online', tempoMedioAtendimento: '2m 10s' },
    { id: 4, numeroTFL: 'TFL-04', operador: '-', volumeVendas: 0, volumePagamentos: 0, status: 'offline', tempoMedioAtendimento: '-' },
    { id: 5, numeroTFL: 'TFL-05', operador: 'Soraia Alves', volumeVendas: 3900, volumePagamentos: 9800, status: 'online', tempoMedioAtendimento: '1m 55s' },
    { id: 6, numeroTFL: 'TFL-06', operador: '-', volumeVendas: 0, volumePagamentos: 0, status: 'manutencao', tempoMedioAtendimento: '-' },
];

export const mockPeakHours = [
    { hora: '08:00', clientes: 12 },
    { hora: '09:00', clientes: 25 },
    { hora: '10:00', clientes: 48 },
    { hora: '11:00', clientes: 65 },
    { hora: '12:00', clientes: 82 },
    { hora: '13:00', clientes: 55 },
    { hora: '14:00', clientes: 42 },
    { hora: '15:00', clientes: 60 },
    { hora: '16:00', clientes: 75 },
    { hora: '17:00', clientes: 95 },
    { hora: '18:00', clientes: 30 },
];

export interface Sorteio {
    id: number;
    jogo: string;
    concurso: string;
    dataSorteio: string;
    horario: string;
    premio: number;
    acumulado: boolean;
    cor: string;
}

export const mockSorteios: Sorteio[] = [
    { id: 1, jogo: 'Mega-Sena', concurso: '2678', dataSorteio: '2026-01-22', horario: '20:00', premio: 45000000, acumulado: true, cor: '#22c55e' },
    { id: 2, jogo: 'Lotofácil', concurso: '3012', dataSorteio: '2026-01-22', horario: '20:00', premio: 1500000, acumulado: false, cor: '#8b5cf6' },
    { id: 3, jogo: 'Quina', concurso: '6345', dataSorteio: '2026-01-23', horario: '20:00', premio: 8000000, acumulado: true, cor: '#3b82f6' },
    { id: 4, jogo: 'Lotomania', concurso: '2450', dataSorteio: '2026-01-23', horario: '20:00', premio: 2500000, acumulado: false, cor: '#f59e0b' },
    { id: 5, jogo: 'Mais Milionária', concurso: '115', dataSorteio: '2026-01-24', horario: '20:00', premio: 125000000, acumulado: true, cor: '#ef4444' },
    { id: 6, jogo: 'Dupla Sena', concurso: '2580', dataSorteio: '2026-01-24', horario: '20:00', premio: 3200000, acumulado: false, cor: '#06b6d4' },
    { id: 7, jogo: 'Mega-Sena', concurso: '2679', dataSorteio: '2026-01-25', horario: '20:00', premio: 3000000, acumulado: false, cor: '#22c55e' },
    { id: 8, jogo: 'Lotofácil', concurso: '3013', dataSorteio: '2026-01-25', horario: '20:00', premio: 1700000, acumulado: false, cor: '#8b5cf6' },
];

export interface Movimentacao {
    id: number;
    tipo: 'deposito' | 'saque' | 'pagamento' | 'venda' | 'bolao';
    descricao: string;
    valor: number;
    terminal: string;
    operador: string;
    horario: string;
    data: string;
}

export const mockMovimentacoes: Movimentacao[] = [
    { id: 1, tipo: 'venda', descricao: 'Mega-Sena Conc. 2678', valor: 150, terminal: 'TFL-01', operador: 'Cláudio Silva', horario: '08:15', data: '2026-01-22' },
    { id: 2, tipo: 'pagamento', descricao: 'Conta Luz - CEMAR', valor: 245.80, terminal: 'TFL-02', operador: 'Marta Souza', horario: '08:22', data: '2026-01-22' },
    { id: 3, tipo: 'deposito', descricao: 'Depósito Caixa', valor: 500, terminal: 'TFL-03', operador: 'Junior Lima', horario: '08:30', data: '2026-01-22' },
    { id: 4, tipo: 'bolao', descricao: 'Bolão Mega-Sena (3 cotas)', valor: 150, terminal: 'TFL-01', operador: 'Cláudio Silva', horario: '09:05', data: '2026-01-22' },
    { id: 5, tipo: 'saque', descricao: 'Saque Benefício INSS', valor: 1200, terminal: 'TFL-05', operador: 'Soraia Alves', horario: '09:15', data: '2026-01-22' },
    { id: 6, tipo: 'pagamento', descricao: 'Boleto Bancário', valor: 890, terminal: 'TFL-02', operador: 'Marta Souza', horario: '09:30', data: '2026-01-22' },
];

export interface FechamentoCaixa {
    id: number;
    terminal: string;
    operador: string;
    dataAbertura: string;
    dataFechamento: string | null;
    saldoInicial: number;
    saldoEsperado: number;
    saldoInformado: number | null;
    status: 'aberto' | 'fechado_ok' | 'quebra' | 'sobra';
    diferenca: number | null;
}

export const mockFechamentos: FechamentoCaixa[] = [
    { id: 1, terminal: 'TFL-01', operador: 'Cláudio Silva', dataAbertura: '2026-01-22 08:00', dataFechamento: null, saldoInicial: 500, saldoEsperado: 4250, saldoInformado: null, status: 'aberto', diferenca: null },
    { id: 2, terminal: 'TFL-02', operador: 'Marta Souza', dataAbertura: '2026-01-21 08:00', dataFechamento: '2026-01-21 18:00', saldoInicial: 500, saldoEsperado: 3800, saldoInformado: 3800, status: 'fechado_ok', diferenca: 0 },
    { id: 3, terminal: 'TFL-03', operador: 'Junior Lima', dataAbertura: '2026-01-21 08:00', dataFechamento: '2026-01-21 18:00', saldoInicial: 500, saldoEsperado: 2950, saldoInformado: 2920, status: 'quebra', diferenca: -30 },
];

// Sangria/Suprimento para FluxoCaixa
export interface SangriaSuprimento {
    id: number;
    tipo: 'sangria' | 'suprimento';
    valor: number;
    terminal: string;
    operador: string;
    horario: string;
    motivo: string;
}

export const mockSangrias: SangriaSuprimento[] = [
    { id: 1, tipo: 'sangria', valor: 500, terminal: 'TFL-01', operador: 'Cláudio Silva', horario: '10:30', motivo: 'Excesso de caixa' },
    { id: 2, tipo: 'suprimento', valor: 200, terminal: 'TFL-02', operador: 'Marta Souza', horario: '09:00', motivo: 'Troco' },
    { id: 3, tipo: 'sangria', valor: 1000, terminal: 'TFL-03', operador: 'Junior Lima', horario: '14:00', motivo: 'Envio cofre' },
];

// Sangria Pendente para GestaoCofre
export interface SangriaPendente {
    id: number;
    operador: string;
    terminal: string;
    valor: number;
    motivo: string;
    data: string;
    horario: string;
    status: 'pendente' | 'conferido' | 'depositado';
}

export const mockSangriasPendentes: SangriaPendente[] = [
    { id: 1, operador: 'Cláudio Silva', terminal: 'TFL-01', valor: 500, motivo: 'Excesso', data: '2026-01-22', horario: '10:30', status: 'pendente' },
    { id: 2, operador: 'Junior Lima', terminal: 'TFL-03', valor: 1000, motivo: 'Cofre', data: '2026-01-22', horario: '14:00', status: 'conferido' },
];

// Depósito Bancário
export interface DepositoBancario {
    id: number;
    valor: number;
    contaDestino: string;
    data: string;
    comprovante: string;
    status: 'pendente' | 'concluido';
}

export const mockDepositos: DepositoBancario[] = [
    { id: 1, valor: 5000, contaDestino: 'Caixa Econômica (001)', data: '2026-01-21', comprovante: 'DEP-001', status: 'concluido' },
    { id: 2, valor: 3000, contaDestino: 'Banco do Brasil (002)', data: '2026-01-20', comprovante: 'DEP-002', status: 'concluido' },
];

// Cofre
export const mockCofre = {
    saldoAtual: 8500,
    ultimaAtualizacao: '2026-01-22 15:00'
};

// Contas Futuras (A Pagar / A Receber)
export interface ContaFutura {
    id: number;
    descricao: string;
    valor: number;
    vencimento: string;
    tipo: 'pagar' | 'receber';
    status: 'pendente' | 'atrasado' | 'pago';
    categoria: string;
}

export const mockContasFuturas: ContaFutura[] = [
    { id: 1, descricao: 'Energia Elétrica - Equatorial', valor: 850.00, vencimento: '2026-02-10', tipo: 'pagar', status: 'pendente', categoria: 'Utilidades' },
    { id: 2, descricao: 'Aluguel do Imóvel', valor: 2500.00, vencimento: '2026-02-05', tipo: 'pagar', status: 'pendente', categoria: 'Infraestrutura' },
    { id: 3, descricao: 'Internet Fibra', valor: 199.90, vencimento: '2026-02-08', tipo: 'pagar', status: 'pendente', categoria: 'Comunicação' },
    { id: 4, descricao: 'Repasse Caixa (Vendas Cartão)', valor: 4200.00, vencimento: '2026-02-12', tipo: 'receber', status: 'pendente', categoria: 'Vendas' },
    { id: 5, descricao: 'Reembolso Benefícios', valor: 1200.00, vencimento: '2026-02-15', tipo: 'receber', status: 'pendente', categoria: 'Repasses' },
    { id: 6, descricao: 'Seguro da Loja', valor: 450.00, vencimento: '2026-01-25', tipo: 'pagar', status: 'atrasado', categoria: 'Taxas' },
];

export interface BolaoDetalhe {
    id: number;
    jogoPrincipal: string; // 'Mega-Sena', 'Lotofácil', etc.
    titulo: string;
    subtitulo: string;
    cotasRestantes: number;
    status: 'disponivel' | 'finalizado';
}

export const mockListaBoloes: BolaoDetalhe[] = [
    // Mega-Sena
    { id: 1, jogoPrincipal: 'Mega-Sena', titulo: 'Bolão Mega-Sena 2J-12D-30C', subtitulo: 'Loteria Natureza • 2 jogos | 12 números | 30 cotas', cotasRestantes: 10, status: 'disponivel' },
    { id: 2, jogoPrincipal: 'Mega-Sena', titulo: 'Bolão Mega-Sena 1J-9D-10C', subtitulo: 'Loteria Natureza • 1 jogo | 9 números | 10 cotas', cotasRestantes: 2, status: 'disponivel' },
    { id: 3, jogoPrincipal: 'Mega-Sena', titulo: 'Bolão Mega-Sena 1J-8D-9C', subtitulo: 'Loteria Natureza • 1 jogo | 8 números | 9 cotas', cotasRestantes: 0, status: 'finalizado' },
    { id: 4, jogoPrincipal: 'Mega-Sena', titulo: 'Bolão Mega-Sena 2J-8D-10C', subtitulo: 'Loteria Natureza • 2 jogos | 8 números | 10 cotas', cotasRestantes: 3, status: 'disponivel' },
    { id: 5, jogoPrincipal: 'Mega-Sena', titulo: 'Bolão Mega-Sena 2J-8D-10C (2)', subtitulo: 'Loteria Natureza • 2 jogos | 8 números | 10 cotas', cotasRestantes: 2, status: 'disponivel' },
    // Lotofácil
    { id: 6, jogoPrincipal: 'Lotofácil', titulo: 'Bolão Lotofácil 1J-18D-12C', subtitulo: 'Loteria Natureza • 1 jogo | 18 números | 12 cotas', cotasRestantes: 2, status: 'disponivel' },
    { id: 7, jogoPrincipal: 'Lotofácil', titulo: 'Bolão Lotofácil 1J-17D-6C', subtitulo: 'Loteria Natureza • 1 jogo | 17 números | 6 cotas', cotasRestantes: 1, status: 'disponivel' },
    { id: 8, jogoPrincipal: 'Lotofácil', titulo: 'Bolão Lotofácil 2J-16D-8C', subtitulo: 'Loteria Natureza • 2 jogos | 16 números | 8 cotas', cotasRestantes: 0, status: 'finalizado' },
];
