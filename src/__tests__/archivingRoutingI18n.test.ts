import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
    archiveHealthLabel,
    isRawArchivingLabel,
    operationLabel,
    partitionDisplayLabel,
    RAW_ARCHIVING_PATTERNS,
} from '../../components/ai/AIManager/tabs/DataHub/advanced/archiving/archivingLabels';
import type { ArchivingOperation, ArchivePartition } from '../../services/dataHubArchivingApi';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

const LOCALE_FILES = {
    blueEn: join(ROOT, 'deploy/blue/locales/en.json'),
    blueFa: join(ROOT, 'deploy/blue/locales/fa.json'),
    greenEn: join(ROOT, 'deploy/green/locales/en.json'),
    greenFa: join(ROOT, 'deploy/green/locales/fa.json'),
} as const;

const ARCHIVING_SOURCES = [
    join(ROOT, 'components/ai/AIManager/tabs/DataHub/advanced/Archiving.tsx'),
    join(ROOT, 'components/ai/AIManager/tabs/DataHub/advanced/archiving/archivingLabels.ts'),
];

const FORBIDDEN_UI_STRINGS = [
    'ai_decisions_archive_2024',
    'ai_decisions_archive_2025',
    'preview_archive',
    'preview_restore',
    'preview_purge',
    'archive_old_decisions',
    'restore_from_archive',
];

function loadJson(path: string): Record<string, string> {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function extractI18nKeys(source: string): string[] {
    const keys = new Set<string>();
    const patterns = [/\bt\(\s*['"]([^'"]+)['"]/g, /\bt\(\s*`([^`$]+)`/g];
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

const mockT = (key: string) => {
    const en = loadJson(LOCALE_FILES.blueEn);
    return en[key] ?? key;
};

describe('Data Archiving P2 i18n', () => {
    const locales = Object.fromEntries(
        Object.entries(LOCALE_FILES).map(([name, path]) => [name, loadJson(path)]),
    ) as Record<keyof typeof LOCALE_FILES, Record<string, string>>;

    const allKeys = [
        ...new Set(ARCHIVING_SOURCES.flatMap(file => extractI18nKeys(readFileSync(file, 'utf8')))),
    ].filter(key => key.startsWith('archiving_') || key === 'data_archiving');

    it('discovers archiving keys from Archiving.tsx', () => {
        expect(allKeys.length).toBeGreaterThan(15);
        expect(allKeys).toContain('archiving_explanation_p2');
        expect(allKeys).toContain('archiving_purge_count_only_msg');
    });

    for (const [localeName, locale] of Object.entries(locales)) {
        it(`${localeName} defines human-readable archiving labels`, () => {
            assertLocaleHasHumanLabels(localeName, locale, allKeys);
        });
    }

    it('locale values must not expose raw DB or enum strings', () => {
        for (const key of allKeys) {
            const value = locales.blueEn[key] ?? '';
            for (const forbidden of FORBIDDEN_UI_STRINGS) {
                expect(value, `en.${key} contains raw ${forbidden}`).not.toContain(forbidden);
            }
        }
    });

    it('partitionDisplayLabel never returns raw table name', () => {
        const p: ArchivePartition = {
            label: 'Archive 2026',
            year: 2026,
            start_date: '2026-01-01',
            end_date: '2027-01-01',
            row_count: 0,
            size: '0 bytes',
        };
        expect(partitionDisplayLabel(p)).toBe('Archive 2026');
        expect(isRawArchivingLabel(partitionDisplayLabel(p))).toBe(false);
    });

    it('operationLabel maps preview_purge to human text', () => {
        const op: ArchivingOperation = {
            id: '1',
            operation_type: 'preview_purge',
            dry_run: true,
            request_payload: {},
            result_payload: {},
            status: 'success',
            started_at: new Date().toISOString(),
        };
        const label = operationLabel(op, mockT);
        expect(label).toBe('Purge preview');
        expect(isRawArchivingLabel(label)).toBe(false);
    });

    it('archiveHealthLabel uses stable codes not SQL', () => {
        expect(archiveHealthLabel('warning_stale_archive', mockT)).toBe('Archive overdue');
        expect(archiveHealthLabel('healthy', mockT)).toBe('Healthy');
    });

    it('isRawArchivingLabel detects forbidden patterns', () => {
        expect(isRawArchivingLabel('ai_decisions_archive_2024')).toBe(true);
        expect(isRawArchivingLabel('preview_purge')).toBe(true);
        expect(isRawArchivingLabel('Archive 2024')).toBe(false);
        expect(RAW_ARCHIVING_PATTERNS.length).toBeGreaterThan(0);
    });

    it('Archiving.tsx source does not render raw partition names as literals', () => {
        const src = readFileSync(ARCHIVING_SOURCES[0], 'utf8');
        for (const forbidden of FORBIDDEN_UI_STRINGS) {
            expect(src, `Archiving.tsx contains literal ${forbidden}`).not.toContain(forbidden);
        }
    });

    it('operation i18n keys from archivingLabels are defined in locales', () => {
        const opKeys = [
            'archiving_op_preview_archive',
            'archiving_op_archive_applied',
            'archiving_op_preview_restore',
            'archiving_op_restore_applied',
            'archiving_op_preview_purge',
            'archiving_op_create_partition',
        ];
        assertLocaleHasHumanLabels('blueEn', locales.blueEn, opKeys);
    });

    it('blue and green en locales stay in sync for archiving keys', () => {
        for (const key of allKeys) {
            expect(locales.greenEn[key]).toBe(locales.blueEn[key]);
        }
    });
});

describe('Data Archiving RBAC UI contract', () => {
    it('Archiving.tsx uses dataHubWriteGate for preview and apply buttons', () => {
        const src = readFileSync(ARCHIVING_SOURCES[0], 'utf8');
        expect(src).toContain('dataHubWriteGate');
        expect(src).toContain('useDataHubPermissions');
        expect(src).toContain('confirm_archive: true');
        expect(src).toContain('confirm_restore: true');
    });
});
