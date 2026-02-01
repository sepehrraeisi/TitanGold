# TitanGold GraphQL API Documentation

**Task**: API-007 - Implement GraphQL API  
**Date**: 2026-01-31  
**Status**: Production Ready  

## Overview

The TitanGold GraphQL API provides a modern, flexible alternative to the REST API for interacting with AI agents and their operations. Built with Apollo Server, it offers real-time capabilities, efficient data fetching, and comprehensive introspection.

### Benefits

- **Flexible Queries**: Request exactly the data you need
- **Single Endpoint**: All operations through `/graphql`
- **Type-Safe**: Strong typing with GraphQL schema
- **Real-time**: Subscription support for live updates
- **Introspection**: Self-documenting API
- **Efficient**: Reduce over-fetching and under-fetching
- **Batching**: Multiple operations in one request

## Getting Started

### Endpoint

```
POST /graphql
```

**Development Playground**:
```
http://localhost:5001/graphql
```

The GraphQL Playground is available in development mode for interactive query testing and exploration.

### Authentication

Include authentication token in headers:

```http
POST /graphql
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN
```

The user context is automatically passed to resolvers from the authentication middleware.

## Core Concepts

### Queries

Queries fetch data (read operations):

```graphql
query GetAgents {
  agents {
    id
    name
    status
    accuracy
  }
}
```

### Mutations

Mutations modify data (write operations):

```graphql
mutation RunAgent {
  runAgent(
    agent_key: "technical"
    input: {
      symbol: "BTCUSDT"
      timeframe: "1h"
    }
  ) {
    signal
    confidence
    indicators {
      name
      value
    }
  }
}
```

### Subscriptions

Subscriptions enable real-time updates:

```graphql
subscription WatchDecisions {
  agentDecisionCreated(agent_id: "agent-123") {
    id
    confidence
    output_data
  }
}
```

## Schema Overview

### Types

#### Agent
```graphql
type Agent {
  id: ID!
  agent_key: String!
  name: String!
  role: String!
  status: AgentStatus!
  accuracy: Float!
  trainingProgress: Float!
  decisions: Int!
  learningTime: Int!
  knowledgeSize: Float!
  lastUpdate: String!
  capabilities: [String!]!
  config: JSON
  health: AgentHealth
  version: String
}
```

#### AgentRunResult
```graphql
type AgentRunResult {
  agent_key: String!
  symbol: String
  timeframe: String
  signal: String
  confidence: Float!
  timestamp: String!
  indicators: [Indicator!]!
  summary: JSON
  opportunities: [JSON!]
  riskAlerts: [JSON!]
  _meta: AgentMeta
}
```

#### AgentDecision
```graphql
type AgentDecision {
  id: ID!
  agent_id: ID!
  user_id: ID
  decision_type: String!
  input_data: JSON!
  output_data: JSON!
  confidence: Float
  was_successful: Boolean!
  execution_time_ms: Int!
  created_at: String!
  metadata: JSON
}
```

## Query Examples

### Get All Agents

```graphql
query GetAllAgents {
  agents {
    id
    agent_key
    name
    role
    status
    accuracy
    trainingProgress
    capabilities
    lastUpdate
  }
}
```

### Get Single Agent

```graphql
query GetAgent($id: ID!) {
  agent(id: $id) {
    id
    name
    role
    status
    config
    health {
      status
      checks {
        name
        status
        message
      }
    }
  }
}
```

**Variables**:
```json
{
  "id": "1"
}
```

### Get Agent by Key

```graphql
query GetAgentByKey($agentKey: String!) {
  agentByKey(agent_key: $agentKey) {
    id
    name
    config
    version
  }
}
```

**Variables**:
```json
{
  "agentKey": "technical"
}
```

### Get Agent Details

```graphql
query GetAgentDetails($agentKey: String!) {
  agentDetails(agent_key: $agentKey)
}
```

Returns agent-specific details as JSON.

### Get Agent Default Config

