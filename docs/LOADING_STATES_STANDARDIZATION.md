# Loading States Standardization Guide

**Task ID**: FRONTEND-005  
**Status**: ✅ COMPLETED  
**Date**: 2026-01-31  
**Layer**: Frontend  
**Priority**: P2

## Overview

This document describes the standardized loading components used throughout the TitanGold application. Following these guidelines ensures a consistent user experience across all features.

## Components

### 1. LoadingSpinner

**Purpose**: Indicate ongoing operations with an animated spinner.

**When to use**:
- Short-duration operations (< 3 seconds expected)
- Button/action feedback
- Simple data fetching
- Agent panel lazy loading
- Inline loading states

**Import**:
```tsx
import LoadingSpinner, { AgentLoadingSpinner, InlineLoadingSpinner } from '../ui/LoadingSpinner';
```

**Basic Usage**:
```tsx
// Default spinner
<LoadingSpinner />

// With custom size
<LoadingSpinner size="lg" />

// With message
<LoadingSpinner message="Loading data..." />

// Centered in container
<LoadingSpinner centered />

// Different color variants
<LoadingSpinner variant="primary" />   // Blue (default)
<LoadingSpinner variant="secondary" /> // Gray
<LoadingSpinner variant="accent" />    // Yellow
```

**Specialized Variants**:

#### AgentLoadingSpinner
Pre-configured for agent control panel loading:
```tsx
<AgentLoadingSpinner agentName="Technical Analysis" />
```

#### InlineLoadingSpinner
Small spinner for inline contexts (buttons, inputs):
```tsx
<button disabled>
  <InlineLoadingSpinner /> Processing...
</button>
```

**Props**:
```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';      // Default: 'md'
  message?: string;                       // Optional message below spinner
  centered?: boolean;                     // Center in container
  className?: string;                     // Additional CSS classes
  variant?: 'primary' | 'secondary' | 'accent';  // Color variant
}
```

---

### 2. SkeletonLoader

**Purpose**: Show content structure while loading, providing visual feedback about what will appear.

**When to use**:
- Initial page/component load
- Longer-duration operations (> 3 seconds expected)
- When you know the layout structure
- Complex data tables, lists, or panels
- Agent panels with multiple sections

**Import**:
```tsx
import SkeletonLoader, { 
  AgentListSkeleton, 
  AgentPanelSkeletonLoader,
  MetricCardSkeleton 
} from '../ui/SkeletonLoader';
```

**Basic Usage**:
```tsx
// Card skeleton (dashboard cards, panels)
<SkeletonLoader variant="card" />

// List skeleton (agent lists, settings)
<SkeletonLoader variant="list" count={5} />

// Table skeleton
<SkeletonLoader variant="table" count={10} />

// Agent panel skeleton
<SkeletonLoader variant="agent-panel" />

// Chart placeholder
<SkeletonLoader variant="chart" />

// Metric cards
<SkeletonLoader variant="metric" />

// Custom composition
<SkeletonLoader variant="custom">
  <Skeleton className="h-12 w-12 rounded-full" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
</SkeletonLoader>
```

**Specialized Variants**:

#### AgentListSkeleton
For agent list views:
```tsx
<AgentListSkeleton count={6} />
```

#### AgentPanelSkeletonLoader
For full agent control panel loading:
```tsx
<AgentPanelSkeletonLoader />
```

#### MetricCardSkeleton
For metric/KPI card grids:
```tsx
<MetricCardSkeleton count={4} />
```

**Props**:
```typescript
interface SkeletonLoaderProps {
  variant?: 'card' | 'list' | 'table' | 'agent-panel' | 'chart' | 'metric' | 'custom';
  count?: number;          // For list/table variants
  className?: string;
  children?: React.ReactNode;  // For custom variant
}
```

---

## Decision Matrix

| Scenario | Component | Example |
|----------|-----------|---------|
| **Agent list initial load** | `AgentListSkeleton` | Agent grid on dashboard |
| **Agent panel lazy load** | `AgentLoadingSpinner` | React.lazy Suspense fallback |
| **Data fetching (< 3s)** | `LoadingSpinner` | Refresh button action |
| **Data fetching (> 3s)** | `SkeletonLoader` | Initial dashboard load |
| **Table loading** | `SkeletonLoader variant="table"` | Transaction history |
| **Button action** | `InlineLoadingSpinner` | Save/Submit button |
| **Chart loading** | `SkeletonLoader variant="chart"` | Performance graphs |
| **Metrics loading** | `MetricCardSkeleton` | KPI dashboard |
| **Full panel loading** | `AgentPanelSkeletonLoader` | Agent control initial state |

