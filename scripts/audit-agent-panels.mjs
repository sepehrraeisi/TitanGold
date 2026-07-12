#!/usr/bin/env node
/** Audit registered agents — backend module + frontend panel mapping */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const registrySrc = fs.readFileSync(path.join(root, 'backend/services/agentCapabilityRegistry.js'), 'utf8');
const keys = [...registrySrc.matchAll(/^\s+(\w+):\s*\{/gm)].map((m) => m[1]).filter((k) => k !== 'SIDE_EFFECT_CLASS');

const panelMap = {
  technical: 'TechnicalAnalysisAgentControl.tsx',
  risk: 'RiskManagementAgentControl.tsx',
  sentiment: 'SentimentAgentControl.tsx',
  pattern: 'PatternAgentControl.tsx',
  price_prediction: 'PricePredictionAgentControl.tsx',
  arbitrage: 'ArbitrageAgentControl.tsx',
  portfolio: 'PortfolioAllocationAgentControl.tsx',
  liquidity: 'LiquidityAgentControl.tsx',
  trend: 'TrendAgentControl.tsx',
  optimization: 'OptimizationAgentControl.tsx',
  order: 'OrderManagementAgentControl.tsx',
  fundamental: 'FundamentalAgentControl.tsx',
  market_intelligence: 'MarketIntelligenceAgentControl.tsx',
  volume: 'VolumeAgentControl.tsx',
  timing: 'TimingAgentControl.tsx',
};

const agentsDir = path.join(root, 'backend/services/agents');
const audit = keys.map((key) => {
  const modPath = path.join(agentsDir, `${key.replace(/_/g, '-')}.js`);
  const altPath = path.join(agentsDir, `${key}.js`);
  const moduleFile = fs.existsSync(modPath) ? modPath : fs.existsSync(altPath) ? altPath : null;
  const panel = panelMap[key] || null;
  const panelPath = panel ? path.join(root, 'components/ai', panel) : null;
  const panelSrc = panelPath && fs.existsSync(panelPath) ? fs.readFileSync(panelPath, 'utf8') : '';
  return {
    key,
    backendModule: moduleFile ? path.relative(root, moduleFile) : 'MISSING',
    frontendPanel: panel || 'MISSING',
    hasRunHandler: /handleRun|RunCycle|RunAnalysis|RunScan|RunOptimization|RunPrediction/.test(panelSrc),
    usesExecutionGate: /useAgentExecutionGate|AgentRunButton/.test(panelSrc),
    usesHardcodedRole: /role === ['"]admin|role === ['"]trader/.test(panelSrc),
  };
});

const out = path.join(root, 'docs/evidence/agent-audit.json');
fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), agents: audit }, null, 2));
console.log(`Audited ${audit.length} agents → ${out}`);
