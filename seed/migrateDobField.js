// One-off migration for the birthday -> dob rename (see BACKEND SYNC notes).
// Renames the stored field in place so existing data keeps working under the
// new name — Business.signupFields.birthday -> signupFields.dob, and
// Customer.birthday -> Customer.dob (legacy customers keep their plain
// "MM-DD" value under the new field name; no year is backfilled).
const connectDB = require("../src/config/db");
const mongoose = require("mongoose");

async function run() {
  const conn = await connectDB();
  const db = conn.connection.db;

  const businessResult = await db.collection("businesses").updateMany(
    { "signupFields.birthday": { $exists: true } },
    [
      { $set: { "signupFields.dob": "$signupFields.birthday" } },
      { $unset: "signupFields.birthday" },
    ]
  );
  console.log(`Businesses migrated: ${businessResult.modifiedCount}`);

  const customerResult = await db.collection("customers").updateMany(
    { birthday: { $exists: true } },
    [{ $set: { dob: "$birthday" } }, { $unset: "birthday" }]
  );
  console.log(`Customers migrated: ${customerResult.modifiedCount}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
