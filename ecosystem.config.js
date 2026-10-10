module.exports = {
  apps: [
    {
      name: 'cashflow-api',
      cwd: '/home/cashflow/apps/api',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
