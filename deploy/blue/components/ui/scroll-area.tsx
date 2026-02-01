import * as React from 'react';
import { cn } from '../../lib/utils.ts';

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string;
}

const ScrollArea: React.FC<ScrollAreaProps> = ({ className, viewportClassName, children, ...props }) => {
  return (
    <div className={cn('relative overflow-hidden', className)} {...props}>
      <div className={cn('max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700', viewportClassName)}>
        {children}
      </div>
    </div>
  );
};

export default ScrollArea;
