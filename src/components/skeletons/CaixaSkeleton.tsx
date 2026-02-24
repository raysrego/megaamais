import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const CaixaSkeleton = () => {
    return (
        <div className="caixa-skeleton space-y-8 animate-in fade-in duration-500">
            {/* Abas e Status */}
            <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
                <div className="flex gap-2">
                    <Skeleton width={180} height={42} />
                    <Skeleton width={150} height={42} />
                </div>
                <Skeleton width={120} height={24} className="rounded-full" />
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="card p-6 border-t-4 border-white/5">
                        <div className="flex justify-between mb-4">
                            <Skeleton width={100} height={12} />
                            <Skeleton width={40} height={40} />
                        </div>
                        <Skeleton width="60%" height={32} className="mb-4" />
                        <Skeleton width="40%" height={12} />
                    </div>
                ))}
            </div>

            {/* Gráficos e Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                {/* Gráfico */}
                <div className="card p-6 min-h-[400px]">
                    <div className="flex justify-between mb-8">
                        <Skeleton width={150} height={20} />
                        <Skeleton width={80} height={12} />
                    </div>
                    <Skeleton width="100%" height={280} />
                </div>

                {/* Feed */}
                <div className="card p-6 min-h-[400px]">
                    <div className="flex justify-between mb-8">
                        <Skeleton width={120} height={20} />
                        <Skeleton width={100} height={12} />
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white/3">
                                <Skeleton width={40} height={40} circle />
                                <div className="flex-1">
                                    <div className="flex justify-between mb-2">
                                        <Skeleton width="40%" height={12} />
                                        <Skeleton width="20%" height={12} />
                                    </div>
                                    <Skeleton width="30%" height={8} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
