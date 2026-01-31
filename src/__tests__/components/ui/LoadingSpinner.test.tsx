/**
 * LoadingSpinner Component Tests (FRONTEND-005)
 * 
 * Tests for standardized loading spinner components
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner, { 
  AgentLoadingSpinner, 
  InlineLoadingSpinner 
} from '../../../../components/ui/LoadingSpinner';

describe('LoadingSpinner Component (FRONTEND-005)', () => {
  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      const { container } = render(<LoadingSpinner />);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toBeTruthy();
    });

    it('should render with custom size', () => {
      const { container } = render(<LoadingSpinner size="lg" />);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toBeTruthy();
      expect(spinner?.className).toContain('w-12');
      expect(spinner?.className).toContain('h-12');
    });

    it('should render small size', () => {
      const { container } = render(<LoadingSpinner size="sm" />);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner?.className).toContain('w-4');
      expect(spinner?.className).toContain('h-4');
    });

    it('should render extra large size', () => {
      const { container } = render(<LoadingSpinner size="xl" />);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner?.className).toContain('w-16');
      expect(spinner?.className).toContain('h-16');
    });
  });

  describe('Message Display', () => {
    it('should display loading message', () => {
      render(<LoadingSpinner message="Loading data..." />);
      expect(screen.getByText('Loading data...')).toBeTruthy();
    });

    it('should not display message when not provided', () => {
      const { container } = render(<LoadingSpinner />);
      expect(container.querySelector('p')).toBeNull();
    });

    it('should animate message with pulse', () => {
      render(<LoadingSpinner message="Please wait" />);
      const message = screen.getByText('Please wait');
      expect(message.className).toContain('animate-pulse');
    });
  });

  describe('Centering', () => {
    it('should render centered when centered prop is true', () => {
      const { container } = render(<LoadingSpinner centered />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('flex');
      expect(wrapper.className).toContain('items-center');
      expect(wrapper.className).toContain('justify-center');
    });

    it('should render inline when centered prop is false', () => {
      const { container } = render(<LoadingSpinner centered={false} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('inline-flex');
    });
  });

  describe('Color Variants', () => {
    it('should render primary variant (blue)', () => {
      const { container } = render(<LoadingSpinner variant="primary" />);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner?.className).toContain('border-blue-500');
    });

    it('should render secondary variant (gray)', () => {
      const { container } = render(<LoadingSpinner variant="secondary" />);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner?.className).toContain('border-gray-400');
    });

    it('should render accent variant (yellow)', () => {
      const { container } = render(<LoadingSpinner variant="accent" />);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner?.className).toContain('border-yellow-500');
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(<LoadingSpinner className="custom-class" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('custom-class');
    });

    it('should combine custom className with default styles', () => {
      const { container } = render(<LoadingSpinner className="my-spinner" size="lg" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('my-spinner');
      expect(wrapper.className).toContain('inline-flex');
    });
  });

  describe('Accessibility', () => {
    it('should have role="status" for screen readers', () => {
      const { container } = render(<LoadingSpinner />);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toBeTruthy();
    });

    it('should have aria-label', () => {
      const { container } = render(<LoadingSpinner />);
      const spinner = container.querySelector('[aria-label="Loading"]');
      expect(spinner).toBeTruthy();
    });
  });

  describe('Animation', () => {
    it('should have spin animation class', () => {
      const { container } = render(<LoadingSpinner />);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner?.className).toContain('animate-spin');
    });

    it('should have rounded-full class for circular shape', () => {
      const { container } = render(<LoadingSpinner />);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner?.className).toContain('rounded-full');
    });
  });
});

describe('AgentLoadingSpinner Component (FRONTEND-005)', () => {
  it('should render with agent name', () => {
    render(<AgentLoadingSpinner agentName="Technical Analysis" />);
    expect(screen.getByText('Loading Technical Analysis Agent...')).toBeTruthy();
  });

  it('should render with default message when no agent name provided', () => {
    render(<AgentLoadingSpinner />);
    expect(screen.getByText('Loading agent...')).toBeTruthy();
  });

  it('should render centered by default', () => {
    const { container } = render(<AgentLoadingSpinner />);
    const wrapper = container.querySelector('.flex.items-center.justify-center');
    expect(wrapper).toBeTruthy();
  });

  it('should render inline when centered is false', () => {
    const { container } = render(<AgentLoadingSpinner centered={false} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('inline-flex');
  });

  it('should use large size', () => {
    const { container } = render(<AgentLoadingSpinner />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner?.className).toContain('w-12');
    expect(spinner?.className).toContain('h-12');
  });

  it('should use primary variant', () => {
    const { container } = render(<AgentLoadingSpinner />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner?.className).toContain('border-blue-500');
  });
});

describe('InlineLoadingSpinner Component (FRONTEND-005)', () => {
  it('should render as inline-block', () => {
    const { container } = render(<InlineLoadingSpinner />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('inline-block');
  });

  it('should use small size', () => {
    const { container } = render(<InlineLoadingSpinner />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner?.className).toContain('w-4');
    expect(spinner?.className).toContain('h-4');
  });

  it('should use secondary variant', () => {
    const { container } = render(<InlineLoadingSpinner />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner?.className).toContain('border-gray-400');
  });

  it('should apply custom className', () => {
    const { container } = render(<InlineLoadingSpinner className="ml-2" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('ml-2');
  });

  it('should be suitable for button usage', () => {
    const { container } = render(
      <button>
        <InlineLoadingSpinner /> Saving...
      </button>
    );
    
    const button = container.querySelector('button');
    const spinner = button?.querySelector('[role="status"]');
    expect(spinner).toBeTruthy();
    expect(spinner?.className).toContain('w-4'); // Small size for inline use
  });
});

describe('LoadingSpinner Integration Tests (FRONTEND-005)', () => {
  it('should work within Suspense fallback', () => {
    const { container } = render(
      <div className="fixed inset-0">
        <AgentLoadingSpinner agentName="Price Prediction" />
      </div>
    );
    
    expect(screen.getByText('Loading Price Prediction Agent...')).toBeTruthy();
  });

  it('should work in button disabled state', () => {
    const { container } = render(
      <button disabled>
        <InlineLoadingSpinner /> Processing...
      </button>
    );
    
    const button = container.querySelector('button');
    expect(button?.disabled).toBe(true);
    expect(button?.querySelector('[role="status"]')).toBeTruthy();
  });

  it('should work in conditional rendering', () => {
    const isLoading = true;
    const { rerender } = render(
      <div>
        {isLoading ? <LoadingSpinner message="Loading..." /> : <div>Content</div>}
      </div>
    );
    
    expect(screen.getByText('Loading...')).toBeTruthy();
    
    rerender(
      <div>
        {false ? <LoadingSpinner message="Loading..." /> : <div>Content</div>}
      </div>
    );
    
    expect(screen.getByText('Content')).toBeTruthy();
  });
});

describe('LoadingSpinner Edge Cases (FRONTEND-005)', () => {
  it('should handle empty string message', () => {
    const { container } = render(<LoadingSpinner message="" />);
    const message = container.querySelector('p');
    expect(message).toBeNull(); // Empty string should not render message element
  });

  it('should handle very long message', () => {
    const longMessage = 'Loading a very long operation that might take some time to complete...';
    render(<LoadingSpinner message={longMessage} />);
    expect(screen.getByText(longMessage)).toBeTruthy();
  });

  it('should handle special characters in agent name', () => {
    render(<AgentLoadingSpinner agentName="Risk & Compliance" />);
    expect(screen.getByText('Loading Risk & Compliance Agent...')).toBeTruthy();
  });

  it('should maintain aspect ratio at all sizes', () => {
    const sizes = ['sm', 'md', 'lg', 'xl'] as const;
    
    sizes.forEach(size => {
      const { container } = render(<LoadingSpinner size={size} />);
      const spinner = container.querySelector('[role="status"]');
      
      // Width and height should use same class pattern
      const hasW = spinner?.className.match(/w-(\d+)/)?.[1];
      const hasH = spinner?.className.match(/h-(\d+)/)?.[1];
      expect(hasW).toBe(hasH); // Same dimension for width and height
    });
  });
});
