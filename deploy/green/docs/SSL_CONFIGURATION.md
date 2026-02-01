# SSL/TLS Configuration Documentation

**Task**: INFRA-002  
**Date**: 2026-01-06  
**Status**: ✅ VERIFIED AND CONFIGURED

## Overview

This document describes the SSL/TLS configuration for the TitanGold trading system, ensuring secure connections across all components.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet (HTTPS)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼ HTTPS (TLS 1.2/1.3)
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare CDN                           │
│              (DDoS Protection + SSL Proxy)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼ HTTPS (Origin Certificate)
┌─────────────────────────────────────────────────────────────┐
│                   Nginx Reverse Proxy                       │
│                  (SSL Termination Point)                    │
│                   titan.zala.ir:443                         │
│                                                             │
│  - Cloudflare Origin Certificate                           │
│  - TLS 1.2/1.3                                             │
│  - HTTP/2 enabled                                          │
└─────────────────┬─────────────────┬─────────────────────────┘
                  │                 │
                  ▼ HTTP            ▼ HTTP
         ┌────────────────┐  ┌──────────────┐
         │    Backend     │  │   Frontend   │
         │  localhost:5002│  │localhost:3000│
         └────────┬───────┘  └──────────────┘
                  │
                  ▼ SSL (self-signed)
         ┌────────────────────┐
         │   PostgreSQL DB    │
         │   localhost:5433   │
         │   SSL: enabled     │
         └────────────────────┘
                  
         External APIs (HTTPS)
                  │
                  ▼ HTTPS (verified)
         ┌────────────────────┐
         │   MEXC Exchange    │
         │   api.mexc.com     │
         └────────────────────┘
```

## SSL/TLS Configuration Details

### 1. PostgreSQL Database Connection

**Status**: ✅ SSL ENABLED

#### Configuration
- **File**: `backend/database/db.js`
- **SSL Mode**: Enabled (configurable via `DB_SSL` environment variable)
- **Certificate Validation**: Flexible (configurable via `DB_SSL_REJECT_UNAUTHORIZED`)
- **Current Setup**: SSL enabled with self-signed certificate (localhost)

#### Environment Variables
```bash
DB_SSL=true                          # Enable SSL for PostgreSQL connection
DB_SSL_REJECT_UNAUTHORIZED=false     # Allow self-signed certificates (localhost)
```

#### Verification
```bash
# Check if PostgreSQL has SSL enabled
sudo -u postgres psql -p 5433 -d titangold_db -c "SHOW ssl;"
# Result: ssl = on
```

#### Database Connection Code
```javascript
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'titangold_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // SSL Configuration
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  } : false,
});
```

#### Production Recommendations
For production deployments with remote database servers:
1. Set `DB_SSL_REJECT_UNAUTHORIZED=true` for proper certificate validation
2. Use `sslmode=verify-full` for maximum security
3. Provide CA certificate path if using custom CA
4. Store certificates securely outside the codebase

---

### 2. API Endpoints (Backend/Frontend)

**Status**: ✅ HTTPS VIA REVERSE PROXY

#### Configuration
- **Reverse Proxy**: Nginx
- **SSL Termination**: At Nginx level
- **Certificate**: Cloudflare Origin Certificate
- **Protocols**: TLS 1.2, TLS 1.3
- **HTTP/2**: Enabled

#### Nginx SSL Configuration
- **File**: `/etc/nginx/sites-enabled/titan-zala`
- **Certificate**: `/etc/ssl/cloudflare/zala.ir.origin.pem`
- **Private Key**: `/etc/ssl/cloudflare/zala.ir.origin.key`

```nginx
# SSL Configuration
listen 443 ssl http2;
listen [::]:443 ssl http2;

ssl_certificate /etc/ssl/cloudflare/zala.ir.origin.pem;
ssl_certificate_key /etc/ssl/cloudflare/zala.ir.origin.key;

ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers off;

ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
```

#### Backend Server Configuration
- **Backend Port**: 5002 (HTTP internally)
- **Frontend Port**: 3000 (HTTP internally)
- **Trust Proxy**: Enabled (`app.set('trust proxy', 1)`)

The backend application listens on HTTP internally, with SSL termination handled by Nginx. This is the standard and recommended approach for production deployments.

```javascript
// server.js
app.set('trust proxy', 1);  // Trust nginx reverse proxy

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TitanGold Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔒 Behind HTTPS proxy: ${process.env.BEHIND_HTTPS_PROXY === 'true'}`);
});
```

