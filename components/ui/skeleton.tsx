import * as React from 'react';
import { cn } from '../../lib/utils.ts';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return <div className={cn('animate-pulse rounded-md bg-gray-800/80', className)} {...props} />;
};

export default Skeleton;
