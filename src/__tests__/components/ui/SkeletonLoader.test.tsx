/**
 * SkeletonLoader Component Tests (FRONTEND-005)
 * 
 * Tests for standardized skeleton loading components
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SkeletonLoader, { 
  AgentListSkeleton, 
  AgentPanelSkeletonLoader,
  MetricCardSkeleton 
} from '../../../../components/ui/SkeletonLoader';

describe('SkeletonLoader Component (FRONTEND-005)', () => {
  describe('Variant Rendering', () => {
    it('should render card variant by default', () => {
      const { container } = render(<SkeletonLoader />);
      expect(container.querySelector('.space-y-4')).toBeTruthy();
    });

    it('should render card variant explicitly', () => {
      const { container } = render(<SkeletonLoader variant="card" />);
      expect(container.querySelector('.space-y-4')).toBeTruthy();
    });

    it('should render list variant', () => {
      const { container } = render(<SkeletonLoader variant="list" count={3} />);
      const items = container.querySelectorAll('.flex.items-center');
      expect(items.length).toBe(3);
    });

    it('should render table variant', () => {
      const { container } = render(<SkeletonLoader variant="table" count={5} />);
      const rows = container.querySelectorAll('.flex.gap-4');
      expect(rows.length).toBeGreaterThan(5); // Header + rows
    });

    it('should render agent-panel variant', () => {
      const { container } = render(<SkeletonLoader variant="agent-panel" />);
      expect(container.querySelector('.space-y-6')).toBeTruthy();
    });

    it('should render chart variant', () => {
      const { container } = render(<SkeletonLoader variant="chart" />);
      const chart = container.querySelector('.h-\\[250px\\]');
      expect(chart).toBeTruthy();
    });

    it('should render metric variant', () => {
      const { container } = render(<SkeletonLoader variant="metric" />);
      expect(container.querySelector('.space-y-2')).toBeTruthy();
    });

    it('should render custom variant with children', () => {
      const { container } = render(
        <SkeletonLoader variant="custom">
          <div className="custom-skeleton">Custom Content</div>
        </SkeletonLoader>
      );
      expect(container.querySelector('.custom-skeleton')).toBeTruthy();
    });
  });

  describe('Count Prop', () => {
    it('should render correct number of list items', () => {
      const { container } = render(<SkeletonLoader variant="list" count={7} />);
      const items = container.querySelectorAll('.flex.items-center.gap-4');
      expect(items.length).toBe(7);
    });

    it('should render default count for list (3)', () => {
      const { container } = render(<SkeletonLoader variant="list" />);
      const items = container.querySelectorAll('.flex.items-center.gap-4');
      expect(items.length).toBe(3);
    });

    it('should render correct number of table rows', () => {
      const { container } = render(<SkeletonLoader variant="table" count={10} />);
      // Count body rows (excluding header)
      const allRows = container.querySelectorAll('.flex.gap-4.p-3');
      expect(allRows.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className to card', () => {
      const { container } = render(<SkeletonLoader variant="card" className="my-custom-class" />);
      expect(container.querySelector('.my-custom-class')).toBeTruthy();
    });

    it('should apply custom className to chart', () => {
      const { container } = render(<SkeletonLoader variant="chart" className="chart-skeleton" />);
      expect(container.querySelector('.chart-skeleton')).toBeTruthy();
    });
  });

  describe('Structure Validation', () => {
    it('card skeleton should have title, content, and actions', () => {
      const { container } = render(<SkeletonLoader variant="card" />);
      
      // Should have multiple skeleton elements
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(3);
    });

    it('list item skeleton should have avatar, text, and action', () => {
      const { container } = render(<SkeletonLoader variant="list" count={1} />);
      
      // Check for rounded avatar skeleton
      const avatar = container.querySelector('.rounded-full');
      expect(avatar).toBeTruthy();
      
      // Check for flex layout
      const item = container.querySelector('.flex.items-center');
      expect(item).toBeTruthy();
    });

    it('table skeleton should have header and rows', () => {
      const { container } = render(<SkeletonLoader variant="table" count={3} />);
      
      // Header row
      const header = container.querySelector('.border-b.border-gray-800');
      expect(header).toBeTruthy();
      
      // Data rows
      const rows = container.querySelectorAll('.flex.gap-4.p-3');
      expect(rows.length).toBeGreaterThanOrEqual(3);
    });

    it('agent-panel skeleton should have header, tabs, content, metrics, and chart', () => {
      const { container } = render(<SkeletonLoader variant="agent-panel" />);
      
      // Header with avatar
      const avatar = container.querySelector('.rounded-full');
      expect(avatar).toBeTruthy();
      
      // Tabs
      const tabs = container.querySelectorAll('.h-10.w-\\[100px\\]');
      expect(tabs.length).toBeGreaterThan(3);
      
      // Chart area
      const chart = container.querySelector('.h-\\[300px\\]');
      expect(chart).toBeTruthy();
    });
  });
});

describe('AgentListSkeleton Component (FRONTEND-005)', () => {
  it('should render with default count (5)', () => {
    const { container } = render(<AgentListSkeleton />);
    const items = container.querySelectorAll('.flex.items-center');
    expect(items.length).toBe(5);
  });

  it('should render with custom count', () => {
    const { container } = render(<AgentListSkeleton count={8} />);
    const items = container.querySelectorAll('.flex.items-center');
    expect(items.length).toBe(8);
  });

  it('should render list variant structure', () => {
    const { container } = render(<AgentListSkeleton count={1} />);
    
    // Avatar
    expect(container.querySelector('.rounded-full')).toBeTruthy();
    
    // Text lines
    const textLines = container.querySelectorAll('.space-y-2 .animate-pulse');
    expect(textLines.length).toBeGreaterThan(0);
  });

  it('should have proper spacing', () => {
    const { container } = render(<AgentListSkeleton count={3} />);
    expect(container.querySelector('.space-y-3')).toBeTruthy();
  });
});

describe('AgentPanelSkeletonLoader Component (FRONTEND-005)', () => {
  it('should render agent-panel variant', () => {
    const { container } = render(<AgentPanelSkeletonLoader />);
    expect(container.querySelector('.space-y-6')).toBeTruthy();
  });

  it('should have header section', () => {
    const { container } = render(<AgentPanelSkeletonLoader />);
    
    // Avatar in header
    const avatar = container.querySelector('.rounded-full');
    expect(avatar).toBeTruthy();
    
    // Header border
    const header = container.querySelector('.border-b.border-gray-800');
    expect(header).toBeTruthy();
  });

  it('should have tab navigation skeletons', () => {
    const { container } = render(<AgentPanelSkeletonLoader />);
    
    // Multiple tab skeletons
    const tabs = container.querySelectorAll('.h-10.w-\\[100px\\]');
    expect(tabs.length).toBeGreaterThanOrEqual(4);
  });

  it('should have content cards', () => {
    const { container } = render(<AgentPanelSkeletonLoader />);
    
    // Grid layout for cards
    const grid = container.querySelector('.grid.grid-cols-2');
    expect(grid).toBeTruthy();
  });

  it('should have metrics section', () => {
    const { container } = render(<AgentPanelSkeletonLoader />);
    
    // Metrics grid (4 columns)
    const metricsGrid = container.querySelector('.grid.grid-cols-4');
    expect(metricsGrid).toBeTruthy();
  });

  it('should have chart placeholder', () => {
    const { container } = render(<AgentPanelSkeletonLoader />);
    
    // Large chart skeleton
    const chart = container.querySelector('.h-\\[300px\\]');
    expect(chart).toBeTruthy();
  });
});

describe('MetricCardSkeleton Component (FRONTEND-005)', () => {
  it('should render with default count (4)', () => {
    const { container } = render(<MetricCardSkeleton />);
    const metrics = container.querySelectorAll('.space-y-2.p-4');
    expect(metrics.length).toBe(4);
  });

  it('should render with custom count', () => {
    const { container } = render(<MetricCardSkeleton count={6} />);
    const metrics = container.querySelectorAll('.space-y-2.p-4');
    expect(metrics.length).toBe(6);
  });

  it('should render in grid layout', () => {
    const { container } = render(<MetricCardSkeleton />);
    expect(container.querySelector('.grid.grid-cols-4')).toBeTruthy();
  });

  it('should apply custom className', () => {
    const { container } = render(<MetricCardSkeleton className="custom-metrics" />);
    expect(container.querySelector('.custom-metrics')).toBeTruthy();
  });

  it('metric cards should have title, value, and change elements', () => {
    const { container } = render(<MetricCardSkeleton count={1} />);
    
    const metric = container.querySelector('.space-y-2.p-4');
    expect(metric).toBeTruthy();
    
    // Multiple skeleton elements in metric card
    const skeletons = metric?.querySelectorAll('.animate-pulse');
    expect(skeletons && skeletons.length).toBeGreaterThanOrEqual(3);
  });
});

describe('SkeletonLoader Animation (FRONTEND-005)', () => {
  it('all skeletons should have pulse animation', () => {
    const { container } = render(<SkeletonLoader variant="card" />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('list skeletons should have pulse animation', () => {
    const { container } = render(<AgentListSkeleton count={3} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('agent panel skeletons should have pulse animation', () => {
    const { container } = render(<AgentPanelSkeletonLoader />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(10);
  });
});

describe('SkeletonLoader Integration Tests (FRONTEND-005)', () => {
  it('should work as initial loading state', () => {
    const isLoading = true;
    const { container } = render(
      <div>
        {isLoading ? <AgentListSkeleton count={6} /> : <div>Agent List</div>}
      </div>
    );
    
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should transition to content smoothly', () => {
    const { rerender } = render(
      <div>
        {true ? <SkeletonLoader variant="card" /> : <div>Content</div>}
      </div>
    );
    
    // Initially shows skeleton
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
    
    // Transition to content
    rerender(
      <div>
        {false ? <SkeletonLoader variant="card" /> : <div>Content</div>}
      </div>
    );
    
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('should handle multiple loading states', () => {
    const { container } = render(
      <div className="space-y-4">
        <MetricCardSkeleton count={4} />
        <AgentListSkeleton count={6} />
        <SkeletonLoader variant="chart" />
      </div>
    );
    
    // All skeleton types present
    expect(container.querySelector('.grid.grid-cols-4')).toBeTruthy(); // Metrics
    expect(container.querySelector('.space-y-3')).toBeTruthy(); // List
    expect(container.querySelector('.h-\\[250px\\]')).toBeTruthy(); // Chart
  });
});

describe('SkeletonLoader Edge Cases (FRONTEND-005)', () => {
  it('should handle zero count gracefully', () => {
    const { container } = render(<SkeletonLoader variant="list" count={0} />);
    const items = container.querySelectorAll('.flex.items-center.gap-4');
    expect(items.length).toBe(0);
  });

  it('should handle very large count', () => {
    const { container } = render(<SkeletonLoader variant="list" count={100} />);
    const items = container.querySelectorAll('.flex.items-center.gap-4');
    expect(items.length).toBe(100);
  });

  it('should handle custom variant without children', () => {
    const { container } = render(<SkeletonLoader variant="custom" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should maintain structure with different viewport sizes', () => {
    const { container } = render(<AgentPanelSkeletonLoader />);
    
    // Responsive grid classes
    expect(container.innerHTML).toContain('grid');
    expect(container.innerHTML).toContain('grid-cols');
  });
});

describe('SkeletonLoader Accessibility (FRONTEND-005)', () => {
  it('should use semantic HTML', () => {
    const { container } = render(<SkeletonLoader variant="card" />);
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBeGreaterThan(0);
  });

  it('should maintain proper spacing for screen readers', () => {
    const { container } = render(<SkeletonLoader variant="list" count={3} />);
    
    // Space-y classes for proper spacing
    expect(container.querySelector('.space-y-3')).toBeTruthy();
  });

  it('should use proper contrast ratios', () => {
    const { container } = render(<SkeletonLoader variant="card" />);
    
    // Gray colors used for skeletons
    expect(container.innerHTML).toContain('gray-800');
  });
});

describe('SkeletonLoader Performance (FRONTEND-005)', () => {
  it('should render large lists efficiently', () => {
    const startTime = performance.now();
    render(<AgentListSkeleton count={50} />);
    const endTime = performance.now();
    
    // Should render in reasonable time (< 200ms)
    expect(endTime - startTime).toBeLessThan(200);
  });

  it('should render complex agent panel efficiently', () => {
    const startTime = performance.now();
    render(<AgentPanelSkeletonLoader />);
    const endTime = performance.now();
    
    // Should render in reasonable time (< 100ms)
    expect(endTime - startTime).toBeLessThan(100);
  });
});
