import React from 'react';

interface SkeletonLoaderProps {
    width?: string | number;
    height?: string | number;
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    width = '100%',
    height = '1rem',
    className = '',
    variant = 'rectangular',
}) => {
    const borderRadius =
        variant === 'circular' ? '50%' :
            variant === 'text' ? '0.25rem' : '0.5rem';

    return (
        <div
            className={`animate-pulse bg-secondary/30 relative overflow-hidden ${className}`}
            style={{
                width,
                height,
                borderRadius,
            }}
        >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-secondary/20 to-transparent -translate-x-full animate-shimmer" />
        </div>
    );
};

export default SkeletonLoader;
