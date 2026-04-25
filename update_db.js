const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'backend', 'database.sqlite'));

db.prepare('UPDATE business_profile SET static_qr_path = ? WHERE id = 1').run('uploads/settings/static_qr_image.jpg');
console.log("Updated business_profile with static QR image path.");
