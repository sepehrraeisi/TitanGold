# Agent Comparison Feature Documentation

## Overview

The Agent Comparison feature allows TitanGold users to compare 2-3 AI agents side-by-side to evaluate their performance, capabilities, and configurations. This feature helps users make informed decisions about which agents to deploy for their trading strategies.

**Date**: 2026-01-31  
**Task**: FRONTEND-012  
**Status**: Production Ready

---

## Table of Contents

1. [Features](#features)
2. [User Interface](#user-interface)
3. [Comparison Metrics](#comparison-metrics)
4. [Views](#views)
5. [Export Functionality](#export-functionality)
6. [Usage Guide](#usage-guide)
7. [Integration](#integration)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Features

### Core Features

1. **Agent Selection (DoD #1)**
   - Select 2-3 agents from available list
   - Visual indication of selected agents
   - Clear selection button
   - Maximum 3 agents limit enforced

2. **Side-by-Side Comparison (DoD #2)**
   - Three comparison views: Overview, Performance, Config
   - Tabular layout for easy scanning
   - Responsive grid layout for mobile devices
   - Real-time metric updates

3. **Difference Highlighting (DoD #3)**
   - Best values highlighted with green background
   - Visual indicators (⭐) for best performance
   - Color-coded metrics (green for positive, red for negative)
   - Automatic calculation of best/worst values

4. **Export Functionality (DoD #4)**
   - One-click export to text file
   - Comprehensive report generation
   - Timestamped exports
   - Includes all metrics and comparisons

5. **Documentation (DoD #5)**
   - This comprehensive guide
   - Inline tooltips and help text
   - User-friendly error messages
   - Integration examples

---

## User Interface

### Layout Components

```
┌─────────────────────────────────────────────────────┐
│ Header: Agent Comparison                            │
│ Subtitle: Select up to 3 agents to compare          │
├─────────────────────────────────────────────────────┤
│ Agent Selection Grid (2/3 selected)                 │
│ [Agent 1✓] [Agent 2✓] [Agent 3 ] [Agent 4 ]...     │
│                              [Clear Selection]       │
├─────────────────────────────────────────────────────┤
│ Tabs: [Overview] [Performance] [Config]             │
│                              [Export Report]         │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Comparison Table or Cards                           │
│                                                      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Color Scheme

- **Primary**: Yellow (#EAB308) - TitanGold brand color
- **Success**: Green (#16A34A) - Best values, positive metrics
- **Warning**: Yellow (#CA8A04) - Training status, moderate values
- **Danger**: Red (#DC2626) - Poor performance, errors
- **Neutral**: Gray (#6B7280) - Inactive agents, N/A values

---

## Comparison Metrics

### Overview Metrics

| Metric | Description | Format | Higher is Better |
|--------|-------------|--------|------------------|
| Status | Current agent status (active/inactive/training) | Text | N/A |
| Level | Agent expertise level (Expert/Advanced/Intermediate) | Text | N/A |
| Decisions | Total number of decisions made | Number | Yes |
| Accuracy | Overall prediction accuracy | Percentage | Yes |
| Win Rate | Percentage of successful trades | Percentage | Yes |
| Total Signals | Number of trading signals generated | Number | Yes |
| Sharpe Ratio | Risk-adjusted return metric | Number | Yes |
| Profit Factor | Ratio of gross profit to gross loss | Number | Yes |
| Max Drawdown | Largest peak-to-trough decline | Percentage | No (lower is better) |

### Performance Metrics

**Real-time Performance Data**:
- Total Signals
- Successful Signals
- Win Rate
- Sharpe Ratio
- Profit Factor

**Recent Performance** (Last 24h/7d/30d):
- Number of signals
- Win rate percentage
- Trend indicators

### Configuration Details

- **Capabilities**: List of agent-specific capabilities
- **Status**: Current operational status
- **Level**: Expertise classification
- **Last Update**: Most recent update timestamp

---

## Views

### 1. Overview View

**Purpose**: High-level comparison of key metrics across all selected agents.

**Layout**: Table format with metrics in rows and agents in columns.

**Features**:
- All metrics displayed in single view
- Best values highlighted
- Easy to scan and compare
- Responsive on all devices

**Example**:
```
Metric          | Agent 1      | Agent 2      | Agent 3
----------------|--------------|--------------|-------------
Status          | active       | active       | training
Win Rate        | 78.5% ⭐     | 72.3%        | 65.1%
Sharpe Ratio    | 2.45 ⭐      | 1.89         | 1.56
```

### 2. Performance View

**Purpose**: Detailed performance analysis with historical data.

**Layout**: Card-based grid layout (1-3 columns based on screen size).

**Features**:
- Detailed performance metrics per agent
- Recent performance breakdown (24h/7d/30d)
- Visual separation of metric categories
- No performance data fallback message

**Data Displayed**:
- Total Signals
- Successful Signals
- Win Rate
- Sharpe Ratio
- Profit Factor
- Recent Performance (24h/7d/30d)

### 3. Config View

**Purpose**: Compare agent capabilities and configuration settings.

**Layout**: Card-based grid layout with capability lists.

**Features**:
- Capabilities listed per agent
- Status and level information
- Last update timestamp
- Color-coded status indicators

---

## Export Functionality

### Export Format

The export generates a plain text report (.txt) with the following structure:

```
TitanGold Agent Comparison Report
Generated: 2026-01-31T12:34:56.789Z

================================================================================

Selected Agents (3):
  1. Technical Analysis Agent (Technical Analysis)
  2. Risk Management Agent (Risk Management)
  3. Sentiment Analysis Agent (Sentiment Analysis)

================================================================================

COMPARISON OVERVIEW
================================================================================

Status:
  Technical Analysis Agent: active
  Risk Management Agent: active
  Sentiment Analysis Agent: training

Win Rate:
  Technical Analysis Agent: 78.50% ⭐
  Risk Management Agent: 72.30%
  Sentiment Analysis Agent: 65.10%

...

================================================================================

RECENT PERFORMANCE (Last 24h/7d/30d)
================================================================================

Technical Analysis Agent:
  Last 24h: 45 signals, 80.00% win rate
  Last 7d:  312 signals, 78.85% win rate
  Last 30d: 1,245 signals, 78.50% win rate

...

================================================================================

CAPABILITIES
================================================================================

Technical Analysis Agent:
  • RSI Analysis
  • MACD Signals
  • Bollinger Bands
  • Moving Averages
  ...

End of Report
```

### Export Process

1. User clicks "Export Report" button
2. System generates report content
3. Creates downloadable text file
4. File named: `agent-comparison-YYYY-MM-DD.txt`
5. Success/failure notification displayed

---

## Usage Guide

### Basic Usage

1. **Open Comparison View**
   - Navigate to AI Agents section
   - Click "Compare Agents" button
   - Comparison modal opens

2. **Select Agents**
   - Click on 2-3 agent cards
   - Selected agents highlighted in yellow
   - Maximum 3 agents enforced
   - Click again to deselect

3. **View Comparisons**
   - Overview tab: See all metrics at a glance
   - Performance tab: Detailed performance data
   - Config tab: Capabilities and settings

4. **Export Report**
   - Click "Export Report" button
   - Report downloads automatically
   - View in any text editor

5. **Close Comparison**
   - Click X button in top-right
   - Or click outside modal (if implemented)

### Advanced Usage

**Quick Comparison**:
```typescript
// Example: Compare top 3 agents by win rate
const topAgents = agents
  .sort((a, b) => 
    (b.performanceMetrics?.winRate || 0) - 
    (a.performanceMetrics?.winRate || 0)
  )
  .slice(0, 3);

<AgentComparison availableAgents={topAgents} />
```

**Filtered Comparison**:
```typescript
// Example: Compare only active agents
const activeAgents = agents.filter(a => a.status === 'active');

<AgentComparison availableAgents={activeAgents} />
```

---

## Integration

### Props Interface

```typescript
interface AgentComparisonProps {
  availableAgents: AIAgent[];  // List of agents to choose from
  onClose?: () => void;        // Callback when modal is closed
}
```

### Usage Example

```typescript
import React, { useState } from 'react';
import AgentComparison from './components/ai/AgentComparison';
import { AIAgent } from './types';

function MyComponent() {
  const [showComparison, setShowComparison] = useState(false);
  const [agents, setAgents] = useState<AIAgent[]>([]);

  // Load agents from API
  useEffect(() => {
    loadAgents().then(setAgents);
  }, []);

  return (
    <>
      <button onClick={() => setShowComparison(true)}>
        Compare Agents
      </button>

      {showComparison && (
        <AgentComparison
          availableAgents={agents}
          onClose={() => setShowComparison(false)}
        />
      )}
    </>
  );
}
```

### Required Dependencies

- **React**: ^18.0.0
- **TypeScript**: ^5.0.0
- **Tailwind CSS**: ^3.0.0
- **Language Context**: For i18n support

### Type Requirements

Ensure your `types.ts` includes:
- `AIAgent` interface
- `AgentPerformanceMetrics` interface
- All agent-specific config interfaces

---

## Best Practices

### For Users

1. **Agent Selection**
   - Compare agents with similar roles for meaningful insights
   - Select agents with recent activity for accurate data
   - Use 2-3 agents (not just 2) for better perspective

2. **Metric Interpretation**
   - Green highlights indicate best values among selected agents
   - Consider multiple metrics, not just one
   - Review recent performance trends (24h/7d/30d)

3. **Export Reports**
   - Export before making configuration changes
   - Save reports for historical comparison
   - Share reports with team members

### For Developers

1. **Component Integration**
   - Always provide fresh agent data
   - Handle loading states in parent component
   - Implement error boundaries

2. **Performance**
   - Limit availableAgents to reasonable number (<20)
   - Use React.memo for optimization
   - Avoid unnecessary re-renders

3. **Customization**
   - Extend `ComparisonMetric` interface for custom metrics
   - Add new views by extending `comparisonView` type
   - Customize export format in `generateReportContent`

---

## Troubleshooting

### Common Issues

**Issue**: "No performance data available" message

**Cause**: Agent doesn't have `performanceMetrics` populated

**Solution**: 
- Ensure agent has been run at least once
- Check API response includes performance data
- Verify agent type supports performance metrics

---

**Issue**: Export button disabled

**Cause**: Less than 2 agents selected or export in progress

**Solution**:
- Select at least 2 agents
- Wait for previous export to complete
- Check console for errors

---

**Issue**: Metrics showing N/A

**Cause**: Metric not applicable to agent type or no data

**Solution**:
- Some metrics only apply to certain agent types
- Run agent to generate data
- Check agent configuration

---

**Issue**: Best value highlighting incorrect

**Cause**: Mixed data types or null values

**Solution**:
- Verify all agents have numeric values for metric
- Check `isHigherBetter` flag is correct
- Review `isBestValue` function logic

---

## API Integration

### Expected Agent Data Structure

```typescript
{
  id: "1",
  name: "Technical Analysis Agent",
  role: "Technical Analysis",
  status: "active",
  level: "Expert",
  decisions: 5432,
  accuracy: 78.5,
  capabilities: ["RSI", "MACD", "Bollinger Bands"],
  lastUpdate: "2026-01-31",
  performanceMetrics: {
    totalSignals: 1245,
    successfulSignals: 978,
    winRate: 78.5,
    averageConfidence: 85.2,
    profitFactor: 2.45,
    sharpeRatio: 2.45,
    maxDrawdown: 12.3,
    recentPerformance: {
      last24h: { signals: 45, winRate: 80.0 },
      last7d: { signals: 312, winRate: 78.85 },
      last30d: { signals: 1245, winRate: 78.5 }
    }
  }
}
```

---

## Future Enhancements

### Planned Features (Follow-up Tasks)

1. **FRONTEND-012-01**: Add chart visualizations for metric comparisons
2. **FRONTEND-012-02**: Implement CSV/Excel export formats
3. **FRONTEND-012-03**: Add filtering by agent type/status
4. **FRONTEND-012-04**: Save comparison presets
5. **FRONTEND-012-05**: Add historical comparison (compare same agent over time)
6. **FRONTEND-012-06**: Implement comparison sharing (generate shareable links)
7. **FRONTEND-012-07**: Add custom metric definitions

### Potential Improvements

- Interactive charts for performance trends
- Real-time updates during comparison
- Comparison templates for common scenarios
- PDF export with charts and branding
- Comparison recommendations based on goals

---

## Glossary

**Win Rate**: Percentage of trades that resulted in profit

**Sharpe Ratio**: Risk-adjusted return metric (higher is better, >1 is good, >2 is excellent)

**Profit Factor**: Ratio of gross profit to gross loss (>1 means profitable, >2 is very good)

**Max Drawdown**: Largest peak-to-trough decline in portfolio value

**Accuracy**: Percentage of correct predictions (for ML agents)

**Signal**: Trading recommendation generated by agent

**Confidence**: Agent's certainty in its recommendation (0-100%)

---

## Support

For issues or questions:
- Check this documentation first
- Review console logs for errors
- Contact development team
- Submit issue on GitHub

---

## Changelog

### v1.0.0 (2026-01-31) - Initial Release
- ✅ DoD #1: Select 2-3 agents to compare
- ✅ DoD #2: Show results side-by-side
- ✅ DoD #3: Highlight differences (best values)
- ✅ DoD #4: Export comparison report (text format)
- ✅ DoD #5: Comprehensive documentation

---

## License

Copyright © 2026 TitanGold. All rights reserved.

---

**End of Documentation**
