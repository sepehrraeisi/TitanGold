# Agent Key Constants Documentation

**Task ID**: FRONTEND-006  
**Status**: ✅ COMPLETED  
**Date**: 2026-01-31  
**Layer**: Frontend  
**Priority**: P2

## Overview

This document describes the agent key constants system implemented for TitanGold. Agent keys are now defined as TypeScript constants, providing type safety, autocomplete support, and preventing typos throughout the codebase.

## Why Agent Key Constants?

### Problems Solved

**Before (Hard-coded strings)**:
```typescript
// ❌ No autocomplete
// ❌ Typos not caught at compile time
// ❌ Hard to refactor
const agent = agents.find(a => a.agent_key === 'technical');

if (agentKey === 'sentiment') {
  // ...
}

switch (agentKey) {
  case 'risk':
    // ...
}
```

**After (Type-safe constants)**:
```typescript
// ✅ Full autocomplete support
// ✅ Compile-time type checking
// ✅ Easy refactoring
import { AGENT_KEYS } from '../constants/agentKeys';

const agent = agents.find(a => a.agent_key === AGENT_KEYS.TECHNICAL);

if (agentKey === AGENT_KEYS.SENTIMENT) {
  // ...
}

switch (agentKey) {
  case AGENT_KEYS.RISK:
    // ...
}
```

## File Location

```
constants/
└── agentKeys.ts          # All agent key constants and utilities
```

## Exports

### 1. AgentKey Enum

TypeScript enum for agent keys:

```typescript
export enum AgentKey {
  TECHNICAL = 'technical',
  RISK = 'risk',
  SENTIMENT = 'sentiment',
  PATTERN = 'pattern',
  PRICE_PREDICTION = 'price_prediction',
  ARBITRAGE = 'arbitrage',
  PORTFOLIO = 'portfolio',
  LIQUIDITY = 'liquidity',
  TREND = 'trend_detection',
  OPTIMIZATION = 'optimization',
  ORDER = 'order',
  FUNDAMENTAL = 'fundamental',
  MARKET_INTELLIGENCE = 'market_intelligence',
  VOLUME = 'volume',
  TIMING = 'timing'
}
```

**Usage**:
```typescript
import { AgentKey } from '../constants/agentKeys';

const myAgent: AgentKey = AgentKey.TECHNICAL;
```

### 2. AGENT_KEYS Const Object

Constant object (alternative to enum):

```typescript
export const AGENT_KEYS = {
  TECHNICAL: 'technical',
  RISK: 'risk',
  SENTIMENT: 'sentiment',
  // ... (all 15 agents)
} as const;
```

**Usage**:
```typescript
import { AGENT_KEYS } from '../constants/agentKeys';

const key = AGENT_KEYS.TECHNICAL; // Type: 'technical'
```

**When to use**:
- Preferred for most use cases
- Better for object iteration
- Works well with computed property names

### 3. AgentKeyType

Union type of all agent key values:

```typescript
export type AgentKeyType = typeof AGENT_KEYS[keyof typeof AGENT_KEYS];
// Result: 'technical' | 'risk' | 'sentiment' | ...
```

**Usage**:
```typescript
import { AgentKeyType } from '../constants/agentKeys';

function processAgent(key: AgentKeyType) {
  // TypeScript ensures only valid agent keys can be passed
}
```

### 4. ALL_AGENT_KEYS Array

Array of all agent keys for iteration:

```typescript
export const ALL_AGENT_KEYS: readonly AgentKeyType[] = Object.values(AGENT_KEYS);
```

**Usage**:
```typescript
import { ALL_AGENT_KEYS } from '../constants/agentKeys';

ALL_AGENT_KEYS.forEach(key => {
  console.log(`Processing agent: ${key}`);
});
```

### 5. AGENT_DISPLAY_NAMES

Human-readable names for each agent:

```typescript
export const AGENT_DISPLAY_NAMES: Record<AgentKeyType, string> = {
  [AGENT_KEYS.TECHNICAL]: 'Technical Analysis',
  [AGENT_KEYS.RISK]: 'Risk Management',
  // ... (all 15 agents)
};
```

**Usage**:
```typescript
import { AGENT_KEYS, AGENT_DISPLAY_NAMES } from '../constants/agentKeys';

const displayName = AGENT_DISPLAY_NAMES[AGENT_KEYS.TECHNICAL];
// Result: 'Technical Analysis'
```

### 6. Utility Functions

#### isValidAgentKey()

Type guard to check if a string is a valid agent key:

```typescript
export function isValidAgentKey(key: string): key is AgentKeyType;
```

**Usage**:
```typescript
import { isValidAgentKey } from '../constants/agentKeys';

const userInput = 'technical';

if (isValidAgentKey(userInput)) {
  // TypeScript knows userInput is AgentKeyType here
  processAgent(userInput);
}
```

