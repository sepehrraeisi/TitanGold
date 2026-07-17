import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentControlShell, AgentTechnicalLtr } from '../../../../../components/ai/shell/AgentControlShell.tsx';

let currentLanguage: 'en' | 'fa' = 'en';

vi.mock('../../../../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({
    language: currentLanguage,
    setLanguage: (next: 'en' | 'fa') => {
      currentLanguage = next;
    },
    t: (key: string) => key,
  }),
}));

vi.mock('../../../../../hooks/useAgentExecutionGate.ts', () => ({
  useAgentExecutionGate: () => ({
    guardExecution: () => true,
    dryRunForced: true,
    killSwitchActive: true,
    effectiveMode: 'dry_run',
    liveBlockReason: 'KILL_SWITCH_ACTIVE',
    runtime: { providerConnected: false, killSwitchActive: true, workerAcknowledged: true },
  }),
}));

const baseAgent = {
  id: 'agent-1',
  name: 'Harness Agent',
  status: 'active',
  agent_key: 'liquidity',
  decisions: 1,
  role: 'Shared shell harness',
  lastUpdate: '2026-07-17T12:00:00.000Z',
} as any;

describe('AI-FOUNDATION-R1 AgentControlShell RTL / typography', () => {
  beforeEach(() => {
    currentLanguage = 'en';
    document.body.innerHTML = '';
  });

  it('English shell receives lang=en and dir=ltr without rtl class', () => {
    currentLanguage = 'en';
    const onClose = vi.fn();
    render(
      <AgentControlShell agent={baseAgent} onClose={onClose}>
        <div data-testid="harness-body">Body</div>
      </AgentControlShell>,
    );

    const shell = screen.getByTestId('agent-control-shell');
    const overlay = screen.getByTestId('agent-control-shell-overlay');
    expect(shell.getAttribute('lang')).toBe('en');
    expect(shell.getAttribute('dir')).toBe('ltr');
    expect(shell.getAttribute('data-shell-lang')).toBe('en');
    expect(shell.getAttribute('data-shell-dir')).toBe('ltr');
    expect(overlay.getAttribute('lang')).toBe('en');
    expect(overlay.getAttribute('dir')).toBe('ltr');
    expect(shell.className).not.toMatch(/\brtl\b/);
    expect(overlay.className).not.toMatch(/\brtl\b/);
    expect(shell.style.fontFamily || '').not.toMatch(/IRANSans/i);
  });

  it('Persian shell receives lang=fa, dir=rtl, rtl class and IRANSans token', () => {
    currentLanguage = 'fa';
    render(
      <AgentControlShell agent={baseAgent} onClose={() => {}}>
        <div data-testid="harness-body">بدنه</div>
      </AgentControlShell>,
    );

    const shell = screen.getByTestId('agent-control-shell');
    const overlay = screen.getByTestId('agent-control-shell-overlay');
    expect(shell.getAttribute('lang')).toBe('fa');
    expect(shell.getAttribute('dir')).toBe('rtl');
    expect(overlay.getAttribute('lang')).toBe('fa');
    expect(overlay.getAttribute('dir')).toBe('rtl');
    expect(shell.className).toMatch(/\brtl\b/);
    expect(overlay.className).toMatch(/\brtl\b/);
    expect(shell.style.fontFamily).toMatch(/IRANSans/);
    expect(overlay.style.fontFamily).toMatch(/IRANSans/);
    expect(screen.getByTestId('harness-body').closest('[data-testid="agent-control-shell"]')).toBeTruthy();
  });

  it('portal root is document.body and inherits presentation attributes from overlay', () => {
    currentLanguage = 'fa';
    render(
      <AgentControlShell agent={baseAgent} onClose={() => {}}>
        <span>portal</span>
      </AgentControlShell>,
    );
    const overlay = screen.getByTestId('agent-control-shell-overlay');
    expect(overlay.parentElement).toBe(document.body);
    expect(overlay.getAttribute('data-shell-dir')).toBe('rtl');
  });

  it('applies the same shared direction presentation for a non-Arbitrage agent key', () => {
    currentLanguage = 'fa';
    const riskAgent = { ...baseAgent, agent_key: 'risk', name: 'Risk Agent' };
    render(
      <AgentControlShell agent={riskAgent} onClose={() => {}}>
        <div data-testid="second-agent-body">Risk body</div>
      </AgentControlShell>,
    );
    const shell = screen.getByTestId('agent-control-shell');
    expect(shell.getAttribute('data-agent-key')).toBe('risk');
    expect(shell.getAttribute('dir')).toBe('rtl');
    expect(shell.getAttribute('lang')).toBe('fa');
    expect(shell.style.fontFamily).toMatch(/IRANSans/);
  });

  it('keeps technical timestamps in local LTR wrappers', () => {
    currentLanguage = 'fa';
    render(
      <AgentControlShell agent={baseAgent} onClose={() => {}}>
        <AgentTechnicalLtr data-testid="symbol-ltr">BTCUSDT</AgentTechnicalLtr>
      </AgentControlShell>,
    );
    const lastRun = screen.getByTestId('agent-shell-last-run');
    const tech = lastRun.querySelector('[data-testid="agent-technical-ltr"]');
    expect(tech).toBeTruthy();
    expect(tech?.getAttribute('dir')).toBe('ltr');
    expect(screen.getByTestId('symbol-ltr').getAttribute('dir')).toBe('ltr');
    expect(screen.getByTestId('symbol-ltr').textContent).toBe('BTCUSDT');
  });

  it('Close and Escape remain functional under Persian direction', async () => {
    currentLanguage = 'fa';
    const onClose = vi.fn();
    const opener = document.createElement('button');
    opener.textContent = 'opener';
    document.body.appendChild(opener);
    opener.focus();

    render(
      <AgentControlShell agent={baseAgent} onClose={onClose} closeTestId="agent-shell-close">
        <button type="button">inner</button>
      </AgentControlShell>,
    );

    expect(document.activeElement?.getAttribute('data-testid')).toBe('agent-shell-close');
    fireEvent.click(screen.getByTestId('agent-shell-close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    render(
      <AgentControlShell agent={baseAgent} onClose={onClose}>
        <div>again</div>
      </AgentControlShell>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('does not introduce a second language state API', () => {
    // Shell must consume LanguageContext only — no duplicate provider in this module surface.
    currentLanguage = 'fa';
    render(
      <AgentControlShell agent={baseAgent} onClose={() => {}}>
        <div />
      </AgentControlShell>,
    );
    expect(screen.getByTestId('agent-control-shell').getAttribute('data-shell-lang')).toBe('fa');
  });
});
