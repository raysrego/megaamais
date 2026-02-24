import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const FormSkeleton = () => {
    return (
        <div className="form-skeleton space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto p-4">
            <div className="grid grid-cols-2 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton width={100} height={10} />
                        <Skeleton width="100%" height={40} />
                    </div>
                ))}
            </div>
            <div className="space-y-2">
                <Skeleton width={120} height={10} />
                <Skeleton width="100%" height={100} />
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
                <Skeleton width={100} height={40} />
                <Skeleton width={150} height={40} />
            </div>
        </div>
    );
};
