import './initZod.js'; // Must be first to ensure Zod is extended before schemas are created
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import * as schemas from '../schemas/index.js';

// extendZodWithOpenApi(z) is handled in initZod.js

export function generateOpenApiSchemas() {
    const registry = new OpenAPIRegistry();

    // Helper to register a schema if it hasn't been registered yet
    // We use a Set to track registered names to avoid duplicates/collisions
    const registeredSchemas = new Set();

    const register = (name, schema) => {
        if (!registeredSchemas.has(name) && schema) {
            try {
                registry.register(name, schema);
                registeredSchemas.add(name);
            } catch (error) {
                console.warn(`Failed to register schema ${name}:`, error.message);
            }
        }
    };

    // 1. Auth Schemas
    if (schemas.authSchemas) {
        register('RegisterRequest', schemas.authSchemas.registerSchema); // Assuming registerSchema exists or similar
        register('LoginRequest', schemas.authSchemas.loginSchema);
        // Add other auth schemas if available
    }

    // 2. User Schemas
    if (schemas.userSchemas) {
        register('UserProfile', schemas.userSchemas.userProfileSchema);
        register('UpdateUserRequest', schemas.userSchemas.updateUserSchema);
    }

    // 3. Agent Schemas
    if (schemas.agentSchemas) {
        register('Agent', schemas.agentSchemas.baseAgentResponseSchema);
        register('AgentDetail', schemas.agentSchemas.agentResponseSchema);
        register('CreateAgentRequest', schemas.agentSchemas.createAgentBodySchema);
        register('UpdateAgentRequest', schemas.agentSchemas.updateAgentBodySchema);
        register('AgentAnalysis', schemas.agentSchemas.agentAnalysisResponseSchema);
        register('AgentChatResponse', schemas.agentSchemas.agentChatResponseSchema);
    }

    // 4. Portfolio Schemas
    if (schemas.portfolioSchemas) {
        register('Portfolio', schemas.portfolioSchemas.portfolioSchema); // Check actual name in file
        register('CreatePortfolioRequest', schemas.portfolioSchemas.createPortfolioSchema);
    }

    // 5. Trade Schemas
    if (schemas.tradeSchemas) {
        register('Trade', schemas.tradeSchemas.tradeSchema); // Check actual name
        register('CreateTradeRequest', schemas.tradeSchemas.createTradeSchema);
    }

    // 6. Data Hub Schemas
    if (schemas.dataHubSchemas) {
        register('DataSource', schemas.dataHubSchemas.dataSourceResponseSchema);
        register('CreateDataSourceRequest', schemas.dataHubSchemas.createDataSourceSchema);
        register('DataCategory', schemas.dataHubSchemas.categoryResponseSchema);
        register('CollectedData', schemas.dataHubSchemas.collectedDataResponseSchema);
    }

    // 7. Artemis Schemas
    if (schemas.artemisSchemas) {
        register('ArtemisState', schemas.artemisSchemas.artemisStateResponseSchema);
        register('ArtemisHealth', schemas.artemisSchemas.artemisHealthResponseSchema);
        register('ArtemisDecision', schemas.artemisSchemas.artemisDecisionResponseSchema);
    }

    // 8. Autopilot Schemas
    if (schemas.autopilotSchemas) {
        const autopilot = schemas.autopilotSchemas.default || schemas.autopilotSchemas;
        register('AutopilotStatus', autopilot.autopilotStatusResponseSchema);
        register('AutopilotSuggestion', autopilot.autopilotSuggestionSchema);
    }

    // 9. Access Control Schemas
    if (schemas.accessControlSchemas) {
        register('AccessControlList', schemas.accessControlSchemas.accessControlListSchema);
        register('AccessControlRule', schemas.accessControlSchemas.accessControlRuleSchema);
    }

    // Generate the OpenAPI components
    const generator = new OpenApiGeneratorV3(registry.definitions);
    const components = generator.generateComponents();

    return components.schemas;
}

export default generateOpenApiSchemas;
