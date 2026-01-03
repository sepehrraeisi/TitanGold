// Test MACD transformation
const macdValue = {
  value: -0.79,
  signal: -0.94,
  histogram: 0.15
};

const indicatorValue = macdValue.value || 0;
let indicatorSignal = 'neutral';

// Normalize signal: can be numeric (MACD signal line) or string ('bearish')
if (typeof macdValue.signal === 'string') {
  indicatorSignal = macdValue.signal.toLowerCase() === 'bearish' ? 'sell' : 
                    macdValue.signal.toLowerCase() === 'bullish' ? 'buy' : 'neutral';
} else if (typeof macdValue.signal === 'number') {
  // For MACD: if histogram is negative → sell, positive → buy
  if (macdValue.histogram !== undefined) {
    indicatorSignal = macdValue.histogram < 0 ? 'sell' : macdValue.histogram > 0 ? 'buy' : 'neutral';
  } else {
    indicatorSignal = indicatorValue > macdValue.signal ? 'buy' : indicatorValue < macdValue.signal ? 'sell' : 'neutral';
  }
}

console.log('MACD Input:', JSON.stringify(macdValue));
console.log('MACD Output:');
console.log('  - value:', indicatorValue);
console.log('  - signal:', indicatorSignal);
console.log('  - histogram:', macdValue.histogram);
console.log('  - Decision: histogram=', macdValue.histogram, '→', indicatorSignal);
