import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'; // Fixed import import casing if needed
import { Loader2, Copy, AlertTriangle, Calendar } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { TransacaoFinanceira } from '@/hooks/useFinanceiro';
import { useToast } from '@/contexts/ToastContext'; // Correct usage

interface ReplicarUltimoMesModalProps {
    isOpen: boolean;
    onClose: () => void;
    lojaId: string | null;
    anoAtual: number;
    mesAtual: number; // 1-12
    onSuccess: () => void;
}

export function ReplicarUltimoMesModal({
    isOpen,
    onClose,
    lojaId,
    anoAtual,
    mesAtual,
    onSuccess
}: ReplicarUltimoMesModalProps) {
    const supabase = createBrowserSupabaseClient();
    const { toast } = useToast(); // Hook usage
    const [loading, setLoading] = useState(false);
    const [copying, setCopying] = useState(false);
    const [candidatas, setCandidatas] = useState<TransacaoFinanceira[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [mesOrigem, setMesOrigem] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchDespesasMesAnterior();
        }
    }, [isOpen, lojaId, anoAtual, mesAtual]);

    const fetchDespesasMesAnterior = async () => {
        setLoading(true);
        try {
            // Calcular mês anterior
            let anoQuery = anoAtual;
            let mesQuery = mesAtual - 1;

            if (mesQuery === 0) {
                mesQuery = 12;
                anoQuery = anoAtual - 1;
            }

            setMesOrigem(`${mesQuery.toString().padStart(2, '0')}/${anoQuery}`);

            const startDate = new Date(anoQuery, mesQuery - 1, 1).toISOString().split('T')[0];
            const endDate = new Date(anoQuery, mesQuery, 0).toISOString().split('T')[0];

            let query = supabase
                .from('financeiro_contas')
                .select('*')
                .eq('tipo', 'despesa') // Apenas despesas por padrão
                .gte('data_vencimento', startDate)
                .lte('data_vencimento', endDate); // .eq('status', 'pago')? Talvez copiar tudo, user decide.

            if (lojaId) {
                query = query.eq('loja_id', lojaId);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data) {
                // Filtrar apenas o que faz sentido replicar (opcional: tirar variaveis nulas?)
                // Por padrão, selecionamos as que tem flag recorrente ou modalidade fixa (se existisse facil no objeto)
                // Mas no modo Excel, selecionamos tudo e o user tira.
                setCandidatas(data as TransacaoFinanceira[]);

                // Pré-selecionar todas
                const ids = new Set((data as TransacaoFinanceira[]).map(d => d.id));
                setSelectedIds(ids);
            }

        } catch (error) {
            console.error('Erro ao buscar despesas anteriores:', error);
            toast({
                message: 'Erro ao buscar dados: Não foi possível carregar as despesas do mês anterior.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleConfirm = async () => {
        if (selectedIds.size === 0) return;
        setCopying(true);

        try {
            // Filtrar as originais
            const toCopy = candidatas.filter(c => selectedIds.has(c.id));
            const { data: { user } } = await supabase.auth.getUser();

            // Preparar o payload
            // Ajustar datas para o mês atual (mesmo dia, mas mês/ano novos)
            const newTransactions = toCopy.map(orig => {
                const dia = parseInt(orig.data_vencimento.split('-')[2]);
                // Criar data no mês atual
                // Cuidado com dias que não existem (ex: 31 em Fev), o JS ajusta sozinho (vira mar 03 etc),
                // Mas vamos manter simples: setDate lida com overflow
                const targetDate = new Date(anoAtual, mesAtual - 1, dia);

                return {
                    tipo: orig.tipo,
                    descricao: orig.descricao,
                    valor: orig.valor,
                    item: orig.item, // Texto Livre ou Categoria
                    data_vencimento: targetDate.toISOString().split('T')[0],
                    status: 'pendente', // Sempre nasce pendente
                    recorrente: orig.recorrente,
                    frequencia: orig.frequencia,
                    loja_id: orig.loja_id,
                    item_financeiro_id: orig.item_financeiro_id, // Mantém vínculo se tiver
                    usuario_id: user?.id,
                    observacoes: `Copiado de ${mesOrigem}`
                };
            });

            // Batch Insert
            const { error } = await supabase
                .from('financeiro_contas')
                .insert(newTransactions);

            if (error) throw error;

            toast({
                message: `Sucesso! ${newTransactions.length} lançamentos replicados para este mês.`,
                type: 'success'
            });

            onSuccess();
            onClose();

        } catch (error: any) {
            console.error('Erro na replicação:', error);
            toast({
                message: `Erro ao replicar: ${error.message || 'Falha ao processar.'}`,
                type: 'error'
            });
        } finally {
            setCopying(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Copy className="w-5 h-5 text-blue-500" />
                        Replicar do Mês Anterior ({mesOrigem})
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : candidatas.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground flex flex-col items-center gap-2">
                            <AlertTriangle className="w-10 h-10 opacity-20" />
                            <p>Nenhuma despesa encontrada no mês anterior ({mesOrigem}).</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-blue-500/10 p-3 rounded-lg text-xs text-blue-200 flex items-start gap-2 border border-blue-500/20">
                                <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
                                <p>
                                    Selecione os itens que deseja copiar para <strong>{mesAtual}/{anoAtual}</strong>.
                                    Os valores e descrições serão mantidos, e a data de vencimento será ajustada para o mesmo dia neste mês.
                                </p>
                            </div>

                            <div className="flex justify-between items-center text-sm font-medium px-1">
                                <span>{selectedIds.size} itens selecionados</span>
                                <button
                                    className="btn btn-ghost btn-xs"
                                    onClick={() => setSelectedIds(selectedIds.size === candidatas.length ? new Set() : new Set(candidatas.map(c => c.id)))}
                                >
                                    {selectedIds.size === candidatas.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                                </button>
                            </div>

                            <div className="flex-1 border rounded-md p-2 bg-black/20 overflow-y-auto max-h-[400px]">
                                <div className="space-y-1">
                                    {candidatas.map(item => {
                                        const isSelected = selectedIds.has(item.id);
                                        return (
                                            <div
                                                key={item.id}
                                                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors border ${isSelected
                                                    ? 'bg-blue-500/20 border-blue-500/30'
                                                    : 'hover:bg-white/5 border-transparent'
                                                    }`}
                                                onClick={() => handleToggle(item.id)}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-sm checkbox-primary"
                                                    checked={isSelected}
                                                    onChange={() => handleToggle(item.id)}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm truncate">{item.descricao}</p>
                                                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                                                        <span className="opacity-75">{item.item}</span>
                                                        <span>•</span>
                                                        <span>Dia {item.data_vencimento.split('-')[2]}</span>
                                                    </div>
                                                </div>
                                                <div className="font-mono font-bold text-sm">
                                                    R$ {item.valor.toFixed(2)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <button className="btn btn-ghost" onClick={onClose} disabled={copying}>
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={copying || selectedIds.size === 0}
                        className="btn btn-primary"
                    >
                        {copying ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Replicando...
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4 mr-2" />
                                Replicar {selectedIds.size} Itens
                            </>
                        )}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
