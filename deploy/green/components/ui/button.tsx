import * as React from 'react';
import { cn } from '../../lib/utils.ts';

type ButtonVariant = 'default' | 'primary' | 'outline' | 'ghost';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantStyles: Record<ButtonVariant, string> = {
  default: 'bg-gray-800 text-white hover:bg-gray-700',
  primary: 'bg-blue-600 text-white hover:bg-blue-500',
  outline: 'border border-gray-700 text-gray-200 hover:bg-gray-800',
  ghost: 'text-gray-300 hover:bg-gray-800',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0b0e1a]',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
);

Button.displayName = 'Button';

export default Button;
