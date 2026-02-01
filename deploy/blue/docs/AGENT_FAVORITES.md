# Agent Favorites/Bookmarks Feature Documentation

## Overview

The Agent Favorites feature allows TitanGold users to mark specific AI agents as favorites (bookmarked) for quick access. Favorited agents are displayed first in the agent list and persist across browser sessions using localStorage.

**Date**: 2026-01-31  
**Task**: FRONTEND-013  
**Status**: Production Ready

---

## Table of Contents

1. [Features](#features)
2. [User Interface](#user-interface)
3. [Technical Implementation](#technical-implementation)
4. [Storage](#storage)
5. [Usage Guide](#usage-guide)
6. [Integration](#integration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Features

### Core Features (Definition of Done)

1. **⭐ Star Icon on Agent Cards (DoD #1)**
   - Clickable star icon in top-right corner of each agent card
   - Filled star (⭐) for favorited agents
   - Empty star (☆) for non-favorited agents
   - Hover animation (scale effect)
   - Accessible with ARIA labels

2. **📌 Favorites Shown First (DoD #2)**
   - Favorited agents automatically sorted to top of list
   - Secondary sorting by agent name (alphabetical)
   - Real-time reordering when favorites change
   - Visual consistency maintained

3. **💾 Persisted Across Sessions (DoD #3)**
   - Favorites saved to localStorage
   - Automatic persistence on every change
   - Survives browser refresh/restart
   - Works offline
   - No backend dependency

4. **📚 Documentation (DoD #4)**
   - Complete feature documentation (this file)
   - Usage guide
   - Integration examples
   - Troubleshooting guide

---

## User Interface

### Star Icon Behavior

**Visual States**:
- **Empty Star (☆)**: Not favorited, gray/muted color
- **Filled Star (⭐)**: Favorited, yellow/gold color
- **Hover**: Scale animation (110% size)
- **Click**: Toggle between states with immediate visual feedback

**Positioning**:
- Located in **top-right corner** of agent card
- Positioned absolutely within card container
- Z-index: 10 (above card content)
- Does not interfere with other card elements

**Accessibility**:
- Clickable button element
- ARIA labels: "Add to favorites" / "Remove from favorites"
- Tooltip on hover with translated text
- Keyboard accessible (Tab navigation)

### Agent Card Layout

```
┌─────────────────────────────────────┐
│  Agent Name                      ⭐ │  ← Star icon (top-right)
│  Status                   85.5%     │
│                          Accuracy   │
│                                     │
│  Training Progress: ████░░ 75%     │
│  Decisions: 1,234                   │
│  Learning Time: 56h                 │
│  Knowledge Size: 12.3MB             │
│                                     │
│  Capabilities: [Tag1] [Tag2] [Tag3]│
│─────────────────────────────────────│
│  [Control Panel]    Last update: ... │
└─────────────────────────────────────┘
```

### Sorting Order

**Priority Order**:
1. **Favorited agents** (with ⭐) - shown first
2. **Non-favorited agents** (with ☆) - shown after
3. Within each group: **Alphabetical by name**

**Example**:
```
Visible Order (if 3 agents favorited):
1. ⭐ Arbitrage Agent
2. ⭐ Risk Management Agent  
3. ⭐ Technical Analysis Agent
4. ☆ Fundamental Analysis Agent
5. ☆ Liquidity Agent
6. ☆ Market Intelligence Agent
... (remaining agents)
```

---

## Technical Implementation

### Custom Hook: `useAgentFavorites`

**File**: `hooks/useAgentFavorites.ts`

**Purpose**: Manage agent favorites with localStorage persistence

**API**:
```typescript
interface UseAgentFavoritesReturn {
  favorites: Set<string>;           // Set of favorited agent IDs
  isFavorite: (agentId: string) => boolean;  // Check if favorited
  toggleFavorite: (agentId: string) => void; // Toggle favorite status
  getFavoriteIds: () => string[];    // Get array of favorite IDs
}
```

**Features**:
- React hook with useState and useEffect
- Automatic localStorage sync
- Optimized with useCallback for stable function references
- Error handling for localStorage failures
- Type-safe with TypeScript

**Storage Key**: `titangold_agent_favorites`

**Storage Format**: JSON array of agent ID strings
```json
["1", "3", "7"]
```

### Component Updates: `AIAgents.tsx`

**Changes**:
1. Import `useAgentFavorites` hook
2. Import `useMemo` for optimized sorting
3. Add favorites hook to component state
4. Implement `sortedAgents` memo with sorting logic
5. Pass favorite props to `AgentCard` components
6. Update `AgentCard` to include star button
7. Add click handler with `stopPropagation`

**Sorting Logic**:
```typescript
const sortedAgents = useMemo(() => {
  return [...agents].sort((a, b) => {
    const aFav = isFavorite(a.id);
    const bFav = isFavorite(b.id);
    
    // Favorites first
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    
    // Then sort by name
    return a.name.localeCompare(b.name);
  });
}, [agents, isFavorite]);
```

**Performance**:
- `useMemo` prevents unnecessary re-sorting
- Only recomputes when `agents` or `isFavorite` changes
- Efficient Set lookup for favorite checking (O(1))

---

## Storage

### localStorage Implementation

**Key**: `titangold_agent_favorites`

**Format**: JSON array of strings
```json
["agent_id_1", "agent_id_2", "agent_id_3"]
```

**Size**: ~50-200 bytes (depends on number of favorites)

**Persistence**:
- Survives page refresh
- Survives browser restart
- Survives tab closure
- User-specific (per browser)
- Domain-specific (titangold.com)

**Limitations**:
- Browser-specific (not synced across devices)
- User-specific (not synced across users)
- ~5-10MB total localStorage limit per domain
- Can be cleared by user (browser settings)

### Error Handling

**Load Failures**:
- Catches JSON parse errors
- Falls back to empty Set
- Logs error to console
- User experience: No favorites initially

**Save Failures**:
- Catches localStorage quota errors
- Logs error to console
- User experience: Changes not persisted
- Recommendation: Notify user if persistent failures

---

## Usage Guide

### For Users

**Adding a Favorite**:
1. Navigate to AI Agents page
2. Find agent card you want to favorite
3. Click the **empty star (☆)** in top-right corner
4. Star becomes **filled (⭐)** immediately
5. Agent moves to top of list
6. Favorite is saved automatically

**Removing a Favorite**:
1. Find favorited agent (with filled star ⭐)
2. Click the **filled star (⭐)** in top-right corner
3. Star becomes **empty (☆)** immediately
4. Agent moves to regular position (alphabetical)
5. Change is saved automatically

**Viewing Favorites**:
- Favorited agents always appear **first** in the list
- Look for **⭐** icon to identify favorites
- Favorites are sorted alphabetically within their group

### For Developers

**Basic Integration**:
```typescript
import { useAgentFavorites } from '../../hooks/useAgentFavorites';

function MyComponent() {
  const { isFavorite, toggleFavorite } = useAgentFavorites();
  
  return (
    <button onClick={() => toggleFavorite('agent_123')}>
      {isFavorite('agent_123') ? '⭐' : '☆'}
    </button>
  );
}
```

**Getting All Favorites**:
```typescript
const { getFavoriteIds } = useAgentFavorites();
const favoriteIds = getFavoriteIds(); // ['1', '3', '7']
```

**Checking Multiple Agents**:
```typescript
const { isFavorite } = useAgentFavorites();
const favoriteAgents = agents.filter(agent => isFavorite(agent.id));
```

**Custom Sorting**:
```typescript
const sortedAgents = useMemo(() => {
  return [...agents].sort((a, b) => {
    // Your custom sorting logic here
    // Can use isFavorite(a.id) in sort comparison
  });
}, [agents, isFavorite]);
```

---

## Integration

### Required Dependencies

- **React**: ^18.0.0
- **TypeScript**: ^5.0.0
- Browser with localStorage support (all modern browsers)

### File Structure

```
TitanGold/
├── hooks/
│   └── useAgentFavorites.ts          (NEW - Custom hook)
├── components/
│   └── ai/
│       └── AIAgents.tsx               (MODIFIED - Integration)
└── docs/
    └── AGENT_FAVORITES.md             (NEW - Documentation)
```

### Integration Steps

1. **Create Hook** (`hooks/useAgentFavorites.ts`):
   - Define storage key
   - Implement useState with localStorage init
   - Add useEffect for persistence
   - Create helper functions

2. **Update Component** (`components/ai/AIAgents.tsx`):
   - Import hook
   - Use hook in component
   - Add sorting logic with useMemo
   - Update AgentCard props
   - Add star button to card

3. **Test**:
   - Click star to favorite agent
   - Verify agent moves to top
   - Refresh page and verify persistence
   - Clear favorites and verify removal

---

## Best Practices

### For Users

1. **Favorite Frequently Used Agents**
   - Mark agents you use most often
   - Quick access saves time
   - Typical: 3-5 favorite agents

2. **Organize by Workflow**
   - Favorite agents for your trading strategy
   - Group related agents together
   - Example: Technical + Risk + Sentiment

3. **Review Periodically**
   - Remove unused favorites
   - Add new favorites as needed
   - Keep list manageable (< 10 favorites)

### For Developers

1. **Performance**
   - Use `useMemo` for sorting
   - Use `useCallback` in hook
   - Minimize re-renders

2. **Error Handling**
   - Wrap localStorage access in try-catch
   - Provide fallback behavior
   - Log errors for debugging

3. **Type Safety**
   - Use TypeScript interfaces
   - Validate agent IDs
   - Type check all props

4. **Accessibility**
   - Include ARIA labels
   - Support keyboard navigation
   - Provide tooltips

5. **Testing**
   - Test localStorage persistence
   - Test sorting logic
   - Test edge cases (empty favorites, all favorited)
   - Test localStorage quota exceeded

---

## Troubleshooting

### Common Issues

**Issue**: Star icon not showing

**Cause**: Component not receiving favorite props

**Solution**:
- Check `AgentCard` receives `isFavorite` and `onToggleFavorite` props
- Verify `useAgentFavorites` hook is called in parent component
- Check console for errors

---

**Issue**: Favorites not persisting after refresh

**Cause**: localStorage not saving or being cleared

**Solution**:
- Check browser console for localStorage errors
- Verify browser allows localStorage (not in private/incognito mode)
- Check browser settings (localStorage enabled)
- Test with: `localStorage.setItem('test', 'value')` in console

---

**Issue**: Agents not sorting correctly

**Cause**: Sorting logic issue or memo not updating

**Solution**:
- Verify `sortedAgents` useMemo dependencies include `isFavorite`
- Check sorting logic: favorites should return -1 to sort first
- Test with console.log to debug sort order

---

**Issue**: Star click triggers card click

**Cause**: Event propagation not stopped

**Solution**:
- Ensure `e.stopPropagation()` is called in star button onClick
- Verify button is properly positioned with z-index

---

**Issue**: Multiple stars appearing on card

**Cause**: Component rendering multiple times or styling issue

**Solution**:
- Check for duplicate star button elements
- Verify absolute positioning is correct
- Check for CSS conflicts

---

**Issue**: localStorage quota exceeded

**Cause**: Too much data in localStorage (rare for favorites)

**Solution**:
- Clear other localStorage data
- Check for memory leaks storing large data
- Typical favorites list: < 1KB (not an issue)

---

## API Reference

### `useAgentFavorites` Hook

**Import**:
```typescript
import { useAgentFavorites } from '../../hooks/useAgentFavorites';
```

**Usage**:
```typescript
const { favorites, isFavorite, toggleFavorite, getFavoriteIds } = useAgentFavorites();
```

**Returns**:

| Property | Type | Description |
|----------|------|-------------|
| `favorites` | `Set<string>` | Set of favorited agent IDs |
| `isFavorite` | `(agentId: string) => boolean` | Check if agent is favorited |
| `toggleFavorite` | `(agentId: string) => void` | Toggle favorite status |
| `getFavoriteIds` | `() => string[]` | Get array of favorite IDs |

**Examples**:

```typescript
// Check if agent is favorited
if (isFavorite('agent_123')) {
  console.log('Agent is favorited');
}

// Toggle favorite
toggleFavorite('agent_123');

// Get all favorite IDs
const favIds = getFavoriteIds(); // ['1', '3', '7']

// Access Set directly
console.log(favorites.size); // Number of favorites
```

---

## Browser Compatibility

**localStorage Support**:
- ✅ Chrome 4+
- ✅ Firefox 3.5+
- ✅ Safari 4+
- ✅ Edge (all versions)
- ✅ Opera 10.5+
- ✅ iOS Safari 3.2+
- ✅ Android Browser 2.1+

**JavaScript Features**:
- ✅ ES6+ (Set, arrow functions, destructuring)
- ✅ React Hooks (useState, useEffect, useMemo, useCallback)

---

## Future Enhancements

### Potential Improvements (Follow-up Tasks)

1. **FRONTEND-013-01**: Backend sync for favorites
   - Sync favorites across devices
   - Save to user profile
   - Multi-device support

2. **FRONTEND-013-02**: Favorite categories/tags
   - Group favorites by category
   - Custom tags for agents
   - Filter by tag

3. **FRONTEND-013-03**: Import/Export favorites
   - Export favorites to file
   - Import favorites from file
   - Share favorites with team

4. **FRONTEND-013-04**: Favorite statistics
   - Track favorite usage
   - Show most used favorites
   - Usage analytics

5. **FRONTEND-013-05**: Drag-and-drop reordering
   - Custom order for favorites
   - Drag to reorder
   - Save custom order

6. **FRONTEND-013-06**: Favorite limit with notification
   - Set maximum favorites (e.g., 10)
   - Notify when limit reached
   - Suggest removing unused

7. **FRONTEND-013-07**: Bulk favorite operations
   - Select multiple agents
   - Favorite/unfavorite all selected
   - Clear all favorites button

---

## Changelog

### v1.0.0 (2026-01-31) - Initial Release
- ✅ DoD #1: Star icon on agent cards (⭐/☆)
- ✅ DoD #2: Favorites shown first in list
- ✅ DoD #3: Persisted across sessions (localStorage)
- ✅ DoD #4: Complete documentation

---

## Support

For issues or questions:
- Check this documentation first
- Review browser console for errors
- Test localStorage availability
- Contact development team

---

## License

Copyright © 2026 TitanGold. All rights reserved.

---

**End of Documentation**