```graphql
query GetDefaultConfig($agentKey: String!) {
  agentDefaultConfig(agent_key: $agentKey)
}
```

### Check Agent Health

```graphql
query CheckAgentHealth($agentKey: String!) {
  agentHealth(agent_key: $agentKey) {
    status
    checks {
      name
      status
      message
    }
    metadata
    timestamp
  }
}
```

### Get Agent Decisions

```graphql
query GetDecisions(
  $agentId: ID
  $userId: ID
  $pagination: PaginationInput
) {
  agentDecisions(
    agent_id: $agentId
    user_id: $userId
    pagination: $pagination
  ) {
    decisions {
      id
      decision_type
      confidence
      was_successful
      execution_time_ms
      created_at
    }
    total
    page
    limit
    hasMore
  }
}
```

**Variables**:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

### Get Decisions by Version (BACKEND-017)

```graphql
query GetDecisionsByVersion(
  $agentKey: String!
  $version: String!
  $pagination: PaginationInput
) {
  agentDecisionsByVersion(
    agent_key: $agentKey
    version: $version
    pagination: $pagination
  ) {
    decisions {
      id
      confidence
      was_successful
      created_at
    }
    total
    hasMore
  }
}
```

### Get All Agent Versions

```graphql
query GetAgentVersions {
  agentVersions
}
```

### Check All Agents Health

```graphql
query CheckAllHealth {
  agentsHealth {
    status
    checks {
      name
      status
    }
    timestamp
  }
}
```

## Mutation Examples

### Run Agent Analysis

```graphql
mutation RunTechnicalAnalysis($input: AgentRunInput!) {
  runAgent(agent_key: "technical", input: $input) {
    agent_key
    symbol
    timeframe
    signal
    confidence
    timestamp
    indicators {
      name
      value
      signal
    }
    _meta {
      source
      version
      executionTime
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "config": {
      "enabled": true,
      "confidence_threshold": 0.6
    }
  }
}
```

### Run Arbitrage Agent

```graphql
mutation RunArbitrage($input: AgentRunInput!) {
  runAgent(agent_key: "arbitrage", input: $input) {
    agent_key
    confidence
    summary
    opportunities
    riskAlerts
  }
}
```

### Execute Agent Command

```graphql
mutation ExecuteCommand($input: AgentCommandInput!) {
  executeAgentCommand(input: $input)
}
```

**Variables**:
```json
{
  "input": {
    "agent_key": "technical",
    "command": "reset",
    "params": {}
  }
}
```

### Update Agent

```graphql
mutation UpdateAgent($id: ID!, $input: AgentUpdateInput!) {
  updateAgent(id: $id, input: $input) {
    id
    name
    status
    config
  }
}
```

**Variables**:
```json
{
  "id": "1",
  "input": {
    "status": "active",
    "config": {
      "enabled": true
    }
  }
}
```

### Update Agent Config

```graphql
mutation UpdateConfig($id: ID!, $config: JSON!) {
  updateAgentConfig(id: $id, config: $config) {
    id
    config
  }
}
```

### Toggle Agent Status

```graphql
mutation ToggleStatus($id: ID!) {
  toggleAgentStatus(id: $id) {
    id
    status
  }
}
```

### Reset Agent

```graphql
mutation ResetAgent($agentKey: String!) {
  resetAgent(agent_key: $agentKey) {
    ok
    message
  }
}
```

### Train Agent

```graphql
mutation TrainAgent($agentKey: String!, $message: String!) {
  trainAgent(agent_key: $agentKey, message: $message)
}
```

### Validate Agent Config

```graphql
mutation ValidateConfig($agentKey: String!, $config: JSON!) {
  validateAgentConfig(agent_key: $agentKey, config: $config)
}
```

## Subscription Examples

### Subscribe to Agent Decisions

```graphql
subscription WatchDecisions($agentId: ID!) {
  agentDecisionCreated(agent_id: $agentId) {
    id
    agent_id
    decision_type
    confidence
    was_successful
    created_at
    output_data
  }
}
```

