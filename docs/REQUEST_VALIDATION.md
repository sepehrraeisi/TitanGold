# Request Schema Validation Documentation

**Task**: API-002  
**Status**: Complete  
**Last Updated**: 2026-01-07

## Overview

This document describes the Zod-based request validation system implemented for the TitanGold API. All API endpoints now validate incoming requests against defined schemas, providing clear error messages for invalid data.

---

## Table of Contents

1. [Installation](#installation)
2. [Validation Middleware](#validation-middleware)
3. [Available Schemas](#available-schemas)
4. [Usage Examples](#usage-examples)
5. [Error Response Format](#error-response-format)
6. [Creating New Schemas](#creating-new-schemas)
7. [Testing](#testing)
8. [Best Practices](#best-practices)

---

## Installation

Zod is installed as a dependency:

```bash
npm install zod
```

---

## Validation Middleware

The validation middleware provides several functions for validating different parts of HTTP requests:

### Functions

#### `validateBody(schema)`
Validates request body against a Zod schema.

```javascript
import { validateBody } from '../middleware/validation.js';
import { createAgentBodySchema } from '../schemas/agentSchemas.js';

router.post('/agents', validateBody(createAgentBodySchema), async (req, res) => {
  // req.validatedBody contains validated data
  const { name, type, config } = req.validatedBody;
  // ...
});
```

#### `validateQuery(schema)`
Validates query parameters against a Zod schema.

```javascript
import { validateQuery } from '../middleware/validation.js';
import { listAgentsQuerySchema } from '../schemas/agentSchemas.js';

router.get('/agents', validateQuery(listAgentsQuerySchema), async (req, res) => {
  // req.validatedQuery contains validated data
  const { limit, offset, type } = req.validatedQuery;
  // ...
});
```

#### `validateParams(schema)`
Validates URL path parameters against a Zod schema.

```javascript
import { validateParams } from '../middleware/validation.js';
import { getAgentParamsSchema } from '../schemas/agentSchemas.js';

router.get('/agents/:id', validateParams(getAgentParamsSchema), async (req, res) => {
  // req.validatedParams contains validated data
  const { id } = req.validatedParams;
  // ...
});
```

#### `validate({ body, query, params })`
Validates multiple parts of the request simultaneously.

```javascript
import { validate } from '../middleware/validation.js';
import { updateAgentParamsSchema, updateAgentBodySchema } from '../schemas/agentSchemas.js';

router.put('/agents/:id', 
  validate({
    params: updateAgentParamsSchema,
    body: updateAgentBodySchema,
  }), 
  async (req, res) => {
    const { id } = req.validatedParams;
    const updates = req.validatedBody;
    // ...
  }
);
```

---

## Available Schemas

### Agent Schemas (`schemas/agentSchemas.js`)

#### CRUD Operations
- `listAgentsQuerySchema` - List/filter agents
- `getAgentParamsSchema` - Get single agent by ID
- `createAgentBodySchema` - Create new agent
- `updateAgentParamsSchema` - Update agent (params)
- `updateAgentBodySchema` - Update agent (body)
- `deleteAgentParamsSchema` - Delete agent

#### Analysis Operations
- `analyzeParamsSchema` - Agent analysis params
- `analyzeBodySchema` - Agent analysis body
- `chatParamsSchema` - Agent chat params
- `chatBodySchema` - Agent chat message

#### Specific Analysis Types
- `technicalAnalysisConfigSchema` - Technical indicators
- `sentimentAnalysisConfigSchema` - Sentiment analysis
- `patternRecognitionConfigSchema` - Chart patterns
- `pricePredictionConfigSchema` - Price forecasting
- `arbitrageConfigSchema` - Arbitrage opportunities
- `portfolioAllocationConfigSchema` - Portfolio optimization
- `liquidityAnalysisConfigSchema` - Liquidity assessment
- `riskAssessmentConfigSchema` - Risk evaluation

#### Training & Performance
- `trainAgentParamsSchema` - Training params
- `trainAgentBodySchema` - Training data
- `agentPerformanceQuerySchema` - Performance metrics

#### Batch Operations
- `batchAnalyzeBodySchema` - Batch analysis requests

### Auth Schemas (`schemas/authSchemas.js`)

- `registerBodySchema` - User registration
- `loginBodySchema` - User login
- `refreshTokenBodySchema` - Token refresh
- `forgotPasswordBodySchema` - Password reset request
- `resetPasswordBodySchema` - Password reset
- `changePasswordBodySchema` - Password change

### User Schemas (`schemas/userSchemas.js`)

- `listUsersQuerySchema` - List users (admin)
- `getUserParamsSchema` - Get user by ID
- `updateUserParamsSchema` - Update user params
- `updateUserBodySchema` - Update user data
- `deleteUserParamsSchema` - Delete user

### Portfolio Schemas (`schemas/portfolioSchemas.js`)

- `listPortfoliosQuerySchema` - List portfolios
- `createPortfolioBodySchema` - Create portfolio
- `getPortfolioParamsSchema` - Get portfolio
- `updatePortfolioParamsSchema` - Update portfolio params
- `updatePortfolioBodySchema` - Update portfolio data
- `deletePortfolioParamsSchema` - Delete portfolio
- `addPositionParamsSchema` - Add position params
- `addPositionBodySchema` - Add position data
- `getPortfolioPerformanceParamsSchema` - Performance params
- `getPortfolioPerformanceQuerySchema` - Performance query
- `getPortfolioSummaryParamsSchema` - Summary params

### Trade Schemas (`schemas/tradeSchemas.js`)

- `listTradesQuerySchema` - List/filter trades
- `createTradeBodySchema` - Create trade
- `getTradeParamsSchema` - Get trade
- `updateTradeParamsSchema` - Update trade params
- `updateTradeBodySchema` - Update trade data
- `cancelTradeParamsSchema` - Cancel trade
- `executeTradeParamsSchema` - Execute trade params
- `executeTradeBodySchema` - Execute trade data
- `getTradeHistoryQuerySchema` - Trade history

---

## Usage Examples

### Example 1: Basic Route with Body Validation

```javascript
import express from 'express';
import { validateBody } from '../middleware/validation.js';
import { createAgentBodySchema } from '../schemas/agentSchemas.js';

const router = express.Router();

router.post('/agents', validateBody(createAgentBodySchema), async (req, res) => {
  try {
    // Access validated data
    const { name, type, config, is_enabled } = req.validatedBody;
    
    // Perform business logic
    const agent = await createAgent({ name, type, config, is_enabled });
    
    res.status(201).json({ ok: true, agent });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
```

### Example 2: Route with Query Parameter Validation

```javascript
router.get('/agents', validateQuery(listAgentsQuerySchema), async (req, res) => {
  // Query params are already validated and coerced to correct types
  const { type, status, limit, offset, sortBy, sortOrder } = req.validatedQuery;
  
  const agents = await getAgents({
    type,
    status,
    limit,  // Already converted to number
    offset, // Already converted to number
    sortBy,
    sortOrder,
  });
  
  res.json({ ok: true, agents });
});
```

### Example 3: Route with Multiple Validations

```javascript
router.put('/agents/:id', 
  validate({
    params: updateAgentParamsSchema,
    body: updateAgentBodySchema,
  }),
  async (req, res) => {
    const { id } = req.validatedParams;
    const updates = req.validatedBody;
    
    const agent = await updateAgent(id, updates);
    res.json({ ok: true, agent });
  }
);
```

### Example 4: Complex Nested Validation

```javascript
router.post('/agents/:id/analyze', 
  validate({
    params: analyzeParamsSchema,
    body: analyzeBodySchema,
  }),
  async (req, res) => {
    const { id } = req.validatedParams;
    const { symbol, timeframe, exchange, config } = req.validatedBody;
    
    const analysis = await performAnalysis(id, {
      symbol,
      timeframe, // Defaults to '1h' if not provided
      exchange,  // Defaults to 'binance' if not provided
      config,
    });
    
    res.json({ ok: true, analysis });
  }
);
```

---

## Error Response Format

When validation fails, the API returns a 400 status code with a structured error response:

### Example Error Response

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address",
        "code": "invalid_string",
        "expected": null,
        "received": null
      },
      {
        "field": "password",
        "message": "String must contain at least 6 character(s)",
        "code": "too_small",
        "expected": null,
        "received": null
      }
    ]
  }
}
```

### Error Fields

- **ok**: Always `false` for errors
- **error.code**: Error type identifier (e.g., `VALIDATION_ERROR`)
- **error.message**: Human-readable summary
- **error.details**: Array of specific validation errors
  - **field**: Path to the invalid field (e.g., `user.profile.age`)
  - **message**: Clear description of what's wrong
  - **code**: Zod error code (e.g., `invalid_type`, `too_small`, `invalid_string`)
  - **expected**: Expected value/type (when applicable)
  - **received**: Received value/type (when applicable)

### Multiple Location Errors

When using the `validate()` function with multiple schemas, errors include the location:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "id",
        "location": "params",
        "message": "Invalid UUID format",
        "code": "invalid_string"
      },
      {
        "field": "email",
        "location": "body",
        "message": "Invalid email address",
        "code": "invalid_string"
      },
      {
        "field": "limit",
        "location": "query",
        "message": "Number must be less than or equal to 100",
        "code": "too_big"
      }
    ]
  }
}
```

---

## Creating New Schemas

### Step 1: Define the Schema

Create a new file in `schemas/` or add to an existing schema file:

```javascript
import { z } from 'zod';

// Define reusable sub-schemas
const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  country: z.string().length(2), // ISO country code
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/),
});

// Define main schema
export const createUserProfileBodySchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  age: z.number().int().positive().max(150),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  address: addressSchema,
  preferences: z.object({
    newsletter: z.boolean().optional().default(false),
    notifications: z.boolean().optional().default(true),
  }).optional(),
});
```

### Step 2: Add Custom Validation Rules

```javascript
export const passwordResetSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
  confirmPassword: z.string(),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  }
).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: "New password must be different from current password",
    path: ['newPassword'],
  }
);
```

### Step 3: Use in Routes

```javascript
import { validateBody } from '../middleware/validation.js';
import { createUserProfileBodySchema } from '../schemas/userSchemas.js';

router.post('/profile', validateBody(createUserProfileBodySchema), async (req, res) => {
  const profile = req.validatedBody;
  // profile is fully validated and typed
  // ...
});
```

---

## Testing

### Running Schema Tests

```bash
# Run all schema tests
npm test __tests__/schemas

# Run specific test file
npm test __tests__/schemas/validation.test.js

# Run with coverage
npm run test:coverage -- __tests__/schemas
```

### Writing Schema Tests

```javascript
import { describe, it, expect } from '@jest/globals';
import { myNewSchema } from '../schemas/mySchemas.js';

describe('My New Schema', () => {
  it('should accept valid data', () => {
    const validData = {
      field1: 'value',
      field2: 123,
    };
    const result = myNewSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid data', () => {
    const invalidData = {
      field1: '', // empty string
      field2: -1, // negative number
    };
    const result = myNewSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error.errors).toHaveLength(2);
  });

  it('should provide clear error messages', () => {
    const result = myNewSchema.safeParse({ field1: 'ok' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMessage = result.error.errors[0].message;
      expect(errorMessage).toContain('required');
    }
  });
});
```

---

## Best Practices

### 1. Always Validate User Input

Every endpoint that accepts user input should validate it:

```javascript
// ✅ Good
router.post('/endpoint', validateBody(mySchema), handler);

// ❌ Bad
router.post('/endpoint', handler); // No validation
```

### 2. Use Specific Error Messages

Provide clear, actionable error messages:

```javascript
// ✅ Good
z.string().min(8, { message: 'Password must be at least 8 characters' })

// ❌ Bad
z.string().min(8) // Generic "String must contain at least 8 character(s)"
```

### 3. Leverage Schema Transformations

Use Zod's transform capabilities for data normalization:

```javascript
export const emailSchema = z.string()
  .email()
  .toLowerCase() // Automatically normalize to lowercase
  .trim();       // Remove whitespace
```

### 4. Define Reusable Sub-Schemas

Extract common validation patterns:

```javascript
// Reusable schemas
const uuidSchema = z.string().uuid();
const symbolSchema = z.string().regex(/^[A-Z0-9]{3,20}$/);

// Use in multiple places
export const tradeSchema = z.object({
  id: uuidSchema,
  symbol: symbolSchema,
  // ...
});

export const portfolioSchema = z.object({
  id: uuidSchema,
  // ...
});
```

### 5. Use Enums for Fixed Sets

Define enums for fields with fixed values:

```javascript
export const agentTypeSchema = z.enum([
  'technical',
  'sentiment',
  'pattern',
  'price_prediction',
]);
```

### 6. Add Default Values

Provide sensible defaults where appropriate:

```javascript
export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});
```

### 7. Validate Related Fields Together

Use `.refine()` for cross-field validation:

```javascript
export const tradeSchema = z.object({
  orderType: z.enum(['market', 'limit', 'stop_loss']),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
}).refine(
  (data) => {
    if (data.orderType === 'limit' && !data.limitPrice) return false;
    if (data.orderType === 'stop_loss' && !data.stopPrice) return false;
    return true;
  },
  { message: 'Required price field missing for order type' }
);
```

### 8. Document Complex Schemas

Add comments explaining non-obvious validation rules:

```javascript
export const tradingConfigSchema = z.object({
  // Maximum position size as percentage of portfolio (0-100)
  maxPositionSizePercent: z.number().min(0).max(100),
  
  // Stop loss trigger (negative percentage, e.g., -5 for 5% loss)
  stopLossPercent: z.number().negative().min(-50),
  
  // Take profit target (positive percentage, e.g., 10 for 10% gain)
  takeProfitPercent: z.number().positive().max(500),
});
```

### 9. Test Edge Cases

Always test boundary conditions:

```javascript
it('should accept exactly 100 items (max boundary)', () => {
  const data = { items: Array(100).fill('item') };
  expect(schema.safeParse(data).success).toBe(true);
});

it('should reject 101 items (over max)', () => {
  const data = { items: Array(101).fill('item') };
  expect(schema.safeParse(data).success).toBe(false);
});
```

### 10. Keep Schemas DRY

Export and reuse common patterns:

```javascript
// Common patterns
export const patterns = {
  uuid: z.string().uuid(),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  url: z.string().url(),
  iso8601: z.string().datetime(),
  pagination: z.object({
    limit: z.coerce.number().int().positive().max(100).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
  }),
};

// Use in multiple schemas
export const userSchema = z.object({
  id: patterns.uuid,
  email: patterns.email,
  phone: patterns.phone.optional(),
});

export const listSchema = z.object({
  ...patterns.pagination.shape,
  filter: z.string().optional(),
});
```

---

## Common Zod Validation Patterns

### String Validations

```javascript
z.string()                    // Basic string
  .min(3)                     // Min length
  .max(100)                   // Max length
  .email()                    // Email format
  .url()                      // URL format
  .uuid()                     // UUID format
  .regex(/pattern/)           // Custom regex
  .trim()                     // Remove whitespace
  .toLowerCase()              // Convert to lowercase
  .optional()                 // Make optional
  .default('value')           // Default value
  .nullable()                 // Allow null
```

### Number Validations

```javascript
z.number()                    // Basic number
  .int()                      // Integer only
  .positive()                 // > 0
  .negative()                 // < 0
  .nonnegative()              // >= 0
  .min(0)                     // Minimum value
  .max(100)                   // Maximum value
  .finite()                   // No Infinity
```

### Array Validations

```javascript
z.array(z.string())           // Array of strings
  .min(1)                     // Min length
  .max(10)                    // Max length
  .nonempty()                 // At least one element
```

### Object Validations

```javascript
z.object({                    // Object shape
  field: z.string(),
})
  .strict()                   // No extra fields
  .partial()                  // All fields optional
  .required()                 // All fields required
  .pick({ field: true })      // Select specific fields
  .omit({ field: true })      // Exclude specific fields
```

### Enum Validations

```javascript
z.enum(['value1', 'value2'])  // Fixed set of values
z.nativeEnum(MyEnum)          // TypeScript enum
```

### Date Validations

```javascript
z.date()                      // Date object
z.string().datetime()         // ISO 8601 string
```

---

## Troubleshooting

### Issue: Validation passes but data is wrong type

**Solution**: Use `z.coerce` for query params that come as strings:

```javascript
// ❌ Wrong - query params are strings
z.object({
  limit: z.number(), // This will fail!
})

// ✅ Correct - coerce string to number
z.object({
  limit: z.coerce.number(),
})
```

### Issue: Optional field always has value

**Solution**: Use `.optional()` instead of `.nullable()`:

```javascript
// ❌ Wrong - allows null but requires field
z.string().nullable()

// ✅ Correct - field can be omitted
z.string().optional()

// ✅ Also correct - field can be omitted or null
z.string().optional().nullable()
```

### Issue: Validation error messages are unclear

**Solution**: Add custom error messages:

```javascript
z.string().min(8, { message: 'Password must be at least 8 characters' })
```

### Issue: Need to validate one field based on another

**Solution**: Use `.refine()`:

```javascript
z.object({
  password: z.string(),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})
```

---

## Additional Resources

- [Zod Official Documentation](https://zod.dev/)
- [Zod GitHub Repository](https://github.com/colinhacks/zod)
- [Express Middleware Patterns](https://expressjs.com/en/guide/using-middleware.html)

---

**Last Updated**: 2026-01-07  
**Task**: API-002  
**Maintainer**: TitanGold Backend Team
