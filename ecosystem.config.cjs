module.exports = {
  apps: [
    {
      name: "dailyos",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "768M",
    },
  ],
};
