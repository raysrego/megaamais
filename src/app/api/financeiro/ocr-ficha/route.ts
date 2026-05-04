// app/api/financeiro/ocr-ficha/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Apenas imagens são aceitas' }, { status: 400 });
    }

    // Salvar temporariamente
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempDir = join(process.cwd(), 'tmp');
    tempFilePath = join(tempDir, `ficha_${Date.now()}.jpg`);
    await writeFile(tempFilePath, buffer);

    // OCR com Tesseract
    const { stdout } = await execAsync(`tesseract "${tempFilePath}" stdout -l por`);
    const texto = stdout;

    // Extrair dados
    const dados = parseFichaTexto(texto);

    // Limpar arquivo temporário
    await unlink(tempFilePath);

    return NextResponse.json(dados);
  } catch (error: any) {
    console.error('[OCR] Erro:', error);
    
    // Limpar arquivo em caso de erro
    if (tempFilePath) {
      try { await unlink(tempFilePath); } catch {}
    }

    return NextResponse.json(
      { error: `Erro ao processar imagem: ${error.message}` },
      { status: 500 }
    );
  }
}

function parseFichaTexto(texto: string) {
  // Extrair data (formato DD/MM/AAAA)
  const dataMatch = texto.match(/(\d{2}\/\d{2}\/\d{4})/);
  const data = dataMatch ? dataMatch[1] : 'N/A';

  // Extrair terminal
  const terminalMatch = texto.match(/TERM\s*(\d+)/);
  const terminal = terminalMatch ? terminalMatch[1] : 'N/A';

  // Extrair jogos
  const jogos: Array<{ nome: string; quantidade: number; valor: number }> = [];
  const linhas = texto.split('\n');
  let naSecaoJogos = false;
  let naSecaoContas = false;
  let naSecaoPremios = false;

  for (const linha of linhas) {
    // Detectar início da seção de jogos
    if (linha.includes('QTDE') && linha.includes('VALOR')) {
      naSecaoJogos = true;
      continue;
    }
    
    // Detectar seção de contas
    if (linha.includes('TOTAL CONTAS') || linha.includes('NPC')) {
      naSecaoJogos = false;
      naSecaoContas = true;
    }

    // Detectar seção de prêmios
    if (linha.includes('PREMIOS PAGOS') || linha.includes('PRÊMIOS')) {
      naSecaoContas = false;
      naSecaoPremios = true;
    }

    // Extrair jogo (padrão: NOME-CODIGO QTD VALOR)
    if (naSecaoJogos) {
      const match = linha.match(/([A-Z\-\+][A-Z\-\+\s]+?)\-?\d*\s+(\d+)\s+([\d,.]+)/);
      if (match) {
        jogos.push({
          nome: match[1].trim(),
          quantidade: parseInt(match[2]),
          valor: parseFloat(match[3].replace(',', '.'))
        });
      }
    }
  }

  // Extrair totais
  const totalJogosMatch = texto.match(/TOTAL\s+JOGOS\s+\d+\s+R?\$\s*([\d,.]+)/);
  const totalContasMatch = texto.match(/TOTAL\s+CONTAS\s+\d+\s+R?\$\s*([\d,.]+)/);
  const premiosMatch = texto.match(/TOTAL\s+\d+\s+R?\$\s*([\d,.]+)/);
  
  // NPC boletos
  const npcBoletos: Array<{ valor: number }> = [];
  const npcMatches = texto.matchAll(/NPC.*?([\d,.]+)/g);
  for (const match of npcMatches) {
    npcBoletos.push({ valor: parseFloat(match[1].replace(',', '.')) });
  }

  return {
    data,
    terminal,
    jogos,
    totalJogos: totalJogosMatch ? parseFloat(totalJogosMatch[1].replace(',', '.')) : jogos.reduce((s, j) => s + j.valor, 0),
    totalContas: totalContasMatch ? parseFloat(totalContasMatch[1].replace(',', '.')) : 0,
    premiosPagos: premiosMatch ? parseFloat(premiosMatch[1].replace(',', '.')) : 0,
    quantidadePremios: 0,
    servicos: [],
    npcBoletos
  };
}
