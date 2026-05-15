export interface OFXTransacao {
    fitid: string;
    tipo: 'CREDIT' | 'DEBIT';
    data: string; // YYYY-MM-DD
    valor: number;
    memo: string;
    checknum: string;
}

export interface OFXDados {
    bankid: string;
    acctid: string;
    accttype: string;
    dtstart: string;
    dtend: string;
    transacoes: OFXTransacao[];
    saldoFinal: number;
    dtasof: string;
    moeda: string;
}

function parseOFXDate(raw: string): string {
    // Formats: 20260504120000[-3:BRT] or 20260504 or 20260504120000
    const digits = raw.replace(/\[.*\]/, '').trim();
    const y = digits.substring(0, 4);
    const m = digits.substring(4, 6);
    const d = digits.substring(6, 8);
    return `${y}-${m}-${d}`;
}

function extractTag(content: string, tag: string): string {
    const re = new RegExp(`<${tag}>([^<\\n\\r]*)`, 'i');
    const m = content.match(re);
    return m ? m[1].trim() : '';
}

function extractBlock(content: string, tag: string): string[] {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    const blocks: string[] = [];
    let m;
    while ((m = re.exec(content)) !== null) {
        blocks.push(m[1]);
    }
    return blocks;
}

export function parseOFX(content: string): OFXDados {
    // Normalize line endings
    const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const stmtrs = extractBlock(text, 'STMTRS')[0] || '';
    const bankacct = extractBlock(stmtrs, 'BANKACCTFROM')[0] || '';
    const banktranlist = extractBlock(stmtrs, 'BANKTRANLIST')[0] || '';
    const ledgerbal = extractBlock(stmtrs, 'LEDGERBAL')[0] || '';

    const bankid = extractTag(bankacct, 'BANKID');
    const acctid = extractTag(bankacct, 'ACCTID');
    const accttype = extractTag(bankacct, 'ACCTTYPE');
    const moeda = extractTag(stmtrs, 'CURDEF') || 'BRL';

    const dtstart = parseOFXDate(extractTag(banktranlist, 'DTSTART'));
    const dtend = parseOFXDate(extractTag(banktranlist, 'DTEND'));

    const balamt = parseFloat(extractTag(ledgerbal, 'BALAMT').replace(',', '.')) || 0;
    const dtasof = parseOFXDate(extractTag(ledgerbal, 'DTASOF') || extractTag(banktranlist, 'DTEND'));

    // Extract all STMTTRN blocks
    const trnBlocks = extractBlock(banktranlist, 'STMTTRN');
    const transacoes: OFXTransacao[] = trnBlocks.map((blk) => {
        const tipo = extractTag(blk, 'TRNTYPE') as 'CREDIT' | 'DEBIT';
        const dtposted = parseOFXDate(extractTag(blk, 'DTPOSTED'));
        const trnamt = parseFloat(extractTag(blk, 'TRNAMT').replace(',', '.')) || 0;
        const fitid = extractTag(blk, 'FITID');
        const checknum = extractTag(blk, 'CHECKNUM');
        const memo = extractTag(blk, 'MEMO');

        return {
            fitid,
            tipo: trnamt >= 0 ? 'CREDIT' : 'DEBIT',
            data: dtposted,
            valor: Math.abs(trnamt),
            memo,
            checknum
        };
    });

    return {
        bankid,
        acctid,
        accttype,
        dtstart,
        dtend,
        transacoes,
        saldoFinal: balamt,
        dtasof,
        moeda
    };
}
