/**
 * Price Predictor Service
 * 
 * Implements statistical and machine learning models for price prediction:
 * - Linear Regression: Simple trend-based prediction
 * - ARIMA: Autoregressive Integrated Moving Average for time series
 * 
 * Features:
 * - Multiple timeframe predictions (1h, 4h, 24h)
 * - Confidence intervals (95%)
 * - Model training on historical data
 * - Accuracy metrics (RMSE, MAE, MAPE)
 * - Model persistence and caching
 * 
 * @module predictor
 */

import regression from 'regression';
import * as ss from 'simple-statistics';
import ARIMA from 'arima';
import { logger } from './logger.js';

/**
 * Predict prices for multiple timeframes using historical OHLCV data
 * @param {Array} ohlcv - Historical OHLCV data [[timestamp, open, high, low, close, volume], ...]
 * @param {object} options - Prediction options
 * @returns {object} - Predictions for 1h, 4h, 24h with confidence intervals
 */
export function predictPrices(ohlcv, options = {}) {
  if (!ohlcv || ohlcv.length < 30) {
    throw new Error('Insufficient data for prediction (minimum 30 data points required)');
  }

  const method = options.method || 'hybrid'; // 'linear', 'arima', 'hybrid'
  const closes = ohlcv.map(candle => candle[4]);
  const currentPrice = closes[closes.length - 1];

  // Determine predictions based on method
  let predictions;
  if (method === 'linear') {
    predictions = predictWithLinearRegression(closes, options);
  } else if (method === 'arima') {
    predictions = predictWithARIMA(closes, options);
  } else {
    // Hybrid: Use both methods and average
    const linearPred = predictWithLinearRegression(closes, options);
    const arimaPred = predictWithARIMA(closes, options);
    predictions = combinePredictions(linearPred, arimaPred);
  }

  // Calculate accuracy metrics on training data
  const accuracy = calculateAccuracy(closes, method);

  return {
    current_price: currentPrice,
    predictions: {
      '1h': predictions['1h'],
      '4h': predictions['4h'],
      '24h': predictions['24h']
    },
    method,
    accuracy,
    timestamp: new Date().toISOString()
  };
}

/**
 * Predict using Linear Regression
 */
function predictWithLinearRegression(closes, options = {}) {
  // Prepare data for regression (x = index, y = price)
  const data = closes.map((price, index) => [index, price]);
  
  // Train linear regression model
  const result = regression.linear(data);
  const { equation, r2 } = result;

  const lastIndex = closes.length - 1;
  
  // Predict future prices (assuming hourly candles)
  const pred1h = result.predict(lastIndex + 1)[1];
  const pred4h = result.predict(lastIndex + 4)[1];
  const pred24h = result.predict(lastIndex + 24)[1];

  // Calculate confidence intervals based on residual standard error
  const predictions = result.points.map(p => p[1]);
  const residuals = closes.map((actual, i) => actual - predictions[i]);
  const rse = ss.standardDeviation(residuals);
  
  // 95% confidence interval (1.96 * standard error)
  const confidenceMultiplier = 1.96;
  const ci1h = confidenceMultiplier * rse;
  const ci4h = confidenceMultiplier * rse * 1.5; // Wider for longer timeframe
  const ci24h = confidenceMultiplier * rse * 2.5; // Even wider

  return {
    '1h': {
      price: pred1h,
      lower: pred1h - ci1h,
      upper: pred1h + ci1h,
      confidence: r2
    },
    '4h': {
      price: pred4h,
      lower: pred4h - ci4h,
      upper: pred4h + ci4h,
      confidence: r2 * 0.9 // Slightly lower confidence for longer timeframe
    },
    '24h': {
      price: pred24h,
      lower: pred24h - ci24h,
      upper: pred24h + ci24h,
      confidence: r2 * 0.8 // Lower confidence for 24h
    }
  };
}

/**
 * Predict using ARIMA model
 */
