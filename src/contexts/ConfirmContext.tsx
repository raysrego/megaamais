"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ConfirmModal, ConfirmOptions } from "@/components/ui/ConfirmModal";

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({
        title: "",
        description: "",
    });

    // We store the resolver function for the pending promise
    const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        setOptions(options);
        setIsOpen(true);

        return new Promise((resolve) => {
            setResolver(() => resolve);
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setIsOpen(false);
        if (resolver) {
            resolver(true);
            setResolver(null);
        }
    }, [resolver]);

    const handleCancel = useCallback(() => {
        setIsOpen(false);
        if (resolver) {
            resolver(false);
            setResolver(null);
        }
    }, [resolver]);

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <ConfirmModal
                isOpen={isOpen}
                options={options}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (context === undefined) {
        throw new Error("useConfirm must be used within a ConfirmProvider");
    }
    return context.confirm;
}
