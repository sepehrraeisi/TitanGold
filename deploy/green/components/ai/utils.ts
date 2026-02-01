/**
 * Safe array utilities to prevent crashes on undefined/null values
 */

export const safeArray = <T>(value: T[] | undefined | null): T[] => {
  return Array.isArray(value) ? value : [];
};

export const safeIndicators = (data: any): any[] => {
  return safeArray(
    data?.indicators ||
    data?.result?.indicators ||
    data?.analysis?.indicators ||
    data?.lastAnalysis?.indicators ||
    []
  );
};

export const safeConfig = (config: any, defaultConfig: any): any => {
  return {
    ...defaultConfig,
    ...config,
    enabledIndicators: safeArray(config?.enabledIndicators || defaultConfig?.enabledIndicators),
    timeframes: safeArray(config?.timeframes || defaultConfig?.timeframes),
  };
};
