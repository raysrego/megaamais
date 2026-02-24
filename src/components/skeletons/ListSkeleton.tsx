import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const ListSkeleton = () => {
    return (
        <div className="list-skeleton space-y-4 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <Skeleton width={300} height={40} />
                <Skeleton width={120} height={40} />
            </div>

            <div className="card-premium">
                <div className="flex gap-4 mb-6">
                    <Skeleton width="100%" height={45} className="flex-1" />
                    <Skeleton width={100} height={45} />
                </div>

                <div className="space-y-1">
                    {/* Header Row */}
                    <div className="flex gap-4 py-3 border-b border-white/5">
                        <Skeleton width={40} height={12} />
                        <Skeleton width="30%" height={12} />
                        <Skeleton width="20%" height={12} />
                        <Skeleton width="15%" height={12} />
                        <Skeleton width="15%" height={12} />
                        <div className="flex-1" />
                    </div>

                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 py-4 border-b border-white/5 last:border-0">
                            <Skeleton width={32} height={32} circle />
                            <div className="flex-1">
                                <Skeleton width="60%" height={16} className="mb-2" />
                                <Skeleton width="40%" height={10} />
                            </div>
                            <Skeleton width={100} height={20} />
                            <Skeleton width={80} height={10} />
                            <div className="flex gap-2">
                                <Skeleton width={32} height={32} />
                                <Skeleton width={32} height={32} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
