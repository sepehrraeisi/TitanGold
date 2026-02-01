// ============================================================================
// TitanGold PM2 Ecosystem Configuration (INFRA-010)
// ============================================================================
//
// Purpose: PM2 process manager configuration for blue-green environments
//
// Features:
//   - Separate configurations for blue and green environments
//   - Automatic restart on crash
//   - Log rotation
//   - Memory and CPU monitoring
//   - Cluster mode for production
//
// Usage:
//   pm2 start ecosystem.config.js --only titangold-blue
//   pm2 start ecosystem.config.js --only titangold-green
//   pm2 start ecosystem.config.js  # Start both
//
// Date: 2026-01-31
// ============================================================================

module.exports = {
  apps: [
    // Blue Environment (Port 5002)
    {
      name: 'titangold-blue',
      script: './backend/server.js',
      cwd: '/var/www/titangold/blue',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5002,
      },
      env_file: '/var/www/titangold/blue/backend/.env',
      error_file: '/var/log/titangold/blue-error.log',
      out_file: '/var/log/titangold/blue-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 10000,
      kill_timeout: 5000,
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],
      instance_var: 'INSTANCE_ID',
    },

    // Green Environment (Port 5003)
    {
      name: 'titangold-green',
      script: './backend/server.js',
      cwd: '/var/www/titangold/green',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5003,
      },
      env_file: '/var/www/titangold/green/backend/.env',
      error_file: '/var/log/titangold/green-error.log',
      out_file: '/var/log/titangold/green-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 10000,
      kill_timeout: 5000,
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],
      instance_var: 'INSTANCE_ID',
    },
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: 'production.titangold.com',
      ref: 'origin/main',
      repo: 'git@github.com:sepehrraeisi/TitanGold.git',
      path: '/var/www/titangold',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js',
    },
    staging: {
      user: 'ubuntu',
      host: 'staging.titangold.com',
      ref: 'origin/develop',
      repo: 'git@github.com:sepehrraeisi/TitanGold.git',
      path: '/var/www/titangold-staging',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js',
    },
  },
};