### Subscribe to Health Changes

```graphql
subscription WatchHealth($agentKey: String!) {
  agentHealthChanged(agent_key: $agentKey) {
    status
    checks {
      name
      status
    }
    timestamp
  }
}
```

## Advanced Examples

### Batch Multiple Queries

```graphql
query BatchQueries {
  technical: agentByKey(agent_key: "technical") {
    id
    name
    accuracy
  }
  
  risk: agentByKey(agent_key: "risk") {
    id
    name
    accuracy
  }
  
  allAgents: agents {
    agent_key
    status
  }
}
```

### Query with Fragments

```graphql
fragment AgentDetails on Agent {
  id
  agent_key
  name
  status
  accuracy
  lastUpdate
}

query GetAgentsWithFragments {
  agents {
    ...AgentDetails
    capabilities
  }
  
  technical: agentByKey(agent_key: "technical") {
    ...AgentDetails
    config
  }
}
```

### Nested Queries

```graphql
query GetAgentWithHealth($agentKey: String!) {
  agentByKey(agent_key: $agentKey) {
    id
    name
    status
    health {
      status
      checks {
        name
        status
        message
      }
      metadata
    }
  }
}
```

### Complex Mutation with Multiple Operations

```graphql
mutation ComplexAgentOperation {
  # Run analysis
  analysis: runAgent(
    agent_key: "technical"
    input: { symbol: "BTCUSDT", timeframe: "1h" }
  ) {
    signal
    confidence
  }
  
  # Update config
  updateConfig: updateAgentConfig(
    id: "1"
    config: { enabled: true, threshold: 0.7 }
  ) {
    id
    config
  }
  
  # Check health
  checkHealth: resetAgent(agent_key: "technical") {
    ok
    message
  }
}
```

## Error Handling

GraphQL errors follow this format:

```json
{
  "errors": [
    {
      "message": "Agent not found",
      "code": "AGENT_NOT_FOUND",
      "path": ["agentByKey"],
      "extensions": {
        "agent_key": "invalid_agent",
        "timestamp": "2026-01-31T12:00:00.000Z"
      }
    }
  ],
  "data": null
}
```

### Common Error Codes

- `AGENT_NOT_FOUND` - Agent does not exist
- `AGENT_EXECUTION_ERROR` - Agent run failed
- `DATABASE_ERROR` - Database operation failed
- `VALIDATION_ERROR` - Input validation failed
- `HEALTH_CHECK_ERROR` - Health check failed
- `COMMAND_ERROR` - Command execution failed
- `NOT_FOUND` - Resource not found
- `INTERNAL_SERVER_ERROR` - Unexpected error

## Best Practices

### 1. Request Only What You Need

```graphql
# ✅ Good - Minimal fields
query GetAgentNames {
  agents {
    id
    name
  }
}

# ❌ Bad - Unnecessary fields
query GetAgents {
  agents {
    id
    name
    role
    status
    accuracy
    trainingProgress
    decisions
    learningTime
    knowledgeSize
    lastUpdate
    capabilities
    config
  }
}
```

### 2. Use Variables for Dynamic Values

```graphql
# ✅ Good - Uses variables
query GetAgent($id: ID!) {
  agent(id: $id) {
    name
  }
}

# ❌ Bad - Hardcoded values
query GetAgent {
  agent(id: "1") {
    name
  }
}
```

### 3. Use Fragments for Reusability

```graphql
fragment AgentSummary on Agent {
  id
  name
  status
  accuracy
}

query GetAgents {
  activeAgents: agents {
    ...AgentSummary
  }
}
```

### 4. Handle Errors Gracefully

```javascript
const { data, errors } = await client.query({
  query: GET_AGENT_QUERY
});

if (errors) {
  console.error('GraphQL errors:', errors);
  // Handle errors
}

if (data) {
  // Use data
}
```

### 5. Use Pagination for Large Lists

```graphql
query GetPaginatedDecisions {
  agentDecisions(pagination: { page: 1, limit: 20 }) {
    decisions {
      id
      created_at
    }
    total
    hasMore
  }
}
```

