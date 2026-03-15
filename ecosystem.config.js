module.exports = {
    apps: [
    {
        name: "nextjs",
        cwd: "./frontend",
        script: "npm.cmd",
        args: "run start",
        interpreter: "none"
    },
      {
        name: "laravel",
        cwd: "./backend",
        script: "php",
        args: "artisan serve --port=8000"
      }
    ]
  };