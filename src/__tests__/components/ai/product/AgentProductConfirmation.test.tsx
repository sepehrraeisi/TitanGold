import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AgentProductDialog } from '../../../../../components/ai/product/AgentProductDialog.tsx';
import { AgentProductConfirmation } from '../../../../../components/ai/product/AgentProductConfirmation.tsx';
import {
  AGENT_PRODUCT_LAYER_Z,
  AGENT_PRODUCT_LAYERS,
} from '../../../../../components/ai/product/agentProductTokens.ts';

vi.mock('../../../../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'en' }),
}));

const agent = {
  id: 'agent-1',
  name: 'Arbitrage Agent',
  status: 'active',
  agent_key: 'arbitrage',
} as any;

describe('AgentProductConfirmation layering', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('renders confirmation above agent dialog content within the dialog shell', () => {
    render(
      <AgentProductDialog
        agent={agent}
        onClose={() => {}}
        confirmationOpen
        confirmation={
          <AgentProductConfirmation
            title="Run analytical scan?"
            description="Read-only scan"
            onCancel={() => {}}
            onConfirm={() => {}}
            cancelLabel="Cancel"
            confirmLabel="Run scan"
          />
        }
      >
        <div data-testid="popup-body">Overview body</div>
      </AgentProductDialog>,
    );

    const dialog = screen.getByTestId('agent-product-dialog');
    const layer = screen.getByTestId('agent-product-confirmation-layer');
    const panel = screen.getByTestId('agent-product-confirmation-panel');
    const main = screen.getByTestId('agent-product-main-surface');

    expect(dialog.contains(layer)).toBe(true);
    expect(dialog.contains(main)).toBe(true);
    expect(Number(layer.getAttribute('data-layer-z'))).toBeGreaterThan(
      AGENT_PRODUCT_LAYER_Z.dialogContent,
    );
    expect(Number(panel.getAttribute('data-layer-z'))).toBeGreaterThan(
      Number(layer.getAttribute('data-layer-z')),
    );
    expect(main.getAttribute('aria-hidden')).toBe('true');
    expect(main.className).toContain('pointer-events-none');
  });

  it('uses canonical layer token ordering', () => {
    expect(AGENT_PRODUCT_LAYERS.dialogOverlay).toContain(String(AGENT_PRODUCT_LAYER_Z.dialogOverlay));
    expect(AGENT_PRODUCT_LAYERS.confirmationRoot).toContain(
      String(AGENT_PRODUCT_LAYER_Z.confirmationBackdrop),
    );
    expect(AGENT_PRODUCT_LAYER_Z.confirmationPanel).toBeGreaterThan(
      AGENT_PRODUCT_LAYER_Z.confirmationBackdrop,
    );
  });

  it('focuses Cancel by default and Escape closes only confirmation', async () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    render(
      <AgentProductDialog
        agent={agent}
        onClose={onClose}
        confirmationOpen
        confirmation={
          <AgentProductConfirmation
            title="Confirm"
            onCancel={onCancel}
            onConfirm={() => {}}
            cancelLabel="Cancel"
            confirmLabel="Run scan"
            returnFocusTestId="trigger-action"
          />
        }
      >
        <button type="button" data-testid="trigger-action">
          Run analytical scan
        </button>
      </AgentProductDialog>,
    );

    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-testid')).toBe(
        'agent-product-confirm-cancel',
      ),
    );

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes confirmation layer after cancel without orphan overlay state', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <AgentProductDialog
        agent={agent}
        onClose={onClose}
        confirmationOpen
        confirmation={
          <AgentProductConfirmation
            title="Confirm"
            onCancel={() => {}}
            onConfirm={() => {}}
            cancelLabel="Cancel"
            confirmLabel="Run scan"
          />
        }
      >
        <div>Body</div>
      </AgentProductDialog>,
    );

    expect(screen.getByTestId('agent-product-confirmation-layer')).toBeTruthy();

    rerender(
      <AgentProductDialog agent={agent} onClose={onClose} confirmationOpen={false}>
        <div>Body</div>
      </AgentProductDialog>,
    );

    expect(screen.queryByTestId('agent-product-confirmation-layer')).toBeNull();
    expect(screen.getByTestId('agent-product-main-surface').getAttribute('aria-hidden')).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
  });
});