function predictWithARIMA(closes, options = {}) {
  try {
    // ARIMA parameters (p, d, q)
    // p = autoregressive order (look back periods)
    // d = degree of differencing (make series stationary)
    // q = moving average order
    const p = options.arimaP || 5;
    const d = options.arimaD || 1;
    const q = options.arimaQ || 2;

    // Initialize and train ARIMA model
    const arima = new ARIMA({
      p: p,
      d: d,
      q: q,
      verbose: false
    });

    // Train the model
    arima.train(closes);

    // Predict future values
    const pred1h = arima.predict(1);
    const pred4h = arima.predict(4);
    const pred24h = arima.predict(24);

    // Calculate prediction intervals using residual variance
    const fitted = [];
    for (let i = 0; i < closes.length - 1; i++) {
      try {
        const pred = arima.predict(1);
        fitted.push(pred[0]);
        arima.train([closes[i]]);
      } catch (e) {
        fitted.push(closes[i]);
      }
    }

    const residuals = closes.slice(1).map((actual, i) => actual - fitted[i]);
    const rse = ss.standardDeviation(residuals.filter(r => !isNaN(r)));

    const confidenceMultiplier = 1.96;
    const ci1h = confidenceMultiplier * rse;
    const ci4h = confidenceMultiplier * rse * 1.5;
    const ci24h = confidenceMultiplier * rse * 2.5;

    // Calculate confidence based on model performance
    const mse = ss.mean(residuals.filter(r => !isNaN(r)).map(r => r * r));
    const variance = ss.variance(closes);
    const confidence = Math.max(0, 1 - (mse / variance));

    return {
      '1h': {
        price: pred1h[0],
        lower: pred1h[0] - ci1h,
        upper: pred1h[0] + ci1h,
        confidence: confidence
      },
      '4h': {
        price: pred4h[pred4h.length - 1],
        lower: pred4h[pred4h.length - 1] - ci4h,
        upper: pred4h[pred4h.length - 1] + ci4h,
        confidence: confidence * 0.9
      },
      '24h': {
        price: pred24h[pred24h.length - 1],
        lower: pred24h[pred24h.length - 1] - ci24h,
        upper: pred24h[pred24h.length - 1] + ci24h,
        confidence: confidence * 0.8
      }
    };
  } catch (error) {
    logger.warn('ARIMA prediction failed, falling back to linear regression', {
      error: error.message
    });
    // Fallback to linear regression
    return predictWithLinearRegression(closes, options);
  }
}

/**
 * Combine predictions from multiple methods (ensemble)
 */
function combinePredictions(linear, arima) {
  const combine = (l, a) => ({
    price: (l.price + a.price) / 2,
    lower: Math.min(l.lower, a.lower),
    upper: Math.max(l.upper, a.upper),
    confidence: (l.confidence + a.confidence) / 2
  });

  return {
    '1h': combine(linear['1h'], arima['1h']),
    '4h': combine(linear['4h'], arima['4h']),
    '24h': combine(linear['24h'], arima['24h'])
  };
}

/**
 * Calculate accuracy metrics
 */
function calculateAccuracy(closes, method = 'linear') {
  if (closes.length < 30) {
    return {
      rmse: null,
      mae: null,
      mape: null,
      r_squared: null
    };
  }

  // Use last 20% of data for testing
  const splitPoint = Math.floor(closes.length * 0.8);
  const trainData = closes.slice(0, splitPoint);
  const testData = closes.slice(splitPoint);

  // Train on training data
  let predictions = [];
  
  if (method === 'linear' || method === 'hybrid') {
    const data = trainData.map((price, index) => [index, price]);
    const result = regression.linear(data);
    
    // Predict test data
    for (let i = 0; i < testData.length; i++) {
      const pred = result.predict(splitPoint + i)[1];
      predictions.push(pred);
    }
  } else {
    // ARIMA predictions
    try {
      const arima = new ARIMA({ p: 5, d: 1, q: 2, verbose: false });
      arima.train(trainData);
      
      for (let i = 0; i < testData.length; i++) {
        const pred = arima.predict(1);
        predictions.push(pred[0]);
        if (i < testData.length - 1) {
          arima.train([testData[i]]);
        }
      }
    } catch (error) {
      // Fallback to linear
      const data = trainData.map((price, index) => [index, price]);
      const result = regression.linear(data);
      for (let i = 0; i < testData.length; i++) {
        const pred = result.predict(splitPoint + i)[1];
        predictions.push(pred);
      }
    }
  }

  // Calculate metrics
  const errors = testData.map((actual, i) => actual - predictions[i]);
  const squaredErrors = errors.map(e => e * e);
  const absoluteErrors = errors.map(e => Math.abs(e));
  const percentageErrors = testData.map((actual, i) => 
    Math.abs((actual - predictions[i]) / actual) * 100
  );

  const rmse = Math.sqrt(ss.mean(squaredErrors));
  const mae = ss.mean(absoluteErrors);
  const mape = ss.mean(percentageErrors);

  // Calculate R-squared
  const meanActual = ss.mean(testData);
  const ssTot = testData.reduce((sum, val) => sum + Math.pow(val - meanActual, 2), 0);
  const ssRes = squaredErrors.reduce((sum, val) => sum + val, 0);
  const r2 = 1 - (ssRes / ssTot);

  // Calculate RMSE percentage
  const meanPrice = ss.mean(testData);
  const rmsePercent = (rmse / meanPrice) * 100;

  return {
    rmse,
    rmse_percent: rmsePercent,
    mae,
    mape,
    r_squared: r2,
    test_samples: testData.length
  };
}

/**
 * Train and evaluate model on historical data
 * @param {Array} ohlcv - Historical OHLCV data
 * @param {object} options - Training options
 * @returns {object} - Training results and model performance
 */
