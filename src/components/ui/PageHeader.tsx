'use client';

import React from 'react';

interface PageHeaderProps {
    title: string;
    description?: string;
    children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, children }) => {
    return (
        <div className="page-header mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="page-title text-3xl font-extrabold tracking-tight text-foreground">
                    {title}
                </h1>
                {description && (
                    <p className="text-sm text-muted font-medium opacity-60">
                        {description}
                    </p>
                )}
            </div>
            {children && (
                <div className="flex items-center gap-3">
                    {children}
                </div>
            )}
        </div>
    );
};
