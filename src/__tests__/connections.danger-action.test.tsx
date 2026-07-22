/**
 * CONNECTIONS Danger Zone — canonical destructive button + confirm dialog.
 * Presentation QA only: mocked confirm must not hit provider/transport.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActionButton from '../../components/ui/action-button.tsx';
import MexcDeleteConfirmDialog from '../../components/settings/connections/MexcDeleteConfirmDialog.tsx';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
const locale = (lang: 'en' | 'fa') =>
  JSON.parse(read(`deploy/blue/locales/${lang}.json`)) as Record<string, string>;

describe('Connections danger action — source of truth', () => {
  it('uses canonical ActionButton danger variant, not legacy outlined delete', () => {
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    const btn = read('components/ui/action-button.tsx');
    const dialog = read('components/settings/connections/MexcDeleteConfirmDialog.tsx');

    expect(btn).toMatch(/variant\?:.*'danger'/);
    expect(btn).toMatch(/danger: 'bg-red-600/);
    expect(panel).toMatch(/import ActionButton from/);
    expect(panel).toMatch(/variant="danger"/);
    expect(panel).toMatch(/mexc_delete_connection/);
    expect(panel).toMatch(/MexcDeleteConfirmDialog/);
    expect(panel).not.toMatch(/border border-red-500\/50 bg-red-900\/30/);
    expect(panel).not.toMatch(/confirmDelete/);
    expect(panel).not.toMatch(/mexc_confirm_delete/);
    expect(dialog).toMatch(/role="dialog"/);
    expect(dialog).toMatch(/variant="danger"/);
    expect(dialog).toMatch(/mexc-delete-cancel/);
    expect(dialog).toMatch(/Escape/);
  });

  it('EN/FA labels and dialog copy match product contract', () => {
    const en = locale('en');
    const fa = locale('fa');
    expect(en.mexc_delete_connection).toBe('Delete connection');
    expect(fa.mexc_delete_connection).toBe('حذف اتصال');
    expect(en.mexc_delete_dialog_title).toBe('Delete MEXC connection?');
    expect(fa.mexc_delete_dialog_title).toBe('اتصال MEXC حذف شود؟');
    expect(en.mexc_delete_dialog_body).toBe(
      'This removes the stored MEXC credentials from TitanGold. This action cannot be undone.',
    );
    expect(fa.mexc_delete_dialog_body).toBe(
      'با این کار اعتبارنامه‌های ذخیره‌شده MEXC از TitanGold حذف می‌شوند. این عمل قابل بازگشت نیست.',
    );
    expect(en.cancel).toBe('Cancel');
    expect(fa.cancel).toBe('انصراف');

    for (const slot of ['blue', 'green'] as const) {
      for (const lang of ['en', 'fa'] as const) {
        const l = JSON.parse(read(`deploy/${slot}/locales/${lang}.json`)) as Record<string, string>;
        expect(l.mexc_delete_connection).toBeTruthy();
        expect(l.mexc_delete_dialog_title).toBeTruthy();
        expect(l.mexc_delete_dialog_body).toBeTruthy();
      }
    }
  });

  it('does not wire provider transport or credential decrypt into danger UI', () => {
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    const dialog = read('components/settings/connections/MexcDeleteConfirmDialog.tsx');
    expect(dialog).not.toMatch(/decrypt|signRequest|api\.mexc|probeMexc|PRIVATE_VERIFY/i);
    expect(panel).toMatch(/deleteMexcConnection/);
    // confirm path is gated behind dialog; presentation QA never invokes it
    expect(panel).toMatch(/handleDeleteConfirm/);
    expect(panel).toMatch(/if \(deleting\) return/);
  });
});

describe('ActionButton danger variant states', () => {
  afterEach(() => cleanup());

  it('renders filled danger with hover/active/focus/disabled/loading classes', () => {
    const { rerender } = render(
      <ActionButton variant="danger" data-testid="danger-btn">
        Delete connection
      </ActionButton>,
    );
    const btn = screen.getByTestId('danger-btn');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('data-variant')).toBe('danger');
    expect(btn.className).toMatch(/bg-red-600/);
    expect(btn.className).toMatch(/hover:bg-red-500/);
    expect(btn.className).toMatch(/active:bg-red-700/);
    expect(btn.className).toMatch(/focus-visible:ring-2/);
    expect(btn.className).toMatch(/focus-visible:ring-white\/80|focus-visible:ring-indigo/);
    expect(btn.className).toMatch(/min-h-9/);
    expect(btn.className).toMatch(/rounded-lg/);
    expect(btn.className).toMatch(/px-4/);
    expect(btn.className).toMatch(/font-semibold/);

    rerender(
      <ActionButton variant="danger" disabled data-testid="danger-btn">
        Delete connection
      </ActionButton>,
    );
    expect(screen.getByTestId('danger-btn')).toBeDisabled();
    expect(screen.getByTestId('danger-btn').className).toMatch(/disabled:opacity-60/);

    rerender(
      <ActionButton variant="danger" loading data-testid="danger-btn">
        Delete connection
      </ActionButton>,
    );
    const loadingBtn = screen.getByTestId('danger-btn');
    expect(loadingBtn).toBeDisabled();
    expect(loadingBtn.getAttribute('data-loading')).toBe('true');
    expect(loadingBtn.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByTestId('action-button-spinner')).toBeTruthy();
  });
});

describe('MexcDeleteConfirmDialog interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it('opens with Cancel focused; Escape and Cancel close without confirming', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    const { unmount } = render(
      <MexcDeleteConfirmDialog
        open
        providerName="MEXC"
        title="Delete MEXC connection?"
        description="This removes the stored MEXC credentials from TitanGold. This action cannot be undone."
        confirmLabel="Delete connection"
        cancelLabel="Cancel"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByTestId('mexc-delete-confirm-dialog')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByTestId('mexc-delete-dialog-provider').textContent).toBe('MEXC');
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('mexc-delete-cancel'));
    });

    // Enter on Cancel must not confirm
    await user.keyboard('{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    unmount();

    onCancel.mockClear();
    onConfirm.mockClear();
    render(
      <MexcDeleteConfirmDialog
        open
        providerName="MEXC"
        title="Delete MEXC connection?"
        description="body"
        confirmLabel="Delete connection"
        cancelLabel="Cancel"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('mexc-delete-cancel'));
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('prevents duplicate confirm while loading and does not invoke confirm on presentation cancel', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <MexcDeleteConfirmDialog
        open
        confirming
        providerName="MEXC"
        title="Delete MEXC connection?"
        description="body"
        confirmLabel="Delete connection"
        cancelLabel="Cancel"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    const confirm = screen.getByTestId('mexc-delete-confirm');
    expect(confirm).toBeDisabled();
    expect(confirm.getAttribute('data-loading')).toBe('true');
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Persian copy renders without English leakage in dialog labels', () => {
    render(
      <MexcDeleteConfirmDialog
        open
        providerName="MEXC"
        title="اتصال MEXC حذف شود؟"
        description="با این کار اعتبارنامه‌های ذخیره‌شده MEXC از TitanGold حذف می‌شوند. این عمل قابل بازگشت نیست."
        confirmLabel="حذف اتصال"
        cancelLabel="انصراف"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText('اتصال MEXC حذف شود؟')).toBeTruthy();
    expect(screen.getByText('حذف اتصال')).toBeTruthy();
    expect(screen.getByText('انصراف')).toBeTruthy();
  });
});
