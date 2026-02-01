import React from 'react';
import { cn } from '../../lib/utils';
import Skeleton from './skeleton';

/**
 * SkeletonLoader Component
 * 
 * A standardized skeleton loading component for content placeholders.
 * Use when you want to show the shape/structure of content being loaded.
 * 
 * @component
 * @example
 * // Basic card skeleton
 * <SkeletonLoader variant="card" />
 * 
 * @example
 * // Agent panel skeleton
 * <SkeletonLoader variant="agent-panel" />
 * 
 * @example
 * // Custom skeleton composition
 * <SkeletonLoader variant="custom">
 *   <Skeleton className="h-12 w-12 rounded-full" />
 *   <div className="space-y-2">
 *     <Skeleton className="h-4 w-[250px]" />
 *     <Skeleton className="h-4 w-[200px]" />
 *   </div>
 * </SkeletonLoader>
 */

export interface SkeletonLoaderProps {
  /** Predefined skeleton layout variant */
  variant?: 'card' | 'list' | 'table' | 'agent-panel' | 'chart' | 'metric' | 'custom';
  /** Number of items to render (for list/table variants) */
  count?: number;
  /** Additional CSS classes */
  className?: string;
  /** Custom children for 'custom' variant */
  children?: React.ReactNode;
}

/**
 * Card Skeleton - for dashboard cards, panels, etc.
 */
const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-4 p-6 rounded-lg border border-gray-800', className)}>
    <Skeleton className="h-6 w-[200px]" />
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[90%]" />
      <Skeleton className="h-4 w-[80%]" />
    </div>
    <div className="flex gap-2 mt-4">
      <Skeleton className="h-10 w-[100px]" />
      <Skeleton className="h-10 w-[100px]" />
    </div>
  </div>
);

/**
 * List Skeleton - for agent lists, settings lists, etc.
 */
const ListItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-800">
    <Skeleton className="h-12 w-12 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-[200px]" />
      <Skeleton className="h-3 w-[150px]" />
    </div>
    <Skeleton className="h-8 w-[80px]" />
  </div>
);

/**
 * Table Skeleton - for data tables
 */
const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-2">
    <div className="flex gap-4 p-3 border-b border-gray-800">
      <Skeleton className="h-4 w-[150px]" />
      <Skeleton className="h-4 w-[150px]" />
      <Skeleton className="h-4 w-[150px]" />
      <Skeleton className="h-4 w-[100px]" />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 p-3">
        <Skeleton className="h-4 w-[150px]" />
        <Skeleton className="h-4 w-[150px]" />
        <Skeleton className="h-4 w-[150px]" />
        <Skeleton className="h-4 w-[100px]" />
      </div>
    ))}
  </div>
);

/**
 * Agent Panel Skeleton - specialized for AI agent control panels
 */
const AgentPanelSkeleton: React.FC = () => (
  <div className="space-y-6 p-6">
    {/* Header */}
    <div className="flex items-center justify-between pb-4 border-b border-gray-800">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
        </div>
      </div>
      <Skeleton className="h-10 w-[100px]" />
    </div>

    {/* Tabs */}
    <div className="flex gap-4 border-b border-gray-800">
      <Skeleton className="h-10 w-[100px]" />
      <Skeleton className="h-10 w-[100px]" />
      <Skeleton className="h-10 w-[100px]" />
      <Skeleton className="h-10 w-[100px]" />
    </div>

    {/* Content */}
    <div className="grid grid-cols-2 gap-4">
      <CardSkeleton />
      <CardSkeleton />
    </div>

    {/* Metrics */}
    <div className="grid grid-cols-4 gap-4">
      <MetricSkeleton />
      <MetricSkeleton />
      <MetricSkeleton />
      <MetricSkeleton />
    </div>

    {/* Chart */}
    <Skeleton className="h-[300px] w-full rounded-lg" />
  </div>
);

/**
 * Chart Skeleton - for chart placeholders
 */
const ChartSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-2', className)}>
    <Skeleton className="h-6 w-[150px]" />
    <Skeleton className="h-[250px] w-full rounded-lg" />
    <div className="flex gap-4 justify-center">
      <Skeleton className="h-4 w-[80px]" />
      <Skeleton className="h-4 w-[80px]" />
      <Skeleton className="h-4 w-[80px]" />
    </div>
  </div>
);

/**
 * Metric Skeleton - for KPI/metric cards
 */
const MetricSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-2 p-4 rounded-lg border border-gray-800', className)}>
    <Skeleton className="h-4 w-[100px]" />
    <Skeleton className="h-8 w-[80px]" />
    <Skeleton className="h-3 w-[60px]" />
  </div>
);

/**
 * Main SkeletonLoader Component
 */
const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'card',
  count = 3,
  className,
  children,
}) => {
  if (variant === 'custom' && children) {
    return <div className={className}>{children}</div>;
  }

  const renderSkeleton = () => {
    switch (variant) {
      case 'card':
        return <CardSkeleton className={className} />;
      
      case 'list':
        return (
          <div className={cn('space-y-3', className)}>
            {Array.from({ length: count }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        );
      
      case 'table':
        return <TableSkeleton rows={count} />;
      
      case 'agent-panel':
        return <AgentPanelSkeleton />;
      
      case 'chart':
        return <ChartSkeleton className={className} />;
      
      case 'metric':
        return <MetricSkeleton className={className} />;
      
      default:
        return <CardSkeleton className={className} />;
    }
  };

  return <div className={className}>{renderSkeleton()}</div>;
};

/**
 * AgentListSkeleton - Specialized skeleton for agent list views
 */
export const AgentListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <SkeletonLoader variant="list" count={count} />
);

/**
 * AgentPanelSkeleton - Specialized skeleton for agent control panels
 */
export const AgentPanelSkeletonLoader: React.FC = () => (
  <SkeletonLoader variant="agent-panel" />
);

/**
 * MetricCardSkeleton - Specialized skeleton for metric cards
 */
export const MetricCardSkeleton: React.FC<{ count?: number; className?: string }> = ({ 
  count = 4, 
  className 
}) => (
  <div className={cn('grid grid-cols-4 gap-4', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <MetricSkeleton key={i} />
    ))}
  </div>
);

export default SkeletonLoader;
