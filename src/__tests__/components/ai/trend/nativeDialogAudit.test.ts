import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentRegistry } from '../../../../../components/ai/agentRegistry';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const NATIVE_DIALOG_PATTERN = /\b(window\.)?(alert|confirm|prompt)\s*\(/;

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
    if (entry.endsWith('.tsx') || entry.endsWith('.ts')) files.push(fullPath);
  }
  return files;
}

describe('Trend product native dialog audit', () => {
  it('registry points to TrendAgentPopup not legacy TrendAgentControl', () => {
    const entry = agentRegistry.trend;
    expect(entry).toBeDefined();
    expect(String(entry.component)).not.toContain('TrendAgentControl');
  });

  it('has zero alert/confirm/prompt in reachable Trend product sources', () => {
    const roots = [
      join(repoRoot, 'components/ai/TrendAgentPopup.tsx'),
      join(repoRoot, 'components/ai/TrendWorkspace.tsx'),
      join(repoRoot, 'components/ai/trend'),
    ];
    const offenders: string[] = [];
    for (const root of roots) {
      const files = statSync(root).isDirectory() ? collectTsxFiles(root) : [root];
      for (const file of files) {
        if (NATIVE_DIALOG_PATTERN.test(readFileSync(file, 'utf8'))) {
          offenders.push(file.replace(repoRoot, ''));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('legacy TrendAgentControl is not imported by agentRegistry', () => {
    const source = readFileSync(join(repoRoot, 'components/ai/agentRegistry.ts'), 'utf8');
    expect(source).not.toContain('TrendAgentControl');
  });
});
