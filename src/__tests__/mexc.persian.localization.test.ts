/**
 * MEXC Persian localization completeness and product-DOM guards
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MEXC_CAPABILITY_CODES,
  getCapabilityLabel,
  getProviderSupportLabel,
  getKeyGrantLabel,
  getVerificationLabel,
  getOperationalStateLabel,
  getConsumerLabel,
  getGroupLabel,
  FORBIDDEN_ENGLISH_PRODUCT_PHRASES,
  CANONICAL_CAPABILITY_CODE_PATTERN,
  RAW_ENUM_PATTERN,
} from '../../utils/mexcDisplayLabels.ts';
import {
  selectCapabilityProductReason,
  translateReasonKind,
} from '../../utils/mexcReasonPriority.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function locale(color: 'blue' | 'green', lang: 'en' | 'fa'): Record<string, string> {
  return JSON.parse(read(`deploy/${color}/locales/${lang}.json`));
}

function makeT(lang: 'en' | 'fa') {
  const map = locale('blue', lang);
  return (key: string, options?: Record<string, string | number>) => {
    let out = map[key] || key;
    if (options) {
      for (const [k, v] of Object.entries(options)) {
        out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return out;
  };
}

describe('MEXC capability label completeness', () => {
  for (const color of ['blue', 'green'] as const) {
    for (const lang of ['en', 'fa'] as const) {
      it(`${color}/${lang} has labels for every canonical capability`, () => {
        const l = locale(color, lang);
        for (const code of MEXC_CAPABILITY_CODES) {
          const key = `mexc_cap_${code}`;
          expect(l[key], key).toBeTruthy();
          expect(l[key]).not.toBe(key);
          expect(l[key]).not.toBe(code);
        }
      });
    }
  }

  it('getCapabilityLabel never falls back to raw code when locales present', () => {
    const tFa = makeT('fa');
    expect(getCapabilityLabel('SPOT_ACCOUNT_READ', tFa)).toBe('مشاهده حساب اسپات');
    expect(getCapabilityLabel('MARKET_DATA_SPOT_PUBLIC', tFa)).toBe('داده عمومی بازار اسپات');
    expect(getCapabilityLabel('PRIVATE_AUTH', tFa)).toBe('احراز هویت خصوصی');
    expect(getCapabilityLabel('ACCOUNT_EDIT', tFa)).toBe('ویرایش اطلاعات حساب');
  });
});

describe('MEXC enum localization', () => {
  const enums: Array<[string, (v: string, t: any) => string, string]> = [
    ['not_applicable', getKeyGrantLabel, 'به کلید API نیاز ندارد'],
    ['not_tested', getVerificationLabel, 'آزمایش نشده'],
    ['deferred_private_non_executing_probe', getVerificationLabel, 'آزمون خصوصی بدون اجرا تا دریافت مجوز به تعویق افتاده است'],
    ['disabled_pending_explicit_authorization', getOperationalStateLabel, 'تا دریافت مجوز صریح غیرفعال است'],
    ['not_safely_testable', getVerificationLabel, 'امکان آزمون ایمن ندارد'],
    ['blocked_by_runtime', getOperationalStateLabel, 'به‌دلیل وضعیت اجرایی مسدود است'],
    ['blocked_by_provider', getOperationalStateLabel, 'از سمت ارائه‌دهنده مسدود است'],
    ['blocked_by_provider_evidence', getOperationalStateLabel, 'به‌دلیل نبود تأیید رسمی ارائه‌دهنده مسدود است'],
  ];

  for (const [value, fn, expectedFa] of enums) {
    it(`FA translates ${value}`, () => {
      expect(fn(value, makeT('fa'))).toBe(expectedFa);
    });
  }

  it('provider support FA', () => {
    const t = makeT('fa');
    expect(getProviderSupportLabel('supported', t)).toBe('پشتیبانی‌شده');
    expect(getProviderSupportLabel('unknown', t)).toBe('نامشخص');
    expect(getProviderSupportLabel('maintenance', t)).toBe('در حال نگهداری');
  });
});

describe('Product copy FA', () => {
  it('translates Test Connection and Used by', () => {
    const t = makeT('fa');
    expect(t('mexc_test_connection')).toBe('آزمایش اتصال');
    expect(t('mexc_used_by')).toBe('مورد استفاده در');
    expect(t('mexc_details')).toBe('جزئیات اتصال MEXC');
    expect(getConsumerLabel('arbitrage', 'Arbitrage', t)).toBe('آربیتراژ');
    expect(getConsumerLabel('market_data_agents', 'Market Data Agents', t)).toBe('عامل‌های داده بازار');
    expect(getConsumerLabel('risk_agents', 'Risk', t)).toBe('عامل‌های ریسک');
    expect(getGroupLabel('Spot', t)).toBe('اسپات');
  });
});

describe('Reason priority localization', () => {
  it('P2P unknown support uses provider_unknown Persian reason', () => {
    const kind = selectCapabilityProductReason({
      capabilityId: 'P2P_READ',
      providerSupport: 'unknown',
      operationalState: 'blocked_by_provider_evidence',
    });
    expect(kind).toBe('provider_unknown');
    expect(translateReasonKind(kind, makeT('fa'))).toMatch(/پشتیبانی رسمی/);
  });

  it('ACCOUNT_EDIT unknown uses account_use_case_unknown', () => {
    const kind = selectCapabilityProductReason({
      capabilityId: 'ACCOUNT_EDIT',
      providerSupport: 'unknown',
      operationalState: 'blocked_by_provider_evidence',
      blockedReason: 'PROVIDER SUPPORT NOT VERIFIED — no verified official TitanGold endpoint/use case',
    });
    expect(kind).toBe('account_use_case_unknown');
    expect(translateReasonKind(kind, makeT('fa'))).toMatch(/کاربرد TitanGold/);
  });
});

describe('Panel source localization guards', () => {
  const panel = read('components/settings/connections/MexcConnectionPanel.tsx');

  it('does not prefer backend humanLabel for product titles', () => {
    expect(panel).not.toMatch(/humanLabel/);
    expect(panel).toMatch(/getCapabilityLabel/);
  });

  it('technical codes use data-technical-code', () => {
    expect(panel).toMatch(/data-technical-code="true"/);
  });

  it('does not hardcode English MEXC details', () => {
    expect(panel).not.toMatch(/>\s*MEXC details\s*</);
    expect(panel).toMatch(/mexc_details/);
  });

  it('technical mode shows translated enum labels', () => {
    expect(panel).toMatch(/getProviderSupportLabel/);
    expect(panel).toMatch(/getKeyGrantLabel/);
    expect(panel).toMatch(/getVerificationLabel/);
    expect(panel).toMatch(/getOperationalStateLabel/);
  });
});

describe('Simulated Persian product DOM (normal mode)', () => {
  it('rendered product strings contain no capability codes or raw enums', () => {
    const t = makeT('fa');
    const productLines = [
      getCapabilityLabel('SPOT_ACCOUNT_READ', t),
      getCapabilityLabel('PRIVATE_AUTH', t),
      getProviderSupportLabel('supported', t),
      getKeyGrantLabel('not_applicable', t),
      getVerificationLabel('not_tested', t),
      getOperationalStateLabel('disabled_pending_explicit_authorization', t),
      getConsumerLabel('arbitrage', 'Arbitrage', t),
      translateReasonKind('auth_pending', t),
      t('mexc_test_connection'),
      t('mexc_used_by'),
    ].join('\n');

    expect(productLines).not.toMatch(CANONICAL_CAPABILITY_CODE_PATTERN);
    expect(productLines).not.toMatch(RAW_ENUM_PATTERN);
    for (const phrase of FORBIDDEN_ENGLISH_PRODUCT_PHRASES) {
      expect(productLines.includes(phrase), phrase).toBe(false);
    }
  });
});
