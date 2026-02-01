# TitanGold Blue-Green Deployment Guide

**Task:** INFRA-010 - Implement Blue-Green Deployment  
**Version:** 1.0.0  
**Date:** 2026-01-31

## Overview

This guide covers the complete blue-green deployment strategy for TitanGold, enabling zero-downtime deployments with automatic rollback capabilities.

---

## Table of Contents

1. [What is Blue-Green Deployment?](#what-is-blue-green-deployment)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [Deployment Process](#deployment-process)
5. [Rollback Procedure](#rollback-procedure)
6. [CI/CD Integration](#cicd-integration)
7. [Monitoring and Verification](#monitoring-and-verification)
8. [Troubleshooting](#troubleshooting)

---

## What is Blue-Green Deployment?

Blue-green deployment is a release management strategy that reduces downtime and risk by running two identical production environments (blue and green). At any time, only one environment serves production traffic while the other is idle or ready for the next deployment.

### Benefits

✅ **Zero Downtime**: Switch traffic instantly between environments  
✅ **Easy Rollback**: Revert to previous version in seconds  
✅ **Safe Testing**: Test new version in production-like environment  
✅ **Reduced Risk**: Gradual traffic switching or instant cutover  
✅ **Database Migrations**: Test migrations on inactive environment first

### Key Concepts

- **Blue Environment**: Currently active, serving production traffic (port 5002)
- **Green Environment**: Inactive, ready for next deployment (port 5003)
- **Traffic Switch**: Atomic operation to redirect all traffic
- **Health Checks**: Verify new deployment before switching
- **Rollback**: Quick reversion to previous stable version

---

## Architecture

### Environment Structure

```
TitanGold Blue-Green Architecture

┌─────────────────────────────────────────────────┐
│              Load Balancer (Nginx)              │
│          (Traffic routing to active env)        │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐   ┌───────▼────────┐
│ Blue Env       │   │ Green Env      │
│ Port: 5002     │   │ Port: 5003     │
│ Status: ACTIVE │   │ Status: IDLE   │
│ Version: v1.0  │   │ Version: v1.1  │
└────────────────┘   └────────────────┘
```

### Directory Structure

```
/var/www/titangold/
├── blue/                    # Blue environment
│   ├── backend/
│   │   ├── server.js
│   │   ├── .env            # PORT=5002
│   │   └── ...
│   ├── dist/               # Frontend build
│   └── .pid                # Process ID file
├── green/                   # Green environment
│   ├── backend/
│   │   ├── server.js
│   │   ├── .env            # PORT=5003
│   │   └── ...
│   ├── dist/
│   └── .pid
├── infrastructure/
│   ├── blue-green-deploy.sh
│   ├── .deployment-state.json
│   └── ecosystem.config.js
└── logs/
    └── deployments/
```

### State Management

The deployment state is tracked in `.deployment-state.json`:

```json
{
  "active": "blue",
  "version": "v1.2.3",
  "timestamp": "2026-01-31T12:00:00Z",
  "blue": {
    "port": 5002,
    "directory": "/var/www/titangold/blue"
  },
  "green": {
    "port": 5003,
    "directory": "/var/www/titangold/green"
  }
}
```

---

## Setup Instructions

### Prerequisites

- Load balancer configured (INFRA-009 completed)
- Two separate environment directories
- PM2 or systemd for process management
- Git repository access
- Node.js 18+ installed

### Initial Setup

#### 1. Create Directory Structure

```bash
# Create environment directories
sudo mkdir -p /var/www/titangold/{blue,green}
sudo mkdir -p /var/log/titangold
sudo mkdir -p /var/www/titangold/logs/deployments

# Set permissions
sudo chown -R ubuntu:ubuntu /var/www/titangold
sudo chown -R ubuntu:ubuntu /var/log/titangold
```

#### 2. Clone Repository to Both Environments

```bash
# Clone to blue environment
git clone https://github.com/sepehrraeisi/TitanGold.git /var/www/titangold/blue
cd /var/www/titangold/blue
npm ci
npm run build
cd backend && npm ci

# Clone to green environment
git clone https://github.com/sepehrraeisi/TitanGold.git /var/www/titangold/green
cd /var/www/titangold/green
npm ci
npm run build
cd backend && npm ci
```

#### 3. Configure Environment Files

```bash
# Blue environment
cat > /var/www/titangold/blue/backend/.env << 'EOF'
NODE_ENV=production
PORT=5002
DATABASE_URL=postgresql://user:pass@localhost:5433/titangold_db
# ... other environment variables
EOF

# Green environment
cat > /var/www/titangold/green/backend/.env << 'EOF'
NODE_ENV=production
PORT=5003
DATABASE_URL=postgresql://user:pass@localhost:5433/titangold_db
# ... other environment variables
EOF
```

#### 4. Setup Process Manager

**Option A: Using PM2 (Recommended)**

```bash
# Install PM2 globally
sudo npm install -g pm2

# Copy ecosystem config
cp infrastructure/ecosystem.config.js /var/www/titangold/

# Start blue environment (active)
pm2 start /var/www/titangold/ecosystem.config.js --only titangold-blue

# Green will be started during first deployment
pm2 save
```

**Option B: Using Systemd**

```bash
# Copy service files
sudo cp infrastructure/systemd/titangold-blue.service /etc/systemd/system/
sudo cp infrastructure/systemd/titangold-green.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start blue
sudo systemctl enable titangold-blue
sudo systemctl start titangold-blue

# Enable green (but don't start yet)
sudo systemctl enable titangold-green
```

#### 5. Configure Nginx

Update nginx configuration to point to blue (active):

```nginx
upstream titangold_backend {
    least_conn;
    server localhost:5002 max_fails=3 fail_timeout=30s;  # Blue environment
    keepalive 32;
}
```

#### 6. Initialize Deployment State

```bash
cd /var/www/titangold/infrastructure

# Create initial state file
cat > .deployment-state.json << 'EOF'
{
  "active": "blue",
  "version": "initial",
  "timestamp": "2026-01-31T12:00:00Z",
  "blue": {
    "port": 5002,
    "directory": "/var/www/titangold/blue"
  },
  "green": {
    "port": 5003,
    "directory": "/var/www/titangold/green"
  }
}
EOF
```

---

## Deployment Process

### Manual Deployment

#### Basic Deployment

```bash
cd /var/www/titangold/infrastructure

# Deploy version v1.2.3
sudo ./blue-green-deploy.sh --version v1.2.3
```

#### Deployment with Options

```bash
# Skip tests (faster, but riskier)
sudo ./blue-green-deploy.sh --version v1.2.3 --skip-tests

# Force deployment even if tests fail
sudo ./blue-green-deploy.sh --version v1.2.3 --force

# Deploy to staging environment
sudo ./blue-green-deploy.sh --version v1.2.3 --env staging

# Skip health checks (not recommended)
sudo ./blue-green-deploy.sh --version v1.2.3 --skip-health
```

### Deployment Flow

The script automatically performs these steps:

1. **Determine Target Environment**
   - Identifies currently active environment (blue or green)
   - Selects inactive environment for deployment

2. **Deploy to Inactive Environment**
   - Clones/updates repository to target directory
   - Checks out specified version
   - Installs dependencies
   - Builds frontend
   - Runs database migrations
   - Updates environment configuration

3. **Run Tests**
   - Executes backend test suite
   - Executes frontend test suite
   - Fails deployment if tests fail (unless --force)

4. **Start New Environment**
   - Starts backend server on environment port
   - Waits for startup (5 seconds)

5. **Health Checks**
   - Polls /health endpoint
   - Retries 5 times with 10-second intervals
   - Verifies status=healthy and database=connected
   - Stops deployment if health check fails

6. **Switch Traffic**
   - Updates nginx upstream configuration
   - Points to new environment port
   - Tests nginx configuration
   - Reloads nginx (zero downtime)

7. **Drain Connections**
   - Waits 30 seconds for existing connections to complete

8. **Stop Old Environment**
   - Gracefully stops previous environment
   - Frees resources

9. **Update State**
   - Records new active environment
   - Saves version and timestamp

### Monitoring Deployment

```bash
# View deployment logs (real-time)
tail -f /var/www/titangold/logs/deployments/deploy_*.log

# Check deployment status
cat /var/www/titangold/infrastructure/.deployment-state.json

# View PM2 processes
pm2 list
pm2 logs

# View systemd status
sudo systemctl status titangold-blue
sudo systemctl status titangold-green
```

---

## Rollback Procedure

### Automatic Rollback

If deployment fails during health checks or traffic switch, the script automatically rolls back.

### Manual Rollback

To manually revert to the previous version:

```bash
cd /var/www/titangold/infrastructure

# Rollback to previous environment
sudo ./blue-green-deploy.sh --rollback
```

### Rollback Process

1. Identifies currently active environment
2. Switches to previously active environment
3. Verifies previous environment is healthy
4. Restarts if necessary
5. Switches traffic back
6. Updates state

### Rollback Time

- **Typical**: 5-10 seconds
- **With restart**: 15-30 seconds
- **Maximum**: 1 minute (includes health checks)

---

## CI/CD Integration

### GitHub Actions

The blue-green deployment is integrated with GitHub Actions for automated deployments.

#### Trigger Deployment

**On Push to Main:**
```bash
git push origin main
# Automatically triggers deployment
```

**Manual Trigger:**
1. Go to GitHub Actions
2. Select "Blue-Green Deployment" workflow
3. Click "Run workflow"
4. Choose environment and options
5. Click "Run workflow"

#### Workflow Steps

1. **Tests**: Run full test suite
2. **Build**: Build and package application
3. **Deploy**: Execute blue-green deployment on server
4. **Verify**: Run post-deployment smoke tests
5. **Rollback**: Automatic rollback on failure

#### Required Secrets

Configure these in GitHub repository settings:

- `SSH_PRIVATE_KEY`: SSH key for server access
- `SERVER_HOST`: Production server hostname/IP
- `SERVER_USER`: SSH username (e.g., ubuntu)

### Manual CI/CD Setup

If not using GitHub Actions, integrate with your CI/CD tool:

```bash
# Example Jenkins pipeline step
sh '''
  scp infrastructure/blue-green-deploy.sh user@server:/tmp/
  ssh user@server "sudo /tmp/blue-green-deploy.sh --version ${GIT_COMMIT}"
'''
```

---

## Monitoring and Verification

### Health Check Endpoint

The deployment script uses `/health` endpoint:

```bash
curl http://localhost:5002/health
curl http://localhost:5003/health
```

Expected response:
```json
{
  "status": "healthy",
  "api": "operational",
  "database": "connected",
  "timestamp": "2026-01-31T12:00:00Z",
  "uptime": 3600
}
```

### Verify Active Environment

```bash
# Check state file
cat /var/www/titangold/infrastructure/.deployment-state.json

# Check nginx upstream
sudo grep -A 5 "upstream titangold_backend" /etc/nginx/sites-available/titangold

# Check running processes
pm2 list
# or
ps aux | grep "node server.js"

# Check listening ports
sudo lsof -i :5002
sudo lsof -i :5003
```

### Log Files

```bash
# Deployment logs
ls -lh /var/www/titangold/logs/deployments/

# Application logs (PM2)
pm2 logs titangold-blue
pm2 logs titangold-green

# Application logs (systemd)
sudo journalctl -u titangold-blue -f
sudo journalctl -u titangold-green -f

# Nginx logs
sudo tail -f /var/log/nginx/titangold-access.log
sudo tail -f /var/log/nginx/titangold-error.log
```

### Metrics and Monitoring

```bash
# PM2 monitoring
pm2 monit

# Check CPU and memory
pm2 list
htop

# Check response times
curl -w "\nTime: %{time_total}s\n" http://localhost:5002/health
```

---

## Troubleshooting

### Common Issues

#### 1. Health Check Fails

**Symptoms**: Deployment fails at health check step

**Diagnosis**:
```bash
# Check if service is running
pm2 list
sudo systemctl status titangold-green

# Check logs
pm2 logs titangold-green --lines 50

# Manual health check
curl -v http://localhost:5003/health

# Check database connection
psql $DATABASE_URL -c "SELECT NOW()"
```

**Solutions**:
- Verify database is accessible
- Check environment variables in .env
- Ensure all dependencies are installed
- Verify migrations ran successfully
- Check firewall rules

#### 2. Port Already in Use

**Symptoms**: Cannot start environment, port conflict

**Diagnosis**:
```bash
# Check what's using the port
sudo lsof -i :5003

# Check PM2 processes
pm2 list

# Check systemd services
sudo systemctl status titangold-*
```

**Solutions**:
```bash
# Stop conflicting process
pm2 delete titangold-green
# or
sudo systemctl stop titangold-green

# Kill by port
sudo kill $(sudo lsof -t -i:5003)

# Retry deployment
sudo ./blue-green-deploy.sh --version v1.2.3
```

#### 3. Nginx Configuration Error

**Symptoms**: Traffic switch fails, nginx test fails

**Diagnosis**:
```bash
# Test nginx configuration
sudo nginx -t

# Check nginx error log
sudo tail -50 /var/log/nginx/error.log
```

**Solutions**:
```bash
# Restore backup configuration
sudo cp /etc/nginx/sites-available/titangold.backup.* /etc/nginx/sites-available/titangold

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

#### 4. Tests Fail

**Symptoms**: Deployment stops at test execution

**Diagnosis**:
```bash
# View test output
cat /var/www/titangold/logs/deployments/deploy_*.log | grep -A 20 "Running test"

# Run tests manually
cd /var/www/titangold/green/backend
npm test
```

**Solutions**:
- Fix failing tests
- Use `--skip-tests` for hotfix deployments (not recommended)
- Use `--force` to deploy despite test failures (risky)

#### 5. Database Migration Fails

**Symptoms**: Migration errors in logs

**Solutions**:
```bash
# Run migrations manually
cd /var/www/titangold/green/backend
npm run migrate

# Check migration status
npm run migrate:status

# Rollback migration if needed
npm run migrate:undo

# Retry deployment
sudo ./blue-green-deploy.sh --version v1.2.3
```

### Emergency Procedures

#### Quick Rollback

```bash
# Immediate rollback (bypasses checks)
cd /var/www/titangold/infrastructure
sudo ./blue-green-deploy.sh --rollback --skip-health
```

#### Manual Traffic Switch

```bash
# Edit nginx config manually
sudo nano /etc/nginx/sites-available/titangold

# Change upstream server port to 5002 or 5003
# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

#### Stop Both Environments

```bash
# PM2
pm2 delete all

# Systemd
sudo systemctl stop titangold-blue
sudo systemctl stop titangold-green

# Manual
sudo kill $(sudo lsof -t -i:5002)
sudo kill $(sudo lsof -t -i:5003)
```

---

## Best Practices

### Pre-Deployment

- [ ] Run tests locally before pushing
- [ ] Review database migrations
- [ ] Check for breaking changes
- [ ] Verify configuration changes
- [ ] Review deployment logs from previous deployments

### During Deployment

- [ ] Monitor deployment logs
- [ ] Watch application metrics
- [ ] Check error rates in monitoring tools
- [ ] Verify health endpoints
- [ ] Test critical user flows

### Post-Deployment

- [ ] Run smoke tests
- [ ] Monitor error logs
- [ ] Check application metrics
- [ ] Verify database queries
- [ ] Monitor user reports
- [ ] Document any issues

### Maintenance

- [ ] Regularly clean old log files
- [ ] Monitor disk space usage
- [ ] Keep dependencies updated
- [ ] Review and optimize deployment scripts
- [ ] Test rollback procedure periodically

---

## Advanced Topics

### Database Migration Strategy

For zero-downtime with database changes:

1. **Backward-compatible migrations**: Ensure new code works with old schema
2. **Multi-step deployments**: 
   - Step 1: Deploy code that works with both schemas
   - Step 2: Run migration
   - Step 3: Deploy code that uses new schema
3. **Feature flags**: Toggle new features without redeployment

### Canary Deployments

Gradually shift traffic to new version:

```nginx
upstream titangold_backend {
    server localhost:5002 weight=9;   # Blue: 90% traffic
    server localhost:5003 weight=1;   # Green: 10% traffic
}
```

### A/B Testing

Route traffic based on user characteristics or random selection.

---

## References

- [Martin Fowler: Blue-Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

**Last Updated:** 2026-01-31  
**Task:** INFRA-010 - Implement Blue-Green Deployment  
**Status:** Complete
