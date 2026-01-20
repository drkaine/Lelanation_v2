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
        PORT: 4001,
        YOUTUBE_API_KEY: 'AIzaSyBV5QO-6uBExbZL43S3MmZMrT7I0MQHe00'      
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
      script: 'node',
      args: '.output/server/index.mjs',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NITRO_PORT: 3000,
        NITRO_HOST: '127.0.0.1'
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
