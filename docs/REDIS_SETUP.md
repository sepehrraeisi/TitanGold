# Redis Setup and Operations Guide

## Overview

TitanGold uses Redis 7.2 for caching and rate limiting with production-ready configuration including:
- **Persistence**: RDB + AOF (Append Only File) for data durability
- **Authentication**: Password-protected access
- **Monitoring**: Built-in metrics and health checks
- **Docker**: Containerized deployment with Docker Compose

## Architecture

```
┌─────────────────┐
│  TitanGold API  │
│   (Node.js)     │
└────────┬────────┘
         │ Redis Client
         │ (Port 6379)
         ▼
┌─────────────────┐
│  Redis 7.2      │
│  (Docker)       │
├─────────────────┤
│  • RDB + AOF    │
│  • 256MB Max    │
│  • Auth Enabled │
└─────────────────┘
         │
         ▼
   ┌─────────┐
   │  Disk   │
   │ Storage │
   └─────────┘
```

## Quick Start

### 1. Start Redis with Docker Compose

```bash
cd /home/ubuntu/webapp/TitanGold
docker-compose up -d redis
```

### 2. Verify Redis is Running

```bash
# Check container status
docker ps | grep titan-redis

# Check Redis health
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" ping
# Expected output: PONG

# Check Redis info
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" info server
```

### 3. Verify Backend Connection

```bash
# Check health endpoint (includes Redis status)
curl http://localhost:5002/api/health/ready | jq '.checks.redis'

# Expected output:
# {
#   "status": "ok",
#   "message": "Redis 7.2.x - Hit rate: XX.XX%",
#   "memory_used": "XXmb"
# }
```

## Configuration

### Environment Variables

**Backend (.env)**:
```env
REDIS_PASSWORD=<secure-password>
REDIS_URL=redis://:<password>@localhost:6379
RATE_LIMIT_MAX=15
RATE_LIMIT_WINDOW_MS=60000
```

**Docker Compose (.env at root)**:
```env
REDIS_PASSWORD=<same-secure-password>
```

### Redis Configuration (redis.conf)

Key settings:
- **Persistence**: 
  - RDB: Snapshots at 15min/1key, 5min/10keys, 1min/10000keys
  - AOF: `appendfsync everysec` (write to disk every second)
- **Memory**: 256MB max with `allkeys-lru` eviction policy
- **Security**: `requirepass` enabled with strong password
- **Monitoring**: Slow log at 10ms threshold

## Persistence Strategy

### RDB (Redis Database Backup)

- **What**: Point-in-time snapshots
- **When**: 
  - Every 15 minutes if ≥1 key changed
  - Every 5 minutes if ≥10 keys changed
  - Every 1 minute if ≥10000 keys changed
- **File**: `/data/dump.rdb` (in Docker volume)

### AOF (Append Only File)

- **What**: Log of every write operation
- **When**: Every second (`appendfsync everysec`)
- **File**: `/data/appendonly.aof` (in Docker volume)
- **Rewrite**: Auto-rewrite when file grows 100% and exceeds 64MB

### Why Both?

- **RDB**: Fast restarts, smaller files, good for backups
- **AOF**: Better durability (1-second loss max), more reliable
- **Combined**: Best of both worlds with `aof-use-rdb-preamble yes`

## Backup Strategy

### Automated Backups (Recommended)

Create a cron job to backup Redis data:

```bash
# Create backup script
cat > /home/ubuntu/backup-redis.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Trigger BGSAVE
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" BGSAVE

# Wait for save to complete
sleep 5

# Copy RDB and AOF files
docker cp titan-redis:/data/dump.rdb "$BACKUP_DIR/dump_$DATE.rdb"
docker cp titan-redis:/data/appendonly.aof "$BACKUP_DIR/appendonly_$DATE.aof"

# Compress backups
gzip "$BACKUP_DIR/dump_$DATE.rdb"
gzip "$BACKUP_DIR/appendonly_$DATE.aof"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete

echo "✅ Redis backup completed: $DATE"
EOF

chmod +x /home/ubuntu/backup-redis.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/backup-redis.sh >> /var/log/redis-backup.log 2>&1") | crontab -
```

### Manual Backup

```bash
# Trigger immediate save
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" SAVE

# Copy files from container
docker cp titan-redis:/data/dump.rdb ./backup/
docker cp titan-redis:/data/appendonly.aof ./backup/
```

### Restore from Backup

```bash
# Stop Redis
docker-compose stop redis

# Copy backup files to volume
docker cp ./backup/dump.rdb titan-redis:/data/
docker cp ./backup/appendonly.aof titan-redis:/data/

# Start Redis
docker-compose start redis

# Verify data
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" DBSIZE
```

## Monitoring

### Health Checks

**1. Container Health**:
```bash
docker ps --filter name=titan-redis --format "table {{.Names}}\t{{.Status}}"
```

**2. Redis Health via API**:
```bash
curl http://localhost:5002/api/health/ready | jq '.checks.redis'
```

**3. Direct Redis Check**:
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" ping
```

### Key Metrics

**Memory Usage**:
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" INFO memory | grep used_memory_human
```

