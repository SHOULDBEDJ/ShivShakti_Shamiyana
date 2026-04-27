const db = require('./backend/database');

async function seed() {
  try {
    const res = await db.execute('SELECT id FROM business_profile WHERE id = 1');
    if (res.rows.length === 0) {
      await db.execute('INSERT INTO business_profile (id, business_name) VALUES (1, "Shiva Shakti Shamiyana")');
      console.log("Successfully seeded business_profile row with id=1");
    } else {
      console.log("Business profile row with id=1 already exists.");
    }
  } catch (err) {
    console.error("Error seeding business_profile:", err);
  } finally {
    process.exit();
  }
}

seed();