#### getAgentDisplayName()

Get human-readable name for an agent key:

```typescript
export function getAgentDisplayName(key: AgentKeyType): string;
```

**Usage**:
```typescript
import { AGENT_KEYS, getAgentDisplayName } from '../constants/agentKeys';

const name = getAgentDisplayName(AGENT_KEYS.TECHNICAL);
// Result: 'Technical Analysis'
```

#### toRegistryKey()

Convert backend agent_key to frontend registry key:

```typescript
export function toRegistryKey(agentKey: string): string;
```

**Usage**:
```typescript
import { toRegistryKey } from '../constants/agentKeys';

const registryKey = toRegistryKey('trend_detection');
// Result: 'trend' (mapped for frontend registry)
```

## Complete Agent Key List

| Constant | Value | Display Name |
|----------|-------|--------------|
| `AGENT_KEYS.TECHNICAL` | `'technical'` | Technical Analysis |
| `AGENT_KEYS.RISK` | `'risk'` | Risk Management |
| `AGENT_KEYS.SENTIMENT` | `'sentiment'` | Sentiment Analysis |
| `AGENT_KEYS.PATTERN` | `'pattern'` | Pattern Recognition |
| `AGENT_KEYS.PRICE_PREDICTION` | `'price_prediction'` | Price Prediction |
| `AGENT_KEYS.ARBITRAGE` | `'arbitrage'` | Arbitrage |
| `AGENT_KEYS.PORTFOLIO` | `'portfolio'` | Portfolio Allocation |
| `AGENT_KEYS.LIQUIDITY` | `'liquidity'` | Liquidity Analysis |
| `AGENT_KEYS.TREND` | `'trend_detection'` | Trend Detection |
| `AGENT_KEYS.OPTIMIZATION` | `'optimization'` | Optimization |
| `AGENT_KEYS.ORDER` | `'order'` | Order Management |
| `AGENT_KEYS.FUNDAMENTAL` | `'fundamental'` | Fundamental Analysis |
| `AGENT_KEYS.MARKET_INTELLIGENCE` | `'market_intelligence'` | Market Intelligence |
| `AGENT_KEYS.VOLUME` | `'volume'` | Volume Analysis |
| `AGENT_KEYS.TIMING` | `'timing'` | Timing |

## Usage Examples

### Example 1: Agent Registry

**Before**:
```typescript
export const agentRegistry = {
  technical: {
    key: 'technical',
    component: lazy(() => import('./TechnicalAnalysisAgentControl.tsx')),
  },
  // ...
};
```

**After**:
```typescript
import { AGENT_KEYS } from '../../constants/agentKeys';

export const agentRegistry = {
  [AGENT_KEYS.TECHNICAL]: {
    key: AGENT_KEYS.TECHNICAL,
    component: lazy(() => import('./TechnicalAnalysisAgentControl.tsx')),
  },
  // ...
};
```

### Example 2: Switch Statement

**Before**:
```typescript
switch (agentKey) {
  case 'technical':
    return await api.fetchTechnicalAnalysisAgentData(agent.id);
  case 'risk':
    return await api.fetchRiskManagementAgentData(agent.id);
  // ...
}
```

**After**:
```typescript
import { AGENT_KEYS } from '../constants/agentKeys';

switch (agentKey) {
  case AGENT_KEYS.TECHNICAL:
    return await api.fetchTechnicalAnalysisAgentData(agent.id);
  case AGENT_KEYS.RISK:
    return await api.fetchRiskManagementAgentData(agent.id);
  // ...
}
```

### Example 3: Array Filtering

**Before**:
```typescript
const technicalAgent = agents.find(a => a.agent_key === 'technical');
```

**After**:
```typescript
import { AGENT_KEYS } from '../constants/agentKeys';

const technicalAgent = agents.find(a => a.agent_key === AGENT_KEYS.TECHNICAL);
```

### Example 4: Validation

**Before**:
```typescript
const validKeys = ['technical', 'risk', 'sentiment', /* ... */];
if (validKeys.includes(userInput)) {
  // Process
}
```

**After**:
```typescript
import { isValidAgentKey } from '../constants/agentKeys';

if (isValidAgentKey(userInput)) {
  // TypeScript knows userInput is AgentKeyType
  processAgent(userInput);
}
```

### Example 5: UI Display

**Before**:
```typescript
const displayName = agentKey === 'technical' ? 'Technical Analysis' : 
                    agentKey === 'risk' ? 'Risk Management' : 
                    agentKey;
```

**After**:
```typescript
import { getAgentDisplayName } from '../constants/agentKeys';

const displayName = getAgentDisplayName(agentKey);
```

## Migration Guide

### Step 1: Import Constants

Add import to files using agent keys:

```typescript
import { AGENT_KEYS } from '../constants/agentKeys';
// or
import { AgentKey } from '../constants/agentKeys';
```

