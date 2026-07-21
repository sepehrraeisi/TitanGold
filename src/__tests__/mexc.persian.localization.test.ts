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
  getCapabilityConsumerStatusLabel,
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

/** Simulated product DOM text for normal (non-technical) Persian mode */
function renderPersianProductDom(t: (k: string) => string): string {
  const lines: string[] = [
    t('mexc_details'),
    t('mexc_test_connection'),
    t('mexc_used_by'),
    t('mexc_capability_matrix'),
    t('mexc_show_technical'),
    t('mexc_required_capabilities'),
    t('mexc_optional_capabilities'),
    getGroupLabel('Market Data', t),
    getGroupLabel('Spot', t),
    getCapabilityLabel('MARKET_DATA_SPOT_PUBLIC', t),
    getCapabilityLabel('MARKET_DATA_FUTURES_PUBLIC', t),
    getCapabilityLabel('SPOT_ACCOUNT_READ', t),
    getCapabilityLabel('PRIVATE_AUTH', t),
    getCapabilityLabel('P2P_READ', t),
    getCapabilityLabel('ACCOUNT_EDIT', t),
    getProviderSupportLabel('supported', t),
    getKeyGrantLabel('not_applicable', t),
    getVerificationLabel('not_tested', t),
    getVerificationLabel('verification_error', t),
    getVerificationLabel('deferred_private_non_executing_probe', t),
    getVerificationLabel('not_safely_testable', t),
    getOperationalStateLabel('disabled_pending_explicit_authorization', t),
    getOperationalStateLabel('blocked_by_runtime', t),
    getOperationalStateLabel('blocked_by_provider', t),
    getOperationalStateLabel('blocked_by_provider_evidence', t),
    getConsumerLabel('arbitrage', 'Arbitrage', t),
    getConsumerLabel('market_data_agents', 'Market Data Agents', t),
    getConsumerLabel('risk_agents', 'Risk', t),
    translateReasonKind('auth_pending', t),
    translateReasonKind('provider_unknown', t),
    translateReasonKind('runtime_tier4', t),
    getCapabilityConsumerStatusLabel('PRIVATE_AUTH', { verificationState: 'not_tested' }, t),
    getCapabilityConsumerStatusLabel(
      'SPOT_ACCOUNT_READ',
      { verificationState: 'not_tested', operationalState: 'disabled' },
      t,
    ),
    t('mexc_wallet_integration'),
    t('mexc_manage_connection'),
  ];
  return lines.join('\n');
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
    expect(getCapabilityLabel('SPOT_TRADE_TEST', tFa)).toBe('آزمایش سفارش اسپات، بدون اجرا');
  });

  it('missing capability label is visible failure text, not raw code alone', () => {
    const t = (key: string) => (key === 'mexc_cap_missing_label' ? 'MISSING:{code}' : key);
    expect(getCapabilityLabel('TOTALLY_FAKE_CAP', t)).toContain('MISSING');
    expect(getCapabilityLabel('TOTALLY_FAKE_CAP', t)).not.toBe('TOTALLY_FAKE_CAP');
  });
});

describe('MEXC enum localization', () => {
  const enums: Array<[string, (v: string, t: any) => string, string]> = [
    ['not_applicable', getKeyGrantLabel, 'به کلید API نیاز ندارد'],
    ['not_tested', getVerificationLabel, 'آزمایش نشده'],
    ['verification_error', getVerificationLabel, 'تأیید کامل نشد'],
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

  it('consumer capability status rows are concise Persian', () => {
    const t = makeT('fa');
    expect(getCapabilityConsumerStatusLabel('PRIVATE_AUTH', { verificationState: 'not_tested' }, t)).toBe(
      'تأیید نشده',
    );
    expect(
      getCapabilityConsumerStatusLabel(
        'SPOT_ACCOUNT_READ',
        { verificationState: 'not_tested', operationalState: 'disabled' },
        t,
      ),
    ).toBe('در انتظار تأیید اتصال خصوصی');
    expect(
      getCapabilityConsumerStatusLabel(
        'WALLET_CURRENCY_READ',
        { verificationState: 'verification_error', operationalState: 'disabled' },
        t,
      ),
    ).toBe('تأیید قابلیت‌های کیف پول کامل نشد');
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
  const languageCtx = read('context/LanguageContext.tsx');

  it('does not prefer backend humanLabel for product titles', () => {
    expect(panel).not.toMatch(/humanLabel/);
    expect(panel).toMatch(/getCapabilityLabel/);
  });

  it('never falls back to overall.label English prose', () => {
    expect(panel).not.toMatch(/overall\.label/);
  });

  it('technical codes use data-technical-code', () => {
    expect(panel).toMatch(/data-technical-code="true"/);
    expect(panel).toMatch(/data-technical-value="true"/);
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

  it('consumer details use structured status helper', () => {
    expect(panel).toMatch(/getCapabilityConsumerStatusLabel/);
    expect(panel).not.toMatch(/Required:/);
  });

  it('language preference persists across reload', () => {
    expect(languageCtx).toMatch(/titan_language/);
    expect(languageCtx).toMatch(/document\.documentElement\.lang/);
    expect(languageCtx).toMatch(/document\.documentElement\.dir/);
  });
});

describe('Simulated Persian product DOM (normal mode)', () => {
  it('rendered product strings contain no capability codes or raw enums', () => {
    const t = makeT('fa');
    const productLines = renderPersianProductDom(t);

    expect(productLines).not.toMatch(CANONICAL_CAPABILITY_CODE_PATTERN);
    expect(productLines).not.toMatch(RAW_ENUM_PATTERN);
    for (const phrase of FORBIDDEN_ENGLISH_PRODUCT_PHRASES) {
      expect(productLines.includes(phrase), phrase).toBe(false);
    }
  });

  it('allowlist brands remain acceptable', () => {
    const t = makeT('fa');
    const text = [t('mexc_details'), getCapabilityLabel('P2P_READ', t), 'MEXC', 'TitanGold', 'API'].join(' ');
    expect(text).toMatch(/MEXC/);
    expect(text).toMatch(/P2P/);
  });
});

describe('Technical mode secondary codes', () => {
  it('raw codes are only meaningful inside technical markers', () => {
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    // Capability id interpolation must sit next to data-technical-code
    expect(panel).toMatch(/data-technical-code="true"[\s\S]{0,120}\{cap\.capabilityId\}/);
    expect(panel).toMatch(/mexc_technical_verification_value/);
  });
});