#### Environment Variables
```bash
BEHIND_HTTPS_PROXY=true    # Backend runs behind HTTPS reverse proxy
```

#### Verification
```bash
# Test HTTPS endpoint
curl -I https://titan.zala.ir/api/health

# Check SSL certificate
openssl s_client -connect titan.zala.ir:443 -servername titan.zala.ir

# Verify HTTP to HTTPS redirect
curl -I http://titan.zala.ir
# Should return: 301 Moved Permanently, Location: https://titan.zala.ir
```

---

### 3. External API Calls (MEXC Exchange)

**Status**: ✅ HTTPS VERIFIED

#### MEXC API Configuration
- **Library**: CCXT (Cryptocurrency Trading Library)
- **Default Protocol**: HTTPS (enforced by CCXT)
- **API Endpoints**:
  - Public API: `https://api.mexc.com`
  - Spot API v2: `https://www.mexc.com/open/api/v2`
  - Contract API: `https://contract.mexc.com/api/v1/contract`

#### Verification
All MEXC API calls through CCXT library use HTTPS by default:

```javascript
// CCXT automatically uses HTTPS
const exchange = new ccxt.mexc({
  apiKey: 'xxx',
  secret: 'xxx',
  // CCXT enforces HTTPS for all requests
});

// Example API URLs (from CCXT):
{
  api: {
    spot: { 
      public: 'https://api.mexc.com', 
      private: 'https://api.mexc.com' 
    }
  }
}
```

#### Certificate Validation
CCXT library validates SSL certificates by default using Node.js's built-in certificate store. To enforce strict validation:

```bash
# Environment variable
EXTERNAL_API_SSL_VERIFY=true
```

#### External API Service File
- **File**: `backend/services/mexc.js`
- **SSL**: Enforced by CCXT library
- **Certificate Validation**: Enabled by default

---

### 4. Internal API Calls

**Status**: ⚠️ USES HTTP (LOCALHOST)

Some internal API calls between services use HTTP on localhost. This is acceptable for internal communication but should be noted:

#### Current Implementation
```javascript
// services/agents/arbitrage.js
const url = `http://localhost:5002/api/market/mexc/ticker24hr?symbol=${symbol}`;
```

#### Security Analysis
- **Risk Level**: LOW
- **Reason**: Communication is localhost-only, not exposed to network
- **Recommendation**: Consider using Unix domain sockets for even better security

#### Environment Variables
```bash
INTERNAL_API_BASE_URL=http://localhost:5002  # Internal communication
```

---

## Security Headers

Nginx is configured with comprehensive security headers:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "..." always;
```

---

## SSL/TLS Testing Checklist

### Database Connection
- [x] PostgreSQL SSL enabled (`SHOW ssl;` returns `on`)
- [x] Database connection configured with SSL option
- [x] SSL parameters in environment variables
- [x] Connection successful with SSL
- [x] Tested with self-signed certificate (localhost)

### API Endpoints
- [x] Nginx SSL certificate installed
- [x] HTTPS listening on port 443
- [x] HTTP to HTTPS redirect configured
- [x] TLS 1.2/1.3 enabled
- [x] Security headers configured
- [x] Backend trusts proxy (`trust proxy: 1`)
- [x] Tested HTTPS endpoint access

### External APIs
- [x] MEXC API uses HTTPS (verified via CCXT)
- [x] Certificate validation enabled by default
- [x] No HTTP fallbacks in external API calls
- [x] CCXT library uses secure defaults

### Documentation
- [x] SSL configuration documented
- [x] Environment variables documented
- [x] Testing procedures documented
- [x] Production recommendations provided

---

## Environment Variables Summary

Add these to `backend/.env`:

