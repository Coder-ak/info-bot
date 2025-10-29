module.exports = {
  apps: [
    {
      name: 'info-bot',
      script: 'dist/server.js',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