---

## Implementation Examples

### Example 1: Agent List with Skeleton Loading
```tsx
const AIAgents: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [agents, setAgents] = useState<AIAgent[]>([]);

  useEffect(() => {
    fetchAgents().then(data => {
      setAgents(data);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return <AgentListSkeleton count={6} />;
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
    </div>
  );
};
```

### Example 2: Lazy-Loaded Agent Panel
```tsx
import { Suspense } from 'react';
import { AgentLoadingSpinner } from '../ui/LoadingSpinner';

const TechnicalAgentControl = React.lazy(() => import('./TechnicalAnalysisAgentControl'));

const AgentContainer: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card border rounded-lg p-8">
          <AgentLoadingSpinner agentName="Technical Analysis" />
        </div>
      </div>
    }>
      <TechnicalAgentControl agent={selectedAgent} />
    </Suspense>
  );
};
```

### Example 3: Agent Control Panel Internal Loading
```tsx
const TechnicalAnalysisAgentControl: React.FC<Props> = ({ agent }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadAgentData(agent.id).then(data => {
      setData(data);
      setIsLoading(false);
    });
  }, [agent.id]);

  if (isLoading) {
    return <AgentPanelSkeletonLoader />;
  }

  return (
    <div className="agent-panel">
      {/* Agent content */}
    </div>
  );
};
```

### Example 4: Button with Inline Spinner
```tsx
const SaveButton: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await saveData();
    setIsSaving(false);
  };

  return (
    <button onClick={handleSave} disabled={isSaving}>
      {isSaving && <InlineLoadingSpinner />}
      {isSaving ? 'Saving...' : 'Save Changes'}
    </button>
  );
};
```

### Example 5: Dashboard with Multiple Loading States
```tsx
const Dashboard: React.FC = () => {
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

  if (isLoadingAgents && isLoadingMetrics) {
    return (
      <div className="space-y-6">
        <MetricCardSkeleton count={4} />
        <AgentListSkeleton count={6} />
        <SkeletonLoader variant="chart" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isLoadingMetrics ? <MetricCardSkeleton count={4} /> : <MetricCards />}
      {isLoadingAgents ? <AgentListSkeleton count={6} /> : <AgentList />}
    </div>
  );
};
```

---

## Integration Checklist

When adding loading states to a component:

- [ ] **Identify operation duration**
  - < 3 seconds → LoadingSpinner
  - > 3 seconds or complex layout → SkeletonLoader

- [ ] **Choose appropriate variant**
  - Agent list → `AgentListSkeleton`
  - Agent panel → `AgentPanelSkeletonLoader` or `AgentLoadingSpinner`
  - Data table → `SkeletonLoader variant="table"`
  - Metrics → `MetricCardSkeleton`
  - Button action → `InlineLoadingSpinner`

- [ ] **Replace existing loading states**
  - Remove custom spinners
  - Remove "Loading..." text divs
  - Remove ad-hoc skeleton implementations

- [ ] **Test loading experience**
  - Verify spinner/skeleton appears immediately
  - Check smooth transition when data loads
  - Ensure proper cleanup (no memory leaks)

- [ ] **Document special cases**
  - Note any custom loading requirements
  - Document why specific variant was chosen

---

## File Structure

```
components/
├── ui/
│   ├── LoadingSpinner.tsx          # Main spinner component
│   ├── SkeletonLoader.tsx          # Main skeleton component
│   └── skeleton.tsx                # Base skeleton primitive
├── ai/
│   ├── AIAgents.tsx                # Uses AgentListSkeleton & AgentLoadingSpinner
│   ├── TechnicalAnalysisAgentControl.tsx
│   ├── PricePredictionAgentControl.tsx
│   └── ... (all agent controls)
```

---

## Performance Considerations

### LoadingSpinner
- **Bundle size**: ~1KB (minified)
- **Rendering cost**: Minimal (single animated div)
- **Best for**: Quick feedback, button states, simple operations

### SkeletonLoader
- **Bundle size**: ~3KB (minified)
- **Rendering cost**: Low (static SVG-like elements)
- **Best for**: Complex layouts, perceived performance improvement
- **Benefit**: Users perceive content loading faster with skeleton UI

---

## Accessibility

Both components follow accessibility best practices:

**LoadingSpinner**:
- Includes `role="status"` attribute
- Includes `aria-label="Loading"` for screen readers
- Message text is properly announced

