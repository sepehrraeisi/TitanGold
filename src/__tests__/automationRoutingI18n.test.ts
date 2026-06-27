import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

const LOCALE_FILES = {
  blueEn: join(ROOT, 'deploy/blue/locales/en.json'),
  blueFa: join(ROOT, 'deploy/blue/locales/fa.json'),
  greenEn: join(ROOT, 'deploy/green/locales/en.json'),
  greenFa: join(ROOT, 'deploy/green/locales/fa.json'),
} as const;

const AUTOMATION_SCAN_ROOTS = [
  join(ROOT, 'components/ai/AIManager/tabs/DataHub/advanced'),
  join(ROOT, 'components/ai/AIManager/tabs/DataHub/modals'),
];

const AUTOMATION_FILE_HINTS = [
  'AutomationTopics',
  'AutomationTopicList',
  'AutomationQueueManager',
  'AutomationSchedulePanel',
  'automationErrorLabels',
  'AutomationTopicModal',
  'QueuePreviewModal',
  'AdvancedFeatures',
];

function loadJson(path: string): Record<string, string> {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'automation' || entry === 'advanced' || entry === 'modals') {
        collectSourceFiles(full, acc);
      } else if (dir.endsWith('/advanced')) {
        collectSourceFiles(full, acc);
      }
    } else if (/\.(tsx|ts)$/.test(entry) && AUTOMATION_FILE_HINTS.some(h => entry.includes(h))) {
      acc.push(full);
    }
  }
  return acc;
}

function extractI18nKeys(source: string): string[] {
  const keys = new Set<string>();
  const patterns = [
    /\bt\(\s*['"]([^'"]+)['"]/g,
    /\bt\(\s*`([^`$]+)`/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      keys.add(match[1]);
    }
  }
  return [...keys];
}

function assertLocaleHasHumanLabels(
  localeName: string,
  locale: Record<string, string>,
  keys: string[],
) {
  for (const key of keys) {
    expect(locale[key], `${localeName} missing key: ${key}`).toBeDefined();
    expect(locale[key], `${localeName} raw key for: ${key}`).not.toBe(key);
    expect(locale[key].trim().length, `${localeName} empty value for: ${key}`).toBeGreaterThan(0);
  }
}

describe('Automation Routing i18n', () => {
  const locales = Object.fromEntries(
    Object.entries(LOCALE_FILES).map(([name, path]) => [name, loadJson(path)]),
  ) as Record<keyof typeof LOCALE_FILES, Record<string, string>>;

  const sourceFiles = AUTOMATION_SCAN_ROOTS.flatMap(root => collectSourceFiles(root));
  const allKeys = [
    ...new Set(sourceFiles.flatMap(file => extractI18nKeys(readFileSync(file, 'utf8')))),
  ].filter(key => key.startsWith('automation_'));

  it('discovers automation_* keys from routing components', () => {
    expect(allKeys.length).toBeGreaterThan(20);
    expect(allKeys).toContain('automation_explanation');
    expect(allKeys).toContain('automation_valid_topics');
  });

  for (const [localeName, locale] of Object.entries(locales)) {
    it(`${localeName} defines human-readable automation_* labels`, () => {
      assertLocaleHasHumanLabels(localeName, locale, allKeys);
    });
  }

  it('blue and green en locales stay in sync for automation keys', () => {
    for (const key of allKeys) {
      expect(locales.greenEn[key]).toBe(locales.blueEn[key]);
    }
  });

  it('blue and green fa locales stay in sync for automation keys', () => {
    for (const key of allKeys) {
      expect(locales.greenFa[key]).toBe(locales.blueFa[key]);
    }
  });
});
