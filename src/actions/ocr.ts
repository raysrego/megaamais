'use server';

/**
 * Ação de servidor para processar imagem via Google Vision API
 * Motor V5.0 - Ultra Resiliente (MegaB Edition)
 */
export async function processarRelatorioTFL(base64Image: string) {
    if (!base64Image) {
        throw new Error('Nenhuma imagem fornecida.');
    }

    try {
        const apiKey = process.env.GOOGLE_VISION_API_KEY;

        if (!apiKey) {
            throw new Error('Chave de API do Google Vision não configurada.');
        }

        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    requests: [
                        {
                            image: {
                                content: base64Image.split(',')[1],
                            },
                            features: [
                                {
                                    type: 'TEXT_DETECTION',
                                },
                            ],
                        },
                    ],
                }),
            }
        );

        if (!response.ok) {
            const errorBody = await response.json();
            console.error('Erro Google Vision:', errorBody);
            throw new Error(errorBody.error?.message || 'Falha na comunicação com o Google.');
        }

        const data = await response.json();
        const fullText = data.responses[0]?.fullTextAnnotation?.text || '';

        if (!fullText) {
            throw new Error('Nenhum texto identificado na imagem.');
        }


        return parseRelatorioTFL(fullText);
    } catch (error) {
        console.error('Erro no OCR:', error);
        throw error;
    }
}

function parseRelatorioTFL(text: string) {
    const normalize = (val: string) => val.toUpperCase()
        .replace(/O/g, '0')
        .replace(/[I|L|/]/g, '1')
        .replace(/S/g, '5')
        .replace(/Z/g, '2')
        .replace(/B/g, '8')
        .replace(/G/g, '6');

    const lines = text.split('\n');
    const nLines = lines.map(l => normalize(l));

    const cleanMoney = (val: string, forcePositive: boolean = false) => {
        if (!val) return '0.00';

        let isNegative = val.includes('-') || (val.includes('(') && val.includes(')'));

        // Remove R$ e outros caracteres não numéricos exceto ponto e vírgula
        let clean = val.replace(/[^\d.,]/g, '');

        // Se houver mais de um separador (ex: 30.028,95)
        // Precisamos identificar o verdadeiro separador decimal
        const lastComma = clean.lastIndexOf(',');
        const lastDot = clean.lastIndexOf('.');

        const lastSeparatorIndex = Math.max(lastComma, lastDot);

        if (lastSeparatorIndex === -1) {
            const num = parseFloat(clean || '0');
            return ((isNegative && !forcePositive) ? -Math.abs(num) : Math.abs(num)).toFixed(2);
        }

        // Verifica se o último separador parece um decimal (1 ou 2 casas)
        const decimalPart = clean.substring(lastSeparatorIndex + 1);

        if (decimalPart.length <= 2) {
            // Se for decimal, remove todos os separadores anteriores (milhar)
            const integerPart = clean.substring(0, lastSeparatorIndex).replace(/[.,]/g, '');
            const num = parseFloat(integerPart + '.' + decimalPart);
            return (isNaN(num) ? '0.00' : ((isNegative && !forcePositive) ? -Math.abs(num) : Math.abs(num)).toFixed(2));
        } else {
            // Se tiver mais de 2 casas, provavelmente era um separador de milhar lido errado
            // ou um número inteiro. Removemos tudo e tratamos como inteiro.
            const num = parseFloat(clean.replace(/[.,]/g, ''));
            return (isNaN(num) ? '0.00' : ((isNegative && !forcePositive) ? -Math.abs(num) : Math.abs(num)).toFixed(2));
        }
    };

    const findInZone = (zoneKeywords: string | string[], fieldKeywords: string[], maxLines: number = 30, forcePositive: boolean = false) => {
        const moneyRegex = /(\d[\d.\s,]*[.,]\s?\d{2}(?:-|\b)?)/g;
        let zoneStartIndex = -1;
        const zKws = Array.isArray(zoneKeywords) ? zoneKeywords : [zoneKeywords];

        for (const zKw of zKws) {
            const nZKw = normalize(zKw);
            for (let i = 0; i < nLines.length; i++) {
                if (nLines[i].includes(nZKw)) {
                    zoneStartIndex = i;
                    break;
                }
            }
            if (zoneStartIndex !== -1) break;
        }

        // Se não achou a zona, tenta busca global nos fieldKeywords
        const startSearch = zoneStartIndex !== -1 ? zoneStartIndex : 0;
        const endSearch = zoneStartIndex !== -1
            ? Math.min(startSearch + maxLines, nLines.length)
            : nLines.length;

        for (const kw of fieldKeywords) {
            const nKw = normalize(kw);
            for (let i = startSearch; i < endSearch; i++) {
                if (nLines[i].includes(nKw)) {
                    // Busca exaustiva: mesma linha + 5 linhas seguintes
                    for (let j = i; j <= Math.min(i + 5, nLines.length - 1); j++) {
                        const matches = lines[j].match(moneyRegex);
                        if (matches && matches.length > 0) {
                            return cleanMoney(matches[matches.length - 1], forcePositive);
                        }
                    }
                }
            }
        }
        return '0.00';
    };

    return {
        vendas: findInZone(['RECEBIMENTOS', 'JOGOS'], ['TOTAL JOGOS', 'JOGOS TOTAL', 'TOTAL RCTO', 'VALOR JOGOS', 'JOGOS']),
        // Busca global prioritária para TOTAL CONTAS (sem restrição de zona)
        contas: findInZone([], ['TOTAL CONTAS', 'CONTAS TOTAL', 'RECEBIMENTOS CONTAS', 'REC. CONTAS', 'REC CONTAS', 'FATURAS', 'CONTAS/FATURAS', 'CONTAS'], 999),
        premios: findInZone(['PREMIOS PAGOS', 'PREMIOS'], ['TOTAL', 'PREM', 'PAGOS'], 30, true),
        saldo: findInZone('TOTAL EM CAIXA', ['TOTAL EM CAIXA', 'TOTAL EM', 'CAIXA', 'SALDO']),

        depositos: findInZone('CORRENTE', ['DEPOSITO', 'DEP05']),
        saques: findInZone('CORRENTE', ['SAQUE', '5AQUE']),
        estornos: findInZone('ESTORNOS', ['TOTAL', 'ESTOR']),

        dataRelatorio: null,
        terminalId: null,
        raw: text
    };
}