**SkeletonLoader**:
- Uses semantic HTML structure
- Maintains proper contrast ratios
- Preserves layout spacing for screen readers

---

## Migration Guide

### Replacing Old Loading States

**Before** (inconsistent):
```tsx
// Various old patterns across codebase
<div className="text-center p-10">Loading...</div>
<div className="spinner">...</div>
<div className="animate-spin h-8 w-8 ...">...</div>
```

**After** (standardized):
```tsx
// For simple operations
<LoadingSpinner message="Loading agents..." centered />

// For complex layouts
<AgentListSkeleton count={6} />
```

### Agent Control Components

All 15 agent control components should follow this pattern:

```tsx
import { AgentLoadingSpinner } from '../ui/LoadingSpinner';
import { AgentPanelSkeletonLoader } from '../ui/SkeletonLoader';

const AgentControl: React.FC<Props> = ({ agent }) => {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Initial panel load - show skeleton
  if (isInitialLoading) {
    return <AgentPanelSkeletonLoader />;
  }
  
  return <div>{/* Agent content */}</div>;
};
```

---

## Testing

### Unit Tests
Both components include comprehensive tests:

**LoadingSpinner tests**:
- Renders with default props
- Renders with custom sizes
- Displays message
- Centers correctly
- Applies custom className

**SkeletonLoader tests**:
- Renders all variants
- Respects count prop
- Handles custom children
- Renders specialized variants

### Visual Testing
- Verify spinner animation is smooth (60fps)
- Check skeleton pulse animation timing
- Ensure proper spacing and alignment
- Test dark mode compatibility

---

## Common Patterns

### Pattern 1: Conditional Loading in Lists
```tsx
{isLoading ? (
  <AgentListSkeleton count={agents.length || 6} />
) : (
  agents.map(agent => <AgentCard key={agent.id} agent={agent} />)
)}
```

### Pattern 2: Progressive Loading
```tsx
// Show skeleton immediately, spinner for actions
const [isInitialLoad, setIsInitialLoad] = useState(true);
const [isRefreshing, setIsRefreshing] = useState(false);

if (isInitialLoad) return <AgentPanelSkeletonLoader />;

return (
  <div>
    <button onClick={refresh} disabled={isRefreshing}>
      {isRefreshing && <InlineLoadingSpinner />}
      Refresh
    </button>
    {/* Content */}
  </div>
);
```

### Pattern 3: Lazy Loading with Suspense
```tsx
<Suspense fallback={<AgentLoadingSpinner agentName={agent.name} />}>
  <LazyAgentControl agent={agent} />
</Suspense>
```

---

## Troubleshooting

### Issue: Spinner not showing
**Solution**: Ensure loading state is set to `true` before async operation starts

### Issue: Skeleton shows briefly then disappears
**Solution**: Check that data is cached or loading state management is correct

### Issue: Layout shift when content loads
**Solution**: Ensure skeleton matches actual content dimensions closely

### Issue: Multiple spinners overlapping
**Solution**: Use a single loading state at component level, not multiple nested states

---

## Future Enhancements

Potential improvements for consideration:

- [ ] **FRONTEND-061**: Add loading progress indicators (0-100%)
- [ ] **FRONTEND-062**: Implement shimmer effect for skeletons
- [ ] **FRONTEND-063**: Add preload hints for lazy-loaded agents
- [ ] **FRONTEND-064**: Create loading state analytics (track avg load times)
- [ ] **FRONTEND-065**: Add retry mechanism for failed loads
- [ ] **FRONTEND-066**: Implement optimistic UI updates with loading overlays

---

## Related Documentation

- [Agent Lazy Loading](./AGENT_LAZY_LOADING.md) - FRONTEND-003
- [Shared Data Context](./AGENT_DATA_CONTEXT.md) - FRONTEND-004
- Component Architecture (coming soon)

---

## Summary

**Definition of Done**: ✅ All criteria met
- [x] Shared `LoadingSpinner` component created
- [x] Shared `SkeletonLoader` component created
- [x] All agent controls standardized to use shared loaders
- [x] Consistent styling across components
- [x] Documentation provided (when to use each loader)
- [x] Integration examples included
- [x] Accessibility considerations addressed

**Benefits**:
- **Consistency**: Uniform loading experience across app
- **Maintainability**: Single source of truth for loading UI
- **Performance**: Optimized, reusable components
- **User Experience**: Clear, predictable loading feedback
- **Developer Experience**: Easy-to-use, well-documented API

**Status**: PRODUCTION-READY ✅
