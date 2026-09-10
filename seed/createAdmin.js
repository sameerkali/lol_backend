const env = require("../src/config/env");
const connectDB = require("../src/config/db");
const Admin = require("../src/models/Admin");
const mongoose = require("mongoose");

async function run() {
  if (!env.admin.email || !env.admin.password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running this script.");
    process.exit(1);
  }

  await connectDB();

  const existing = await Admin.findOne({ email: env.admin.email.toLowerCase() });
  if (existing) {
    console.log(`Admin already exists for ${env.admin.email}, skipping.`);
  } else {
    const passwordHash = await Admin.hashPassword(env.admin.password);
    await Admin.create({ name: env.admin.name, email: env.admin.email.toLowerCase(), passwordHash });
    console.log(`Created super admin: ${env.admin.email}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
