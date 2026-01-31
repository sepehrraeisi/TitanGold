/**
 * Content Negotiation Middleware (API-005)
 * Supports JSON and CSV export formats for agent results
 * 
 * Usage:
 *   router.get('/results', contentNegotiation(['json', 'csv']), handler);
 * 
 * Client specifies format via Accept header:
 *   Accept: application/json (default)
 *   Accept: text/csv (CSV export)
 */

import { logger } from '../services/logger.js';

/**
 * Convert agent result to CSV format
 * @param {Object|Array} data - Agent result data
 * @param {string} agentKey - Agent identifier for context
 * @returns {string} CSV formatted string
 */
function convertToCSV(data, agentKey = 'unknown') {
  try {
    // Handle array of results
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return 'No data available\n';
      }
      
      // Use first item to determine headers
      const headers = Object.keys(data[0]);
      const csvHeaders = headers.join(',');
      const csvRows = data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle nested objects, arrays, null/undefined
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
          return String(value).replace(/"/g, '""');
        }).map(v => `"${v}"`).join(',')
      );
      
      return [csvHeaders, ...csvRows].join('\n');
    }
    
    // Handle single result object
    if (data && typeof data === 'object') {
      // Special handling for agent result structure
      // Check for common agent result fields: signal, confidence, indicators, result, opportunities, score
      const hasAgentFields = (
        data.signal !== undefined ||
        data.confidence !== undefined ||
        data.indicators !== undefined ||
        data.result !== undefined ||
        data.opportunities !== undefined ||
        data.score !== undefined ||
        data.agent_key !== undefined
      );
      
      if (hasAgentFields) {
        return convertAgentResultToCSV(data, agentKey);
      }
      
      // Generic object to CSV
      const headers = Object.keys(data);
      const values = headers.map(key => {
        const value = data[key];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
        return String(value).replace(/"/g, '""');
      }).map(v => `"${v}"`);
      
      return headers.join(',') + '\n' + values.join(',') + '\n';
    }
    
    return 'No data available\n';
  } catch (error) {
    logger.error('CSV conversion error:', error);
    return 'Error converting data to CSV\n';
  }
}

/**
 * Convert agent analysis result to CSV format
 * Handles indicators, signals, and metadata
 * @param {Object} result - Agent result
 * @param {string} agentKey - Agent identifier
 * @returns {string} CSV formatted string
 */
function convertAgentResultToCSV(result, agentKey) {
  const lines = [];
  
  // Header section
  lines.push('# TitanGold Agent Analysis Export');
  lines.push(`# Agent: ${result.agent_key || agentKey || 'Unknown'}`);
  lines.push(`# Timestamp: ${result.timestamp || new Date().toISOString()}`);
  lines.push(`# Symbol: ${result.symbol || 'N/A'}`);
  lines.push(`# Timeframe: ${result.timeframe || 'N/A'}`);
  lines.push('');
  
  // Summary section
  lines.push('## Summary');
  lines.push('Metric,Value');
  lines.push(`Signal,"${result.signal || 'N/A'}"`);
  lines.push(`Confidence,${result.confidence || 0}`);
  if (result.accuracy) lines.push(`Accuracy,${result.accuracy}`);
  if (result.priceTarget) lines.push(`Price Target,${result.priceTarget}`);
  lines.push('');
  
  // Indicators section
  if (result.indicators && Array.isArray(result.indicators) && result.indicators.length > 0) {
    lines.push('## Indicators');
    lines.push('Indicator ID,Value,Signal,Weight');
    
    result.indicators.forEach(ind => {
      const id = ind.indicatorId || ind.name || 'Unknown';
      const value = ind.value !== undefined ? ind.value : 'N/A';
      const signal = ind.signal || 'neutral';
      const weight = ind.weight || 50;
      lines.push(`${id},${value},"${signal}",${weight}`);
    });
    lines.push('');
  }
  
  // Reasoning section
  if (result.reasoning) {
    lines.push('## Reasoning');
    lines.push(`"${result.reasoning}"`);
    lines.push('');
  }
  
  // Metadata section
  if (result._meta) {
    lines.push('## Metadata');
    lines.push('Key,Value');
    Object.entries(result._meta).forEach(([key, value]) => {
      lines.push(`"${key}","${value}"`);
    });
    lines.push('');
  }
  
  // Special handling for arbitrage results
  if (result.opportunities && Array.isArray(result.opportunities)) {
    lines.push('## Arbitrage Opportunities');
    lines.push('Exchange Pair,Profit BPS,Volume USDT,Buy Price,Sell Price,Type');
    
    result.opportunities.forEach(opp => {
      const pair = `${opp.buyExchange}→${opp.sellExchange}` || 'N/A';
      const profitBps = opp.profitBps || 0;
      const volumeUsdt = opp.volumeUsdt || 0;
      const buyPrice = opp.buyPrice || 0;
      const sellPrice = opp.sellPrice || 0;
      const type = opp.type || 'spot';
      lines.push(`"${pair}",${profitBps},${volumeUsdt},${buyPrice},${sellPrice},"${type}"`);
    });
    lines.push('');
  }
  
  // Special handling for fundamental results
  if (result.score && typeof result.score === 'object') {
    lines.push('## Fundamental Scores');
    lines.push('Category,Score');
    Object.entries(result.score).forEach(([category, score]) => {
      lines.push(`"${category}",${score}`);
    });
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Content negotiation middleware factory
 * @param {Array<string>} supportedFormats - Supported formats (e.g., ['json', 'csv'])
 * @returns {Function} Express middleware
 */
export function contentNegotiation(supportedFormats = ['json', 'csv']) {
  return (req, res, next) => {
    // Parse Accept header
    const acceptHeader = req.get('Accept') || 'application/json';
    
    // Determine requested format
    let format = 'json'; // default
    
    if (acceptHeader.includes('text/csv') || acceptHeader.includes('application/csv')) {
      if (supportedFormats.includes('csv')) {
        format = 'csv';
      }
    } else if (acceptHeader.includes('application/json') || acceptHeader.includes('*/*')) {
      format = 'json';
    }
    
    // Store format in request for handler
    req.responseFormat = format;
    
    // Override res.json to handle CSV conversion
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      if (req.responseFormat === 'csv') {
        // Convert to CSV
        const agentKey = data.agent_key || req.params?.id || 'agent';
        const csv = convertToCSV(data, agentKey);
        
        // Set CSV headers
        res.set('Content-Type', 'text/csv; charset=utf-8');
        res.set('Content-Disposition', `attachment; filename="agent-result-${Date.now()}.csv"`);
        
        logger.info(`📊 Exporting agent result as CSV (${csv.length} bytes)`);
        
        return res.send(csv);
      }
      
      // Default JSON response
      return originalJson(data);
    };
    
    next();
  };
}

/**
 * Helper: Manual CSV conversion for direct use
 * @param {Object} data - Data to convert
 * @param {string} agentKey - Agent identifier
 * @returns {string} CSV string
 */
export function toCSV(data, agentKey) {
  return convertToCSV(data, agentKey);
}

export default {
  contentNegotiation,
  toCSV
};
