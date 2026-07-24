import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AIAgents from '../../../../components/ai/AIAgents.tsx';

vi.mock('../../../../context/LanguageContext.tsx', () => ({
    useLanguage: () => ({ t: (k: string) => k, language: 'en' }),
}));

vi.mock('../../../../hooks/useExecutionRuntime.ts', () => ({
    useExecutionRuntime: () => ({ runtime: { killSwitchActive: true, globalMode: 'demo' }, loading: false }),
}));

vi.mock('../../../../hooks/useCapabilities.ts', () => ({
    useCapabilities: () => ({ has: () => true }),
}));

vi.mock('../../../../hooks/useWebSocket.ts', () => ({
    useWebSocket: () => ({ isConnected: false, realtimeUnavailable: false, send: vi.fn(), connect: vi.fn() }),
}));

vi.mock('../../../../hooks/useDebounce', () => ({
    useDebounce: (v: string) => v,
}));

vi.mock('../../../../services/api.ts', () => ({
    fetchAIAgents: vi.fn().mockResolvedValue([
        {
            id: '04b6ca95-5fd3-471d-a568-bd7f1c391d83',
            name: 'Arbitrage Agent',
            status: 'active',
            agent_key: 'arbitrage',
            role: 'Spread monitor',
            capabilities: [],
        },
    ]),
}));

vi.mock('../../../../components/ai/ArbitrageAgentPopup.tsx', () => ({
    default: ({ agent }: { agent: { name: string } }) => (
        <div data-testid="arb-agent-popup" role="dialog" aria-modal="true">
            popup:{agent.name}
        </div>
    ),
}));

describe('AIAgents arbitrage popup routing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('opens popup overlay without replacing agents page when agentId is in URL', async () => {
        render(
            <AIAgents
                initialAgentId="04b6ca95-5fd3-471d-a568-bd7f1c391d83"
                initialAgentSection="overview"
            />,
        );
        expect(await screen.findByTestId('agents-grid')).toBeInTheDocument();
        expect(await screen.findByTestId('arb-agent-popup')).toBeInTheDocument();
    });
});