export function trainModel(ohlcv, options = {}) {
  if (!ohlcv || ohlcv.length < 50) {
    throw new Error('Insufficient data for model training (minimum 50 data points required)');
  }

  const closes = ohlcv.map(candle => candle[4]);
  const method = options.method || 'hybrid';

  // Split data into train/test (80/20)
  const splitPoint = Math.floor(closes.length * 0.8);
  const trainData = closes.slice(0, splitPoint);
  const testData = closes.slice(splitPoint);

  logger.info('Training price prediction model', {
    method,
    totalSamples: closes.length,
    trainSamples: trainData.length,
    testSamples: testData.length
  });

  // Train models
  const linearModel = trainLinearModel(trainData);
  const arimaModel = trainARIMAModel(trainData, options);

  // Evaluate on test data
  const linearAccuracy = evaluateModel(linearModel, testData, splitPoint, 'linear');
  const arimaAccuracy = evaluateModel(arimaModel, testData, splitPoint, 'arima');

  // Determine best model
  const bestModel = linearAccuracy.rmse_percent < arimaAccuracy.rmse_percent ? 'linear' : 'arima';

  return {
    method,
    models: {
      linear: {
        equation: linearModel.equation,
        r2: linearModel.r2,
        accuracy: linearAccuracy
      },
      arima: {
        parameters: arimaModel.parameters,
        accuracy: arimaAccuracy
      }
    },
    best_model: bestModel,
    recommendation: bestModel === 'linear' ? 
      'Linear regression recommended for this dataset' : 
      'ARIMA recommended for this dataset',
    training_complete: true,
    timestamp: new Date().toISOString()
  };
}

/**
 * Train linear regression model
 */
function trainLinearModel(data) {
  const points = data.map((price, index) => [index, price]);
  const result = regression.linear(points);
  return result;
}

/**
 * Train ARIMA model
 */
function trainARIMAModel(data, options = {}) {
  const p = options.arimaP || 5;
  const d = options.arimaD || 1;
  const q = options.arimaQ || 2;

  try {
    const arima = new ARIMA({ p, d, q, verbose: false });
    arima.train(data);
    
    return {
      model: arima,
      parameters: { p, d, q }
    };
  } catch (error) {
    logger.warn('ARIMA training failed', { error: error.message });
    return {
      model: null,
      parameters: { p, d, q },
      error: error.message
    };
  }
}

/**
 * Evaluate model on test data
 */
function evaluateModel(model, testData, offset, type) {
  const predictions = [];

  if (type === 'linear') {
    for (let i = 0; i < testData.length; i++) {
      const pred = model.predict(offset + i)[1];
      predictions.push(pred);
    }
  } else {
    // ARIMA
    if (!model.model) {
      return { rmse: Infinity, rmse_percent: Infinity, mae: Infinity, mape: Infinity, r_squared: 0 };
    }

    try {
      for (let i = 0; i < testData.length; i++) {
        const pred = model.model.predict(1);
        predictions.push(pred[0]);
        if (i < testData.length - 1) {
          model.model.train([testData[i]]);
        }
      }
    } catch (error) {
      return { rmse: Infinity, rmse_percent: Infinity, mae: Infinity, mape: Infinity, r_squared: 0 };
    }
  }

  // Calculate metrics
  const errors = testData.map((actual, i) => actual - predictions[i]);
  const squaredErrors = errors.map(e => e * e);
  const absoluteErrors = errors.map(e => Math.abs(e));
  const percentageErrors = testData.map((actual, i) => 
    Math.abs((actual - predictions[i]) / actual) * 100
  );

  const rmse = Math.sqrt(ss.mean(squaredErrors));
  const mae = ss.mean(absoluteErrors);
  const mape = ss.mean(percentageErrors);

  const meanActual = ss.mean(testData);
  const ssTot = testData.reduce((sum, val) => sum + Math.pow(val - meanActual, 2), 0);
  const ssRes = squaredErrors.reduce((sum, val) => sum + val, 0);
  const r2 = 1 - (ssRes / ssTot);

  const rmsePercent = (rmse / meanActual) * 100;

  return {
    rmse,
    rmse_percent: rmsePercent,
    mae,
    mape,
    r_squared: r2
  };
}

/**
 * Generate mock predictions for development/testing
 */
export function generateMockPredictions(currentPrice) {
  const randomChange = () => (Math.random() - 0.48) * currentPrice * 0.02; // Slight upward bias

  const pred1h = currentPrice + randomChange();
  const pred4h = currentPrice + randomChange() * 2;
  const pred24h = currentPrice + randomChange() * 4;

  const ci = currentPrice * 0.02; // 2% confidence interval

  return {
    current_price: currentPrice,
    predictions: {
      '1h': {
        price: pred1h,
        lower: pred1h - ci,
        upper: pred1h + ci,
        confidence: 0.75
      },
      '4h': {
        price: pred4h,
        lower: pred4h - ci * 1.5,
        upper: pred4h + ci * 1.5,
        confidence: 0.70
      },
      '24h': {
        price: pred24h,
        lower: pred24h - ci * 2.5,
        upper: pred24h + ci * 2.5,
        confidence: 0.65
      }
    },
    method: 'mock',
    accuracy: {
      rmse: currentPrice * 0.03,
      rmse_percent: 3.0,
      mae: currentPrice * 0.02,
      mape: 2.0,
      r_squared: 0.85
    },
    timestamp: new Date().toISOString()
  };
}

export default {
  predictPrices,
  trainModel,
  calculateAccuracy,
  generateMockPredictions
};
