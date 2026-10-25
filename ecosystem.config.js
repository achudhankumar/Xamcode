module.exports = {
  apps: [
    {
      name: 'xamcode-api',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080,
        HOST: '0.0.0.0'
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 8080,
        HOST: '0.0.0.0'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      merge_logs: true
    },
    {
      name: 'xamcode-worker',
      script: './bip/worker.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      env_staging: {
        NODE_ENV: 'staging'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/worker-error.log',
      out_file: 'logs/worker-out.log'
    }
  ]
};