```bash
# ============================================================================
# SSL/TLS Configuration (INFRA-002)
# ============================================================================

# Database SSL (PostgreSQL on localhost with self-signed cert)
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

# API SSL - Backend runs behind nginx reverse proxy with SSL termination
# Nginx handles HTTPS (TLS 1.2/1.3), backend listens on HTTP internally
BEHIND_HTTPS_PROXY=true

# External API SSL validation
# All external APIs (MEXC, etc.) must use HTTPS with valid certificates
EXTERNAL_API_SSL_VERIFY=true
```

---

## Production Deployment Checklist

When deploying to production or new environments:

### Pre-Deployment
- [ ] Verify nginx is installed and configured
- [ ] SSL certificates are valid and not expired
- [ ] Cloudflare SSL mode is set to "Full (strict)" or "Full"
- [ ] Database SSL certificates are in place
- [ ] Environment variables are properly set

### Post-Deployment
- [ ] Test HTTPS endpoint: `curl -I https://titan.zala.ir`
- [ ] Verify SSL certificate: `openssl s_client -connect titan.zala.ir:443`
- [ ] Test database connection with SSL
- [ ] Monitor logs for SSL-related errors
- [ ] Verify external API calls succeed
- [ ] Check security headers in browser DevTools

### Monitoring
- [ ] Set up SSL certificate expiration monitoring
- [ ] Monitor SSL handshake errors in logs
- [ ] Track TLS version usage metrics
- [ ] Monitor external API SSL errors

---

## Troubleshooting

### Database SSL Connection Issues

**Error**: `SSL connection has been closed unexpectedly`
```bash
# Solution: Check PostgreSQL SSL configuration
sudo -u postgres psql -p 5433 -d titangold_db -c "SHOW ssl;"

# If SSL is off, enable it in postgresql.conf
sudo nano /etc/postgresql/*/main/postgresql.conf
# Set: ssl = on
sudo systemctl restart postgresql
```

**Error**: `self signed certificate`
```bash
# Solution: Set DB_SSL_REJECT_UNAUTHORIZED=false for localhost
# Or provide CA certificate path for remote databases
```

### HTTPS Issues

**Error**: 502 Bad Gateway
```bash
# Check backend is running
pm2 status titan-backend

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Test backend directly
curl http://localhost:5002/api/health
```

**Error**: SSL certificate expired
```bash
# Check certificate expiration
openssl x509 -in /etc/ssl/cloudflare/zala.ir.origin.pem -noout -dates

# Renew Cloudflare Origin Certificate if needed
```

### External API SSL Issues

**Error**: `UNABLE_TO_VERIFY_LEAF_SIGNATURE`
```bash
# This indicates certificate validation issues
# Verify Node.js can access system CA certificates
node -e "console.log(require('tls').rootCertificates.length)"

# Update CA certificates
sudo apt-get update && sudo apt-get install ca-certificates
```

---

## Follow-Up Recommendations

### INFRA-003: Automated SSL Certificate Monitoring
- **Priority**: P1
- **Effort**: 2 hours
- **Description**: Set up automated monitoring for SSL certificate expiration
- **Tools**: Certbot, custom scripts, monitoring services

### INFRA-004: Database SSL Certificate Rotation
- **Priority**: P2
- **Effort**: 4 hours
- **Description**: Implement automated database SSL certificate rotation
- **Requirements**: Certificate management, zero-downtime rotation

### SECURITY-001: Implement Certificate Pinning
- **Priority**: P2
- **Effort**: 3 hours
- **Description**: Implement certificate pinning for critical external APIs
- **Benefits**: Protection against MITM attacks

### MONITORING-002: SSL/TLS Metrics Dashboard
- **Priority**: P2
- **Effort**: 3 hours
- **Description**: Create dashboard for SSL/TLS connection metrics
- **Metrics**: Handshake duration, cipher usage, protocol versions

---

## References

- [PostgreSQL SSL Documentation](https://www.postgresql.org/docs/current/ssl-tcp.html)
- [Node.js TLS Documentation](https://nodejs.org/api/tls.html)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [Cloudflare Origin Certificates](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca)
- [CCXT Library Documentation](https://docs.ccxt.com/)

---

**Last Updated**: 2026-01-06  
**Maintained By**: TitanGold Infrastructure Team  
**Review Cycle**: Quarterly