**Hit Rate**:
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" INFO stats | grep keyspace
# Calculate: hits / (hits + misses) * 100
```

**Connected Clients**:
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" INFO clients | grep connected_clients
```

**Slow Log** (queries > 10ms):
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" SLOWLOG GET 10
```

### Monitoring Dashboard

Access detailed Redis stats via health endpoint:

```bash
curl http://localhost:5002/api/health/status | jq '.redis'
```

Output includes:
- Version and uptime
- Memory usage (used, peak, max)
- Stats (clients, commands, hit rate)
- Persistence (last save time, AOF status)
- Evictions and expirations

## Operations

### Start/Stop Redis

```bash
# Start
docker-compose up -d redis

# Stop (graceful)
docker-compose stop redis

# Restart
docker-compose restart redis

# View logs
docker-compose logs -f redis
```

### Access Redis CLI

```bash
# Interactive CLI
docker exec -it titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}"

# Single command
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" <command>
```

### Common Operations

**View all keys**:
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" KEYS "ratelimit:*"
```

**Check specific key**:
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" GET <key>
```

**Flush database** (⚠️ destructive):
```bash
# Flush current DB
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" FLUSHDB

# Flush all DBs
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" FLUSHALL
```

**Database size**:
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" DBSIZE
```

## Troubleshooting

### Redis Not Connecting

**1. Check if Redis is running**:
```bash
docker ps | grep titan-redis
```

**2. Check logs**:
```bash
docker logs titan-redis --tail 50
```

**3. Verify password**:
```bash
# Test with password
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" ping

# Test without (should fail)
docker exec titan-redis redis-cli ping
# Expected: (error) NOAUTH Authentication required
```

**4. Check backend connection**:
```bash
# Verify REDIS_URL in .env
grep REDIS_URL backend/.env

# Check backend logs
pm2 logs titan-backend | grep -i redis
```

### Memory Issues

**Check memory usage**:
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" INFO memory
```

**If memory is full**:
```bash
# Check maxmemory policy
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" CONFIG GET maxmemory-policy
# Should be: allkeys-lru (evicts least recently used keys)

# Increase maxmemory (temporary)
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" CONFIG SET maxmemory 512mb

# Permanent: Update redis.conf and restart
```

### Persistence Issues

**Check last save time**:
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" LASTSAVE
```

**Trigger manual save**:
```bash
# Background save (non-blocking)
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" BGSAVE

# Foreground save (blocking)
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" SAVE
```

**Check AOF status**:
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" INFO persistence
```

### Performance Issues

**1. Check slow log**:
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" SLOWLOG GET 20
```

**2. Monitor commands in real-time**:
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" MONITOR
```

**3. Check hit rate** (should be >80%):
```bash
docker exec titan-redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" INFO stats | grep keyspace
```

## Security Best Practices

1. ✅ **Password protected** (requirepass enabled)
2. ✅ **Bind to localhost** (0.0.0.0 for Docker, but not exposed to internet)
3. ✅ **Protected mode** enabled
4. ⚠️ **Rotate passwords** regularly (update .env and restart)
5. ⚠️ **Firewall rules** (block external access to port 6379)
6. ⚠️ **Regular backups** (automated cron job)

## Production Checklist

- [ ] Redis running via Docker Compose
- [ ] Strong password configured (32+ characters)
- [ ] RDB + AOF persistence enabled
- [ ] Automated backups scheduled (cron)
- [ ] Monitoring enabled (health endpoint)
- [ ] Logs monitored (docker logs + backend logs)
- [ ] Memory limits appropriate (256MB default)
- [ ] Firewall rules configured (block external 6379)
- [ ] Password rotation policy established
- [ ] Disaster recovery plan documented

## Connection Pooling

Connection pooling is already configured in `backend/utils/redis.js`:
- Single shared Redis client across all requests
- Auto-reconnect on connection loss (exponential backoff)
- Connection reuse prevents overhead
- No need for external pooling library

## Performance Tuning

Current configuration optimized for:
- **Use case**: Rate limiting + caching
- **Data size**: Small keys (user IDs, rate limit counters)
- **Access pattern**: High read/write frequency
- **Eviction**: LRU (least recently used) when memory full

**Adjust if needed**:
```bash
# Increase memory
# Edit redis.conf: maxmemory 512mb

# Change eviction policy
# Edit redis.conf: maxmemory-policy volatile-lru

# Restart to apply
docker-compose restart redis
```

## References

- [Redis Documentation](https://redis.io/documentation)
- [Redis Persistence](https://redis.io/topics/persistence)
- [Redis Security](https://redis.io/topics/security)
- [Redis Administration](https://redis.io/topics/admin)

## Support

For issues or questions:
1. Check backend logs: `pm2 logs titan-backend | grep -i redis`
2. Check Redis logs: `docker logs titan-redis`
3. Verify health: `curl http://localhost:5002/api/health/ready`
4. Consult this documentation

---

**Last Updated**: 2026-01-06  
**Redis Version**: 7.2  
**TitanGold Version**: 1.0.0
