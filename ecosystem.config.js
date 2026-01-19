module.exports = {
  apps: [
    {
      name: 'lelanation-backend',
      cwd: '/home/ubuntu/dev/Lelanation_v2/backend',
      script: 'npx',
      args: 'tsx watch src/index.ts',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        PORT: 4001
      },
      error_file: '/home/ubuntu/dev/Lelanation_v2/logs/backend-error.log',
      out_file: '/home/ubuntu/dev/Lelanation_v2/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'lelanation-frontend',
      cwd: '/home/ubuntu/dev/Lelanation_v2/frontend',
      script: 'npx',
      args: 'nuxt dev',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        NITRO_PORT: 3000
      },
      error_file: '/home/ubuntu/dev/Lelanation_v2/logs/frontend-error.log',
      out_file: '/home/ubuntu/dev/Lelanation_v2/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
