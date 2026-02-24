import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { Lead } from '@/data/mockData';

export function exportToExcel(leads: Lead[], filename: string = 'leads_megamais') {
    const dataFormatada = leads.map(lead => ({
        'ID': lead.id,
        'Nome': lead.nome,
        'Telefone': lead.telefone,
        'Email': lead.email,
        'Status': formatStatus(lead.status),
        'Vendedor': lead.vendedor,
        'Valor Potencial (R$)': lead.valorPotencial,
        'Data de Entrada': lead.dataEntrada,
        'Origem': lead.origem
    }));

    const ws = XLSX.utils.json_to_sheet(dataFormatada);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');

    ws['!cols'] = [
        { wch: 5 },   // ID
        { wch: 25 },  // Nome
        { wch: 18 },  // Telefone
        { wch: 30 },  // Email
        { wch: 15 },  // Status
        { wch: 20 },  // Vendedor
        { wch: 18 },  // Valor
        { wch: 15 },  // Data
        { wch: 15 },  // Origem
    ];

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportToCSV(leads: Lead[], filename: string = 'leads_megamais') {
    const headers = ['ID', 'Nome', 'Telefone', 'Email', 'Status', 'Vendedor', 'Valor Potencial', 'Data Entrada', 'Origem'];
    const rows = leads.map(lead => [
        lead.id,
        lead.nome,
        lead.telefone,
        lead.email,
        formatStatus(lead.status),
        lead.vendedor,
        lead.valorPotencial,
        lead.dataEntrada,
        lead.origem
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
}

export interface ImportResult {
    success: boolean;
    leads: Partial<Lead>[];
    errors: string[];
    totalRows: number;
}

export async function importFromFile(file: File): Promise<ImportResult> {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

                if (jsonData.length < 2) {
                    resolve({ success: false, leads: [], errors: ['Arquivo vazio ou sem dados'], totalRows: 0 });
                    return;
                }

                const headers = jsonData[0].map((h: any) => normalizeHeader(String(h || '')));
                const leads: Partial<Lead>[] = [];
                const errors: string[] = [];

                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length === 0) continue;

                    const lead = mapRowToLead(headers, row);

                    if (!lead.nome && !lead.telefone) {
                        errors.push(`Linha ${i + 1}: Nome ou telefone obrigatório`);
                        continue;
                    }

                    leads.push(lead);
                }

                resolve({
                    success: true,
                    leads,
                    errors,
                    totalRows: jsonData.length - 1
                });
            } catch (error) {
                resolve({
                    success: false,
                    leads: [],
                    errors: ['Erro ao processar arquivo: ' + (error as Error).message],
                    totalRows: 0
                });
            }
        };

        reader.readAsArrayBuffer(file);
    });
}

function formatStatus(status: string): string {
    const map: Record<string, string> = {
        'novo': 'Novo',
        'em_contato': 'Em Contato',
        'convertido': 'Convertido',
        'perdido': 'Perdido'
    };
    return map[status] || status;
}

function normalizeHeader(header: string): string {
    return header
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function mapRowToLead(headers: string[], row: any[]): Partial<Lead> {
    const getValue = (possibleNames: string[]): string => {
        for (const name of possibleNames) {
            const index = headers.findIndex(h => h.includes(name));
            if (index !== -1 && row[index] !== undefined) {
                return String(row[index]);
            }
        }
        return '';
    };

    const getNumericValue = (possibleNames: string[]): number => {
        const value = getValue(possibleNames);
        return parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    };

    const statusRaw = getValue(['status', 'situacao', 'etapa']).toLowerCase();
    let status: Lead['status'] = 'novo';
    if (statusRaw.includes('contato') || statusRaw.includes('andamento')) {
        status = 'em_contato';
    } else if (statusRaw.includes('convert') || statusRaw.includes('fechad') || statusRaw.includes('ganho')) {
        status = 'convertido';
    } else if (statusRaw.includes('perdid') || statusRaw.includes('cancel')) {
        status = 'perdido';
    }

    return {
        nome: getValue(['nome', 'cliente', 'name']) || getValue(['razao', 'razaosocial']),
        telefone: getValue(['telefone', 'celular', 'phone', 'whatsapp', 'fone']),
        email: getValue(['email', 'mail', 'correio']),
        status,
        vendedor: getValue(['vendedor', 'atendente', 'responsavel', 'seller']),
        valorPotencial: getNumericValue(['valor', 'potencial', 'value', 'ticket']),
        origem: getValue(['origem', 'fonte', 'source', 'canal']),
        dataEntrada: getValue(['data', 'entrada', 'cadastro', 'date']) || new Date().toISOString().split('T')[0]
    };
}
