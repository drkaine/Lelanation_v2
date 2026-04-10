module.exports = {
    apps: [
      {
        name: 'lelanation-backend',
        cwd: 'path',
        script: 'npx',
        args: 'tsx watch src/index.ts',
        interpreter: 'none',
        env: {
          NODE_ENV: 'development',
          PORT: 4001,
          POLLER_EXTERNAL: '1',
          YOUTUBE_API_KEY: 'API-KEY',
          DISCORD_WEBHOOK_URL: 'DISCORD-WEBHOOK-URL'
        },
        error_file: 'path',
        out_file: 'path',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        instances: 1,
        exec_mode: 'fork'
      },
      {
        name: 'lelanation-poller',
        cwd: 'path',
        script: 'npx',
        args: 'tsx src/worker/pollerMain.ts',
        interpreter: 'none',
        env: {
          NODE_ENV: 'development',
          RIOT_POLLER_STARTUP_DELAY_MS: '10000',
        },
        error_file: 'path',
        out_file: 'path',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        kill_timeout: 60000,
        instances: 1,
        exec_mode: 'fork'
      },
      {
        name: 'lelanation-frontend',
        cwd: 'path',
        script: 'node',
        args: '.output/server/index.mjs',
        interpreter: 'none',
        env: {
          NODE_ENV: 'production',
          PORT: 3000,
          NITRO_PORT: 3000,
          NITRO_HOST: '127.0.0.1',
          NUXT_PUBLIC_MATOMO_HOST: 'https://votre-instance-matomo.com',
          NUXT_PUBLIC_MATOMO_SITE_ID: '1'
        },
        error_file: 'path',
        out_file: 'path',
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
  