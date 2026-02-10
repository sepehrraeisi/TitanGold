# TitanGold User Guide

Welcome to the TitanGold User Guide. This document will help you get started with the platform and make the most of its AI-powered trading features.

## 1. Getting Started

### System Requirements
-   **Browser**: Modern browser (Chrome 90+, Firefox 90+, Edge).
-   **Screen Resolution**: 1366x768 minimum recommended.

### Accessing the Platform
1.  Navigate to the deployed URL (e.g., `https://app.titangold.com` or `localhost:5173` for dev).
2.  If looking at the login screen, enter your credentials.
    -   *Default Dev Login*: `dev` / `password`

## 2. Platform Overview

The main interface consists of a side navigation bar and a content area.

-   **Dashboard**: Overview of market performance and your portfolio summary.
-   **AI Center**: Manage and monitor AI trading agents.
-   **Data Hub**: Configure data sources and categories.
-   **Trading**: Manual trading interface and chart view.

## 3. Using the AI Center

The AI Center is the heart of automated analysis.

### Managing Agents
-   **Card View**: See all agents with their current status (Active/Inactive), Accuracy, and Profit range.
-   **Control Panel**: Click "Control Panel" on any agent card to:
    -   **Overview**: Real-time metrics and recent signals.
    -   **History**: Log of past decisions.
    -   **Settings**: Configure agent-specific parameters (e.g., Risk Level, Timeframe).
    -   **Run Analysis**: Manually trigger an analysis cycle.

## 4. Using the Data Hub

The Data Hub manages the external information that feeds the AI agents.

### Data Sources
1.  Navigate to **Data Hub** > **Data Sources**.
2.  **Add Source**: Click "Add Source" to connect a new API, RSS feed, or WebSocket.
3.  **View Data**: Click "View Data" on a source to see raw collected items.
4.  **Export**:
    -   Click **Export CSV** in the header to download a list of all sources.
    -   Inside "View Data", use **Export JSON** or **Export CSV** to download collected data.

### Data Categories
Organize sources into categories (e.g., Market Data, News, Social Sentiment).
-   Use **Add Category** to define new logical groups.

## 5. Troubleshooting & FAQ

### Common Issues

**Q: Why is my agent status "Offline"?**
A: Check if the backend service is running. If you are an admin, verify the `ENGINE_ENABLED` flag.

**Q: Why can't I export data?**
A: Ensure your browser is not blocking pop-ups. Large datasets may take a few seconds to generate.

**Q: Charts are not updating.**
A: Check your internet connection. The platform uses WebSockets for real-time updates; if disconnected, a "Connecting..." badge usually appears.

---
*For further assistance, contact support@titangold.com.*
