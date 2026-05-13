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
        name: 'lelanation-poller-v2',
        cwd: 'path',
        script: 'npx',
        args: 'tsx src/main.ts',
        interpreter: 'none',
        env: {
          NODE_ENV: 'development',
          ENV: 'dev',
          PLAYER_KEY_VERSION: 'perso',
          REDIS_URL: 'redis://localhost:6379',
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/lelanation',
          RIOT_API_KEY: 'RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
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
  