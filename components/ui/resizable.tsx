import * as React from 'react';
import { cn } from '../../lib/utils.ts';

interface ResizableContextValue {
  sizes: number[];
  setSizes: React.Dispatch<React.SetStateAction<number[]>>;
}

const ResizableContext = React.createContext<ResizableContextValue | null>(null);

interface ResizablePanelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultLayout?: [number, number];
}

export const ResizablePanelGroup: React.FC<ResizablePanelGroupProps> = ({
  defaultLayout = [22, 78],
  className,
  children,
  ...props
}) => {
  const [sizes, setSizes] = React.useState<number[]>(defaultLayout);

  return (
    <ResizableContext.Provider value={{ sizes, setSizes }}>
      <div className={cn('flex h-full w-full', className)} {...props}>
        {children}
      </div>
    </ResizableContext.Provider>
  );
};

interface ResizablePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  index: 0 | 1;
  minSize?: number;
  maxSize?: number;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  index,
  minSize = 12,
  maxSize = 88,
  className,
  style,
  ...props
}) => {
  const context = React.useContext(ResizableContext);
  if (!context) {
    throw new Error('ResizablePanel must be used inside ResizablePanelGroup');
  }

  const { sizes } = context;
  const size = sizes[index];
  const constrained = Math.min(Math.max(size, minSize), maxSize);

  return (
    <div
      className={cn('flex-shrink-0', className)}
      style={{ ...style, width: `${constrained}%` }}
      {...props}
    />
  );
};

interface ResizableHandleProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ResizableHandle: React.FC<ResizableHandleProps> = ({ className, ...props }) => {
  const context = React.useContext(ResizableContext);
  const handleRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!context) return;
    const { setSizes } = context;

    const handle = handleRef.current;
    if (!handle) return;

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const container = handle.parentElement as HTMLDivElement | null;
      const containerWidth = container?.getBoundingClientRect().width ?? 1;

      const onPointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const delta = moveEvent.clientX - startX;
        setSizes(prev => {
          const first = Math.min(Math.max(prev[0] + (delta / containerWidth) * 100, 10), 40);
          const second = 100 - first;
          return [first, second];
        });
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    handle.addEventListener('pointerdown', onPointerDown);
    return () => {
      handle.removeEventListener('pointerdown', onPointerDown);
    };
  }, [context]);

  return (
    <div
      ref={handleRef}
      role="separator"
      tabIndex={0}
      className={cn('flex w-1 cursor-col-resize items-center justify-center bg-transparent px-0.5', className)}
      {...props}
    >
      <div className="h-12 w-0.5 rounded-full bg-gray-800" />
    </div>
  );
};
