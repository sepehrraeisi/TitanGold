import { describe, expect, it } from 'vitest';
import {
  localizeSignalDirection,
  localizeSignalType,
} from '../../../../../components/ai/trend/trendUiHelpers.ts';

const t = (key: string) => {
  const map: Record<string, string> = {
    not_available: 'N/A',
    trend_signal_type_trend_weakening: 'Trend weakening',
    trend_signal_direction_neutral: 'Neutral',
    trend_direction_bullish: 'Bullish',
  };
  return map[key] || key;
};

describe('trendUiHelpers signal localization', () => {
  it('localizes signal types without raw enum leakage', () => {
    expect(localizeSignalType('trend_weakening', t)).toBe('Trend weakening');
    expect(localizeSignalType('unknown_enum', t)).toBe('N/A');
  });

  it('localizes neutral direction without raw key leakage', () => {
    expect(localizeSignalDirection('neutral', t)).toBe('Neutral');
    expect(localizeSignalDirection('bullish', t)).toBe('Bullish');
  });
});
