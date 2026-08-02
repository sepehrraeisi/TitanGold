import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentRegistry } from '../../../../../components/ai/agentRegistry';
import { AGENT_KEYS } from '../../../../../constants/agentKeys';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

const NATIVE_DIALOG_PATTERN = /\b(window\.)?(alert|confirm)\s*\(/;

function collectTsxFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectTsxFiles(fullPath));
      continue;
    }
    if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function relativeFromRoot(fullPath: string): string {
  return fullPath.startsWith(repoRoot) ? fullPath.slice(repoRoot.length) : fullPath;
}

describe('Arbitrage product native dialog audit', () => {
  it('keeps registry fallback on ArbitrageAgentPopup, not legacy control', () => {
    const entry = agentRegistry[AGENT_KEYS.ARBITRAGE];
    expect(entry).toBeDefined();
    expect(entry.fallbackTitle).toBe('Arbitrage Agent Error');
    expect(String(entry.component)).not.toContain('ArbitrageAgentControl');
  });

  it('has zero alert/confirm calls in reachable Arbitrage product sources', () => {
    const productRoots = [
      join(repoRoot, 'components/ai/ArbitrageAgentPopup.tsx'),
      join(repoRoot, 'components/ai/ArbitrageWorkspace.tsx'),
      join(repoRoot, 'components/ai/arbitrage'),
    ];

    const offenders: string[] = [];
    for (const root of productRoots) {
      const files = statSync(root).isDirectory() ? collectTsxFiles(root) : [root];
      for (const file of files) {
        const source = readFileSync(file, 'utf8');
        if (NATIVE_DIALOG_PATTERN.test(source)) {
          offenders.push(relativeFromRoot(file));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
