"use client";

import React, { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { Check, Trash2, Info, AlertTriangle } from "lucide-react";

export default function FeedbackPage() {
    const { toast } = useToast();
    const confirm = useConfirm();
    const [lastResult, setLastResult] = useState<string>("Nenhuma ação realizada ainda.");

    // Toast Examples
    const showSuccess = () => {
        toast({
            message: "Operação realizada com sucesso! Seus dados foram salvos.",
            type: "success",
        });
    };

    const showError = () => {
        toast({
            message: "Erro ao conectar com o servidor. Tente novamente.",
            type: "error",
        });
    };

    const showWarning = () => {
        toast({
            message: "Sua sessão irá expirar em 5 minutos.",
            type: "warning",
        });
    };

    const showInfo = () => {
        toast({
            message: "Uma nova atualização está disponível para o sistema.",
            type: "info",
        });
    };

    // Confirm Modal Examples
    const handleDelete = async () => {
        const isConfirmed = await confirm({
            title: "Excluir Item?",
            description: "Esta ação não pode ser desfeita. Todos os dados associados serão removidos permanentemente.",
            confirmLabel: "Sim, Excluir",
            cancelLabel: "Cancelar",
            variant: "danger",
        });

        if (isConfirmed) {
            toast({ message: "Item excluído com sucesso!", type: "success" });
            setLastResult("Usuário CONFIRMOU a exclusão.");
        } else {
            toast({ message: "Operação cancelada.", type: "info" });
            setLastResult("Usuário CANCELOU a operação.");
        }
    };

    const handleAction = async () => {
        const isConfirmed = await confirm({
            title: "Finalizar Caixa?",
            description: "Deseja realmente fechar o caixa do dia? Certifique-se de ter conferido todos os valores.",
            confirmLabel: "Finalizar",
            variant: "info",
        });

        if (isConfirmed) {
            toast({ message: "Caixa finalizado!", type: "success" });
            setLastResult("Caixa finalizado pelo usuário.");
        } else {
            setLastResult("Finalização de caixa abortada.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Design System: Feedback</h1>
                    <p className="text-slate-600">Demonstração dos componentes globais de notificação e confirmação.</p>
                </header>

                <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-8">
                    <h2 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
                        <Info className="w-5 h-5 text-blue-500" />
                        Toasts (Notificações)
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <button
                            onClick={showSuccess}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 font-medium rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                        >
                            <Check className="w-4 h-4" />
                            Success
                        </button>

                        <button
                            onClick={showError}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-700 font-medium rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            Error
                        </button>

                        <button
                            onClick={showWarning}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 text-amber-700 font-medium rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            Warning
                        </button>

                        <button
                            onClick={showInfo}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 font-medium rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                            <Info className="w-4 h-4" />
                            Info
                        </button>
                    </div>
                </section>

                <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                    <h2 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Confirmation Modals
                    </h2>

                    <div className="flex flex-col md:flex-row gap-6 mb-8">
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-medium rounded-lg shadow-lg shadow-red-200 hover:bg-red-700 transition-all hover:-translate-y-0.5"
                        >
                            <Trash2 className="w-4 h-4" />
                            Simular Exclusão (Danger)
                        </button>

                        <button
                            onClick={handleAction}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all hover:-translate-y-0.5"
                        >
                            <Info className="w-4 h-4" />
                            Ação Genérica (Info)
                        </button>
                    </div>

                    <div className="p-4 bg-slate-100 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-500 font-mono">
                            Resultado da última promessa: <strong className="text-slate-800">{lastResult}</strong>
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
