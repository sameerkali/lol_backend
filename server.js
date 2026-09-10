const env = require("./src/config/env");
const connectDB = require("./src/config/db");
const app = require("./src/app");

async function main() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