### Step 2: Replace Hard-coded Strings

Replace all string literals with constants:

```typescript
// Before
if (agent.agent_key === 'technical') { }

// After
if (agent.agent_key === AGENT_KEYS.TECHNICAL) { }
```

### Step 3: Update Switch Statements

```typescript
// Before
switch (agentKey) {
  case 'technical':
    // ...
  case 'risk':
    // ...
}

// After
switch (agentKey) {
  case AGENT_KEYS.TECHNICAL:
    // ...
  case AGENT_KEYS.RISK:
    // ...
}
```

### Step 4: Update Object Keys

```typescript
// Before
const config = {
  technical: { /* ... */ },
  risk: { /* ... */ }
};

// After
const config = {
  [AGENT_KEYS.TECHNICAL]: { /* ... */ },
  [AGENT_KEYS.RISK]: { /* ... */ }
};
```

## TypeScript Benefits

### 1. Autocomplete

IDEs provide autocomplete for agent keys:

```typescript
import { AGENT_KEYS } from '../constants/agentKeys';

const key = AGENT_KEYS. // IDE shows all 15 options
```

### 2. Compile-Time Checking

Typos caught at compile time:

```typescript
// ❌ TypeScript error: Property 'TECHNIAL' does not exist
const key = AGENT_KEYS.TECHNIAL;

// ✅ Correct
const key = AGENT_KEYS.TECHNICAL;
```

### 3. Type Safety

Function parameters enforced:

```typescript
function processAgent(key: AgentKeyType) {
  // Only valid agent keys allowed
}

processAgent(AGENT_KEYS.TECHNICAL); // ✅ OK
processAgent('invalid_key');         // ❌ TypeScript error
```

### 4. Refactoring Support

Rename in one place, updates everywhere:

```typescript
// Change in constants/agentKeys.ts:
TECHNICAL = 'technical_analysis'  // Updated value

// All usages automatically updated via constants
```

## Testing

All components using agent keys have been tested:

```bash
npm test
```

No runtime errors should occur from the migration.

## Modified Files

1. **NEW**: `constants/agentKeys.ts` - All constants and utilities
2. **MODIFIED**: `components/ai/agentRegistry.ts` - Uses constants in registry
3. **MODIFIED**: `context/AgentDataContext.tsx` - Uses constants in switch statement

## Best Practices

### DO ✅

- **Use AGENT_KEYS for string literals**
  ```typescript
  const key = AGENT_KEYS.TECHNICAL;
  ```

- **Use AgentKeyType for type annotations**
  ```typescript
  function process(key: AgentKeyType) { }
  ```

- **Use isValidAgentKey() for validation**
  ```typescript
  if (isValidAgentKey(input)) { }
  ```

- **Use getAgentDisplayName() for UI**
  ```typescript
  const name = getAgentDisplayName(key);
  ```

### DON'T ❌

- **Don't use hard-coded strings**
  ```typescript
  // ❌ Bad
  if (key === 'technical') { }
  
  // ✅ Good
  if (key === AGENT_KEYS.TECHNICAL) { }
  ```

- **Don't duplicate agent key lists**
  ```typescript
  // ❌ Bad - duplicates constants
  const keys = ['technical', 'risk', ...];
  
  // ✅ Good - use provided array
  import { ALL_AGENT_KEYS } from '../constants/agentKeys';
  ```

- **Don't bypass type checking**
  ```typescript
  // ❌ Bad
  processAgent(userInput as AgentKeyType);
  
  // ✅ Good
  if (isValidAgentKey(userInput)) {
    processAgent(userInput);
  }
  ```

## Future Enhancements

Potential improvements:

- **FRONTEND-070**: Add agent category groupings (analysis, trading, risk)
- **FRONTEND-071**: Create agent capability constants
- **FRONTEND-072**: Add agent status constants
- **FRONTEND-073**: Implement agent permission constants
- **FRONTEND-074**: Create agent event type constants

## Related Documentation

- [Agent Registry (FRONTEND-003)](./AGENT_LAZY_LOADING.md)
- [Agent Data Context (FRONTEND-004)](./AGENT_DATA_CONTEXT.md)
- TypeScript Documentation: [Enums](https://www.typescriptlang.org/docs/handbook/enums.html)
- TypeScript Documentation: [Const Assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions)

## Summary

**Definition of Done**: ✅ All criteria met
- [x] Enum/const object for agent keys created
- [x] All hard-coded strings replaced in modified files
- [x] TypeScript autocomplete works
- [x] No runtime errors
- [x] Documentation provided

**Benefits**:
- **Type Safety**: Compile-time checking prevents typos
- **Autocomplete**: IDE support for all agent keys
- **Maintainability**: Single source of truth
- **Refactoring**: Easy to rename/update keys
- **Documentation**: Self-documenting code

**Status**: PRODUCTION-READY ✅
