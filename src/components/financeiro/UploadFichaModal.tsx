// components/financeiro/UploadFichaModal.tsx
'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface DadosExtraidos {
  data: string;
  terminal: string;
  jogos: Array<{ nome: string; quantidade: number; valor: number }>;
  totalJogos: number;
  totalContas: number;
  premiosPagos: number;
  quantidadePremios: number;
  servicos: Array<{ tipo: string; quantidade: number; valor: number }>;
  totalEmCaixa?: number;
  npcBoletos: Array<{ valor: number }>;
}

interface UploadFichaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataExtracted: (dados: DadosExtraidos) => void;
}

export function UploadFichaModal({ isOpen, onClose, onDataExtracted }: UploadFichaModalProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload e OCR
    setUploading(true);
    setErro(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/financeiro/ocr-ficha', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao processar imagem');
      }

      const dados: DadosExtraidos = await response.json();
      setDadosExtraidos(dados);
      toast({ message: 'Ficha processada com sucesso!', type: 'success' });
    } catch (error: any) {
      setErro(error.message);
      toast({ message: `Erro: ${error.message}`, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmarImportacao = () => {
    if (dadosExtraidos) {
      onDataExtracted(dadosExtraidos);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold">Importar Ficha de Fechamento</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <AlertCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Upload Area */}
          <div 
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                <p className="text-gray-600">Processando imagem com OCR...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10 text-gray-400" />
                <p className="text-gray-600">Clique para fazer upload da foto da ficha</p>
                <p className="text-sm text-gray-400">JPG, PNG ou PDF</p>
              </div>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div className="flex gap-6">
              <div className="w-1/2">
                <p className="text-sm font-medium text-gray-700 mb-2">Imagem Original</p>
                <img src={preview} alt="Ficha" className="rounded-lg border max-h-96 object-contain" />
              </div>
              
              {/* Dados Extraídos */}
              {dadosExtraidos && (
                <div className="w-1/2">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="font-medium text-green-700">Dados Extraídos</p>
                  </div>
                  
                  <div className="space-y-3 text-sm bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Data:</span>
                      <span className="font-medium">{dadosExtraidos.data}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Terminal:</span>
                      <span className="font-medium">{dadosExtraidos.terminal}</span>
                    </div>
                    
                    <div className="border-t pt-2">
                      <p className="text-xs text-gray-500 mb-1">Jogos</p>
                      {dadosExtraidos.jogos.map((j, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span>{j.nome}</span>
                          <span>{j.quantidade}x R$ {j.valor.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="border-t pt-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Total Jogos:</span>
                        <span className="font-bold">R$ {dadosExtraidos.totalJogos.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Contas:</span>
                        <span>R$ {dadosExtraidos.totalContas.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Prêmios Pagos:</span>
                        <span className="text-red-600">R$ {dadosExtraidos.premiosPagos.toFixed(2)}</span>
                      </div>
                      {dadosExtraidos.totalEmCaixa && (
                        <div className="flex justify-between font-bold text-green-700">
                          <span>Total em Caixa:</span>
                          <span>R$ {dadosExtraidos.totalEmCaixa.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmarImportacao}
            disabled={!dadosExtraidos || uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirmar Importação
          </button>
        </div>
      </div>
    </div>
  );
}