## Client Integration

### JavaScript/TypeScript

```typescript
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:5001/graphql',
  cache: new InMemoryCache(),
  headers: {
    authorization: `Bearer ${token}`
  }
});

// Query
const { data } = await client.query({
  query: gql`
    query GetAgents {
      agents {
        id
        name
        status
      }
    }
  `
});

// Mutation
const { data: result } = await client.mutate({
  mutation: gql`
    mutation RunAgent($input: AgentRunInput!) {
      runAgent(agent_key: "technical", input: $input) {
        signal
        confidence
      }
    }
  `,
  variables: {
    input: {
      symbol: 'BTCUSDT',
      timeframe: '1h'
    }
  }
});
```

### cURL

```bash
# Query
curl -X POST http://localhost:5001/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "query { agents { id name status } }"
  }'

# Mutation with variables
curl -X POST http://localhost:5001/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "mutation RunAgent($input: AgentRunInput!) { runAgent(agent_key: \"technical\", input: $input) { signal confidence } }",
    "variables": {
      "input": {
        "symbol": "BTCUSDT",
        "timeframe": "1h"
      }
    }
  }'
```

### Python

```python
import requests

url = 'http://localhost:5001/graphql'
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {token}'
}

query = """
query GetAgents {
  agents {
    id
    name
    status
  }
}
"""

response = requests.post(url, json={'query': query}, headers=headers)
data = response.json()
```

## Performance Tips

1. **Use DataLoader** for batching and caching (future enhancement)
2. **Limit query depth** to prevent expensive nested queries
3. **Cache responses** on the client side
4. **Use pagination** for large result sets
5. **Request minimal fields** to reduce payload size

## Troubleshooting

### GraphQL Endpoint Not Available

**Issue**: `/graphql` returns 404

**Solutions**:
1. Check server logs for initialization errors
2. Verify schema file exists at `backend/graphql/schema.graphql`
3. Ensure Apollo Server started successfully
4. Check for port conflicts

### Playground Not Loading

**Issue**: GraphQL Playground shows blank page

**Solutions**:
1. Verify `NODE_ENV !== 'production'`
2. Check browser console for errors
3. Clear browser cache
4. Try accessing `/graphql` directly

### Authentication Errors

**Issue**: "Not authenticated" errors

**Solutions**:
1. Include valid JWT token in Authorization header
2. Check token expiration
3. Verify authentication middleware is working

### Slow Queries

**Issue**: Queries take too long

**Solutions**:
1. Reduce requested fields
2. Use pagination
3. Check database indexes
4. Enable query caching

## Comparison: GraphQL vs REST

| Feature | GraphQL | REST |
|---------|---------|------|
| Endpoint | Single `/graphql` | Multiple `/api/v1/*` |
| Data Fetching | Exact fields requested | Fixed response structure |
| Over-fetching | Eliminated | Common issue |
| Under-fetching | Eliminated | Requires multiple requests |
| Versioning | Schema evolution | URL versioning |
| Documentation | Self-documenting | OpenAPI/Swagger |
| Real-time | Built-in subscriptions | WebSocket integration |
| Caching | Client-side | HTTP caching |

## Future Enhancements

- **DataLoader**: Batch and cache database queries
- **Persisted Queries**: Reduce payload size
- **Query Complexity Analysis**: Prevent expensive queries
- **Custom Directives**: @auth, @rateLimit, @cache
- **Federation**: Microservices integration
- **Real-time Subscriptions**: Full WebSocket support
- **Monitoring**: Query performance tracking

## Support

For questions or issues:

1. Check GraphQL Playground for schema documentation
2. Review query examples in this guide
3. Examine error messages and codes
4. Create an issue with:
   - Query/mutation used
   - Variables
   - Error response
   - Expected behavior

---

**Last Updated**: 2026-01-31  
**Version**: 1.0.0  
**Task**: API-007  
**Status**: ✅ Production Ready
