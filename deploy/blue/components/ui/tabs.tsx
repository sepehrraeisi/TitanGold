import * as React from 'react';
import { cn } from '../../lib/utils.ts';

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, className, children }) => {
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange }}>
      <div className={cn('flex flex-col', className)}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div
    className={cn('inline-flex items-center justify-start rounded-lg border border-gray-800 bg-[#0f1322] p-1 text-gray-400', className)}
    {...props}
  >
    {children}
  </div>
);

export const TabsTrigger: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }> = ({
  className,
  value,
  children,
  ...props
}) => {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('TabsTrigger must be used within Tabs');
  }
  const isActive = context.value === value;

  return (
    <button
      type="button"
      onClick={() => context.setValue(value)}
      className={cn(
        'relative inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none',
        isActive
          ? 'bg-blue-600 text-white shadow'
          : 'text-gray-400 hover:text-white hover:bg-gray-800',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<React.HTMLAttributes<HTMLDivElement> & { value: string }> = ({
  className,
  value,
  children,
  ...props
}) => {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('TabsContent must be used within Tabs');
  }
  if (context.value !== value) {
    return null;
  }
  return (
    <div className={cn('mt-4', className)} {...props}>
      {children}
    </div>
  );
};
