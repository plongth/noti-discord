module.exports = {
  apps: [
    {
      name: "wa2dc-bot",
      cwd: __dirname,
      script: "npm",
      args: "start",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "arespawn-wrapper",
      cwd: __dirname,
      script: "npm",
      args: "run start:wrapper",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        ARESPAWN_WRAPPER_PORT: "3000",
      },
    },
  ],
};

