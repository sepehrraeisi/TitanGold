/**
 * CONNECTIONS section navigation — source + mounted routing contract.
 * Shallow source tests previously missed the setConfirmDelete runtime crash.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MEXC_MANAGE_SECTIONS,
  buildMexcManageNavigation,
  navigateToConnectionSection,
  normalizeMexcManageSection,
  readConnectionSectionFromUrl,
} from '../../utils/settingsNavigation.ts';
import {
  isURLStateEqual,
  payloadToURLState,
  readStateFromURL,
  writeStateToURL,
} from '../../utils/urlSync.ts';
import { ConnectionsSectionNav } from '../../components/settings/connections/mexcPanelShared.tsx';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Connections section navigation — RCA guards', () => {
  it('does not reference removed setConfirmDelete in navigate path', () => {
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(panel).not.toMatch(/setConfirmDelete/);
    expect(panel).not.toMatch(/confirmDelete/);
    expect(panel).toMatch(/navigateToConnectionSection/);
    expect(panel).toMatch(/setDeleteDialogOpen\(false\)/);
  });

  it('uses canonical section slugs in tab ids and panels', () => {
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(panel).toMatch(/verification-history/);
    expect(panel).toMatch(/danger-zone/);
    expect(panel).toMatch(/mexc-panel-verification-history/);
    expect(panel).toMatch(/mexc-panel-danger-zone/);
    expect(panel).not.toMatch(/id: 'history'/);
    expect(panel).not.toMatch(/id: 'danger'/);
  });

  it('normalizes aliases once and never reverts valid sections', () => {
    expect(normalizeMexcManageSection('credentials')).toBe('credentials');
    expect(normalizeMexcManageSection('verification-history')).toBe('verification-history');
    expect(normalizeMexcManageSection('danger-zone')).toBe('danger-zone');
    expect(normalizeMexcManageSection('history')).toBe('verification-history');
    expect(normalizeMexcManageSection('danger')).toBe('danger-zone');
    expect(normalizeMexcManageSection('bogus')).toBe('overview');
    expect([...MEXC_MANAGE_SECTIONS]).toEqual([
      'overview',
      'credentials',
      'capabilities',
      'consumers',
      'verification-history',
      'danger-zone',
    ]);
  });
});

describe('navigateToConnectionSection + URL sync', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => cleanup());

  it('writes canonical provider/section and preserves settings tab', () => {
    const onNavigate = vi.fn((payload) => {
      writeStateToURL(payloadToURLState(payload), false);
    });
    const payload = navigateToConnectionSection(onNavigate, 'mexc', 'capabilities');
    expect(payload).toEqual({
      view: 'settings',
      settingsTab: 'connections',
      settingsSubtab: 'mexc-manage',
      provider: 'mexc',
      section: 'capabilities',
    });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(readStateFromURL()?.section).toBe('capabilities');
    expect(readStateFromURL()?.provider).toBe('mexc');
    expect(readStateFromURL()?.settingsTab).toBe('connections');
  });

  it('does not revert a valid section when re-normalized', () => {
    writeStateToURL(
      {
        view: 'settings',
        settingsTab: 'connections',
        settingsSubtab: 'mexc-manage',
        provider: 'mexc',
        section: 'consumers',
      },
      true,
    );
    expect(readConnectionSectionFromUrl()).toBe('consumers');
    expect(normalizeMexcManageSection(readStateFromURL()?.section)).toBe('consumers');
  });

  it('invalid section falls back once to overview', () => {
    writeStateToURL(
      {
        view: 'settings',
        settingsTab: 'connections',
        provider: 'mexc',
        section: 'not-a-section',
      },
      true,
    );
    expect(readConnectionSectionFromUrl()).toBe('overview');
  });

  it('duplicate navigation is detectable via URL equality', () => {
    const a = buildMexcManageNavigation('overview');
    const b = buildMexcManageNavigation('overview');
    expect(isURLStateEqual(payloadToURLState(a), payloadToURLState(b))).toBe(true);
    expect(isURLStateEqual(payloadToURLState(a), payloadToURLState(buildMexcManageNavigation('credentials')))).toBe(false);
  });

  it('Wallet deep link builder targets overview by default', () => {
    expect(buildMexcManageNavigation('overview').section).toBe('overview');
    expect(buildMexcManageNavigation('overview').provider).toBe('mexc');
  });
});

describe('ConnectionsSectionNav interaction', () => {
  afterEach(() => cleanup());

  const items = [
    { id: 'overview', label: 'Overview' },
    { id: 'credentials', label: 'Credentials' },
    { id: 'capabilities', label: 'Capabilities' },
    { id: 'consumers', label: 'Consumers' },
    { id: 'verification-history', label: 'History' },
    { id: 'danger-zone', label: 'Danger' },
  ];

  it('click and keyboard update via onChange; pointer reaches button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ConnectionsSectionNav
        items={items}
        activeId="overview"
        onChange={onChange}
        ariaLabel="Sections"
        dir="ltr"
      />,
    );
    const tablist = screen.getByTestId('mexc-section-tablist');
    expect(tablist.getAttribute('role')).toBe('tablist');
    const cred = screen.getByTestId('mexc-section-tab-credentials');
    expect(cred.tagName).toBe('BUTTON');
    expect(cred.getAttribute('type')).toBe('button');
    expect(getComputedStyle(cred).pointerEvents).not.toBe('none');

    await user.click(cred);
    expect(onChange).toHaveBeenCalledWith('credentials');

    onChange.mockClear();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('credentials');

    onChange.mockClear();
    cred.focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('credentials');
  });

  it('RTL reverses arrow direction', () => {
    const onChange = vi.fn();
    render(
      <ConnectionsSectionNav
        items={items}
        activeId="credentials"
        onChange={onChange}
        ariaLabel="Sections"
        dir="rtl"
      />,
    );
    fireEvent.keyDown(screen.getByTestId('mexc-section-tablist'), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('capabilities');
  });

  it('aria-selected tracks activeId', () => {
    render(
      <ConnectionsSectionNav
        items={items}
        activeId="consumers"
        onChange={() => {}}
        ariaLabel="Sections"
      />,
    );
    expect(screen.getByTestId('mexc-section-tab-consumers').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('mexc-section-tab-overview').getAttribute('aria-selected')).toBe('false');
  });
});
