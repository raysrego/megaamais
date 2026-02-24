import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const DashboardSkeleton = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="card-premium">
                        <div className="flex justify-between items-start mb-4">
                            <Skeleton width={120} height={10} />
                            <Skeleton width={32} height={32} />
                        </div>
                        <Skeleton width={150} height={32} className="mb-2" />
                        <Skeleton width={80} height={14} />
                    </div>
                ))}
            </div>

            {/* Main Action Area */}
            <div className="flex justify-between items-center bg-white/2 p-6 rounded-2xl border border-white/5">
                <div className="flex items-center gap-4">
                    <Skeleton width={48} height={48} circle />
                    <div>
                        <Skeleton width={200} height={18} className="mb-2" />
                        <Skeleton width={300} height={12} />
                    </div>
                </div>
                <Skeleton width={160} height={45} />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="card-premium">
                        <div className="flex justify-between items-center mb-6">
                            <Skeleton width={180} height={20} />
                            <Skeleton width={100} height={32} />
                        </div>
                        <Skeleton width="100%" height={300} />
                    </div>
                ))}
            </div>
        </div>
    );
};
