# TitanGold Load Balancer Setup Guide

**Task:** INFRA-009 - Set Up Load Balancer  
**Version:** 1.0.0  
**Date:** 2026-01-31

## Overview

This guide covers the complete setup of production-grade load balancing for TitanGold, including nginx-based load balancing, cloud load balancer configurations (AWS ALB), SSL/TLS termination, health checks, and sticky sessions for WebSocket connections.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Nginx Load Balancer Setup](#nginx-load-balancer-setup)
3. [Docker-based Deployment](#docker-based-deployment)
4. [AWS ALB Setup](#aws-alb-setup)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Health Checks](#health-checks)
7. [Sticky Sessions](#sticky-sessions)
8. [Monitoring and Logging](#monitoring-and-logging)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Load Balancer Features

✅ **Multiple Backend Support**: Round-robin and least-connection load balancing  
✅ **Health Checks**: Automatic failover for unhealthy instances  
✅ **SSL Termination**: TLS 1.2/1.3 with modern cipher suites  
✅ **Sticky Sessions**: Session persistence for WebSocket connections  
✅ **Rate Limiting**: DDoS protection and abuse prevention  
✅ **Caching**: Static content and API response caching  
✅ **Compression**: Gzip compression for reduced bandwidth  
✅ **Security Headers**: HSTS, X-Frame-Options, CSP, etc.

### Architecture Diagram

```
                                    ┌─────────────┐
                                    │   Clients   │
                                    └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │   Port 80   │
                                    │  (HTTP →    │
                                    │   HTTPS)    │
                                    └──────┬──────┘
                                           │
                              ┌────────────▼───────────────┐
                              │    Load Balancer (Nginx)   │
                              │  ┌──────────────────────┐  │
                              │  │  SSL Termination     │  │
                              │  │  Health Checks       │  │
                              │  │  Rate Limiting       │  │
                              │  │  Sticky Sessions     │  │
                              │  └──────────────────────┘  │
                              └────────┬───────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
             ┌──────▼──────┐    ┌──────▼──────┐   ┌──────▼──────┐
             │  Backend 1  │    │  Backend 2  │   │  Backend 3  │
             │  Port 5002  │    │  Port 5003  │   │  Port 5004  │
             └─────────────┘    └─────────────┘   └─────────────┘
```

---

## Nginx Load Balancer Setup

### Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- Nginx 1.18+
- Root or sudo access
- Domain name with DNS configured

### Installation

#### 1. Install Nginx

```bash
# Update package list
sudo apt update

# Install nginx
sudo apt install nginx -y

# Verify installation
nginx -v
```

#### 2. Generate DH Parameters (for SSL)

```bash
# This takes 5-10 minutes
sudo openssl dhparam -out /etc/nginx/dhparam.pem 4096
```

#### 3. Copy Configuration

```bash
# Copy the nginx configuration
sudo cp infrastructure/nginx.conf /etc/nginx/sites-available/titangold

# Create symbolic link
sudo ln -s /etc/nginx/sites-available/titangold /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default
```

#### 4. Configure Backend Servers

Edit `/etc/nginx/sites-available/titangold` and update the upstream block:

```nginx
upstream titangold_backend {
    least_conn;
    
    # Add your backend servers here
    server 10.0.1.10:5002 max_fails=3 fail_timeout=30s weight=1;
    server 10.0.1.11:5002 max_fails=3 fail_timeout=30s weight=1;
    server 10.0.1.12:5002 max_fails=3 fail_timeout=30s weight=1;
    
    keepalive 32;
}
```

#### 5. Test Configuration

```bash
# Test nginx configuration
sudo nginx -t

# If successful, reload nginx
sudo systemctl reload nginx
```

#### 6. Enable Nginx on Boot

```bash
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Docker-based Deployment

### Using Docker Compose

The easiest way to deploy the load balancer with automatic SSL certificate management.

#### 1. Prerequisites

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. Configure Environment

Edit `infrastructure/docker-compose.lb.yml` and update:
- Domain names in the certbot service
- Email address for Let's Encrypt
- Backend server addresses in nginx.conf

#### 3. Deploy

```bash
# Navigate to infrastructure directory
cd infrastructure

# Start load balancer and certbot
docker-compose -f docker-compose.lb.yml up -d

# View logs
docker-compose -f docker-compose.lb.yml logs -f
```

#### 4. Verify Deployment

```bash
# Check container status
docker ps

# Test health endpoint
curl http://localhost/health

# Test HTTPS (after SSL certificates are generated)
curl https://api.titangold.com/health
```

---

## AWS ALB Setup

### Using Terraform

#### 1. Prerequisites

```bash
# Install Terraform
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Configure AWS credentials
aws configure
```

#### 2. Prepare Variables

Create `infrastructure/terraform.tfvars`:

```hcl
environment          = "prod"
vpc_id              = "vpc-0123456789abcdef"
public_subnet_ids   = ["subnet-abc123", "subnet-def456"]
private_subnet_ids  = ["subnet-ghi789", "subnet-jkl012"]
certificate_arn     = "arn:aws:acm:us-east-1:123456789:certificate/abc-def-ghi"
backend_instance_ids = ["i-0123456789abcdef", "i-abcdef0123456789"]
domain_name         = "api.titangold.com"
```

#### 3. Deploy

```bash
# Navigate to infrastructure directory
cd infrastructure

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Apply configuration
terraform apply
```

#### 4. Update DNS

After deployment, update your DNS records:

```bash
# Get ALB DNS name
terraform output alb_dns_name

# Create CNAME record:
# api.titangold.com -> titangold-alb-prod-1234567890.us-east-1.elb.amazonaws.com
```

---

## SSL/TLS Configuration

### Let's Encrypt (Certbot)

#### Manual Certificate Generation

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Generate certificate
sudo certbot --nginx -d api.titangold.com -d titangold.com -d www.titangold.com

# Test renewal
sudo certbot renew --dry-run
```

#### Automatic Renewal

Certbot automatically installs a cron job for renewal. Verify:

```bash
sudo systemctl status certbot.timer
```

### AWS Certificate Manager (ACM)

For AWS ALB, use ACM for SSL certificates:

```bash
# Request certificate
aws acm request-certificate \
  --domain-name api.titangold.com \
  --validation-method DNS \
  --subject-alternative-names titangold.com www.titangold.com

# Validate via DNS records
# Follow AWS Console instructions
```

### SSL Best Practices

The nginx configuration includes:

- **TLS 1.2 and 1.3 only** (no TLS 1.0/1.1)
- **Modern cipher suites** (ECDHE, AES-GCM, ChaCha20-Poly1305)
- **HSTS** (HTTP Strict Transport Security)
- **OCSP stapling** for faster certificate validation
- **Perfect Forward Secrecy** via DHE/ECDHE key exchange

---

## Health Checks

### Backend Health Check

The load balancer performs health checks on `/health` endpoint:

```nginx
location /health {
    proxy_pass http://titangold_backend/health;
    
    # Fast timeout for health checks
    proxy_connect_timeout 2s;
    proxy_send_timeout 2s;
    proxy_read_timeout 2s;
}
```

### Health Check Script

Use the provided script to manually check backend health:

```bash
# Check local backend
./infrastructure/health-check.sh http://localhost:5002

# Check remote backend
./infrastructure/health-check.sh http://10.0.1.10:5002
```

### Expected Health Response

```json
{
  "status": "healthy",
  "api": "operational",
  "database": "connected",
  "timestamp": "2026-01-31T12:00:00Z",
  "uptime": 86400
}
```

### Health Check Configuration

**Nginx:**
- Interval: Every request (passive)
- Timeout: 2 seconds
- Retry: 3 times before marking unhealthy

**AWS ALB:**
- Interval: 30 seconds
- Timeout: 5 seconds
- Healthy threshold: 2 consecutive successes
- Unhealthy threshold: 3 consecutive failures

---

## Sticky Sessions

### Why Sticky Sessions?

Sticky sessions (session persistence) ensure that requests from the same client are routed to the same backend server. This is crucial for:

1. **WebSocket connections**: Must maintain connection to same backend
2. **In-memory session storage**: If not using Redis/external session store
3. **Stateful operations**: Agent execution tracking

### Nginx Sticky Sessions

The configuration uses IP hash for WebSocket endpoints:

```nginx
location ~ ^/ws/(notifications|favorites) {
    proxy_pass http://titangold_backend;
    
    # WebSocket upgrade headers
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Long timeouts for WebSocket
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}
```

For IP-based sticky sessions, change upstream to:

```nginx
upstream titangold_backend {
    ip_hash;  # Use client IP for routing
    server backend1:5002;
    server backend2:5002;
}
```

### AWS ALB Sticky Sessions

The Terraform configuration enables sticky sessions:

```hcl
stickiness {
  enabled         = true
  type            = "lb_cookie"
  cookie_duration = 86400  # 24 hours
}
```

The ALB uses a cookie (`AWSALB`) to route requests to the same target.

---

## Monitoring and Logging

### Nginx Access Logs

```bash
# View access logs
sudo tail -f /var/log/nginx/titangold-access.log

# Filter by status code
sudo grep "HTTP/1.1\" 500" /var/log/nginx/titangold-access.log

# Count requests by status
sudo awk '{print $9}' /var/log/nginx/titangold-access.log | sort | uniq -c | sort -rn
```

### Nginx Error Logs

```bash
# View error logs
sudo tail -f /var/log/nginx/titangold-error.log

# Filter critical errors
sudo grep "\[crit\]" /var/log/nginx/titangold-error.log
```

### Nginx Status Module

Enable stub_status module:

```nginx
location /nginx_status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    deny all;
}
```

Check status:

```bash
curl http://localhost/nginx_status
```

### AWS CloudWatch

The Terraform configuration creates CloudWatch alarms for:

1. **High Response Time**: Alert when average > 1 second
2. **Unhealthy Targets**: Alert when any backend becomes unhealthy
3. **Request Count**: Monitor traffic patterns
4. **Target Connection Errors**: Track backend connection failures

View metrics:

```bash
# Get ALB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=app/titangold-alb-prod/... \
  --start-time 2026-01-31T00:00:00Z \
  --end-time 2026-01-31T23:59:59Z \
  --period 3600 \
  --statistics Average
```

---

## Troubleshooting

### Common Issues

#### 1. Backend Unreachable

**Symptoms**: 502 Bad Gateway, 504 Gateway Timeout

**Diagnosis**:
```bash
# Check backend is running
curl http://localhost:5002/health

# Check nginx error logs
sudo tail -50 /var/log/nginx/titangold-error.log

# Test backend connectivity from load balancer
telnet backend-server 5002
```

**Solutions**:
- Verify backend is running and listening on correct port
- Check firewall rules allow traffic from load balancer
- Verify network connectivity between load balancer and backends

#### 2. SSL Certificate Issues

**Symptoms**: SSL handshake errors, certificate warnings

**Diagnosis**:
```bash
# Test SSL certificate
openssl s_client -connect api.titangold.com:443 -servername api.titangold.com

# Check certificate expiry
echo | openssl s_client -connect api.titangold.com:443 2>/dev/null | openssl x509 -noout -dates

# Verify nginx SSL configuration
sudo nginx -t
```

**Solutions**:
- Renew expired certificates: `sudo certbot renew`
- Verify certificate paths in nginx.conf
- Check DH parameters file exists

#### 3. WebSocket Connection Drops

**Symptoms**: WebSocket connections disconnect frequently

**Diagnosis**:
```bash
# Check WebSocket upgrade headers
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://api.titangold.com/ws/notifications

# Monitor nginx logs during WebSocket connection
sudo tail -f /var/log/nginx/titangold-access.log | grep "/ws/"
```

**Solutions**:
- Increase proxy timeouts for WebSocket locations
- Enable sticky sessions (ip_hash)
- Check for intermediate proxies dropping connections

#### 4. High Response Times

**Symptoms**: Slow API responses

**Diagnosis**:
```bash
# Check backend response times
./infrastructure/health-check.sh http://backend:5002

# Monitor nginx upstream response times
sudo grep "upstream_response_time" /var/log/nginx/titangold-access.log

# Check backend resource usage
ssh backend-server "top -bn1 | head -20"
```

**Solutions**:
- Scale backend horizontally (add more instances)
- Optimize backend application
- Enable caching for frequently accessed endpoints
- Increase backend server resources

#### 5. Rate Limiting False Positives

**Symptoms**: Legitimate requests being rate limited

**Diagnosis**:
```bash
# Check rate limit logs
sudo grep "limiting requests" /var/log/nginx/titangold-error.log
```

**Solutions**:
- Adjust rate limit thresholds in nginx.conf
- Use burst parameter for temporary traffic spikes
- Whitelist known good IPs

### Performance Tuning

#### Nginx Worker Processes

```nginx
# /etc/nginx/nginx.conf
worker_processes auto;  # Use all CPU cores
worker_connections 1024;  # Connections per worker
```

#### Kernel Parameters

```bash
# /etc/sysctl.conf
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.ip_local_port_range = 10000 65535
net.ipv4.tcp_tw_reuse = 1

# Apply changes
sudo sysctl -p
```

#### File Descriptors

```bash
# /etc/security/limits.conf
nginx soft nofile 65535
nginx hard nofile 65535

# Verify
sudo -u nginx ulimit -n
```

---

## Maintenance

### Adding Backend Servers

#### Nginx

1. Edit nginx configuration:
```nginx
upstream titangold_backend {
    least_conn;
    server backend1:5002 max_fails=3 fail_timeout=30s;
    server backend2:5002 max_fails=3 fail_timeout=30s;
    server backend3:5002 max_fails=3 fail_timeout=30s;  # New server
}
```

2. Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### AWS ALB

1. Update Terraform variables:
```hcl
backend_instance_ids = ["i-abc123", "i-def456", "i-ghi789"]  # Add new instance
```

2. Apply changes:
```bash
terraform apply
```

### Removing Backend Servers

1. Drain connections (wait for active requests to complete)
2. Remove from upstream/target group
3. Reload/apply configuration

### SSL Certificate Renewal

Automatic renewal happens via certbot. Manual renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal

# Reload nginx
sudo systemctl reload nginx
```

---

## Security Checklist

- [ ] SSL/TLS certificates configured and valid
- [ ] HSTS enabled with appropriate max-age
- [ ] Security headers configured (X-Frame-Options, CSP, etc.)
- [ ] Rate limiting enabled on all endpoints
- [ ] Firewall rules restrict backend access to load balancer only
- [ ] DH parameters generated (4096 bits)
- [ ] Weak SSL protocols disabled (SSLv3, TLS 1.0, TLS 1.1)
- [ ] Access logs enabled and monitored
- [ ] Regular security updates applied
- [ ] Backup configuration files stored securely

---

## References

- [Nginx Documentation](https://nginx.org/en/docs/)
- [AWS ALB Documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)

---

**Last Updated:** 2026-01-31  
**Task:** INFRA-009 - Set Up Load Balancer  
**Status:** Complete
