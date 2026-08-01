import { db } from '../src/db/database.js';

// Development reset only. Deliberately does not create demo users, products,
// or sales: the UI must display records entered by the current user.
db.transaction(() => {
  db.prepare('DELETE FROM forecasts').run();
  db.prepare('DELETE FROM sales_history').run();
  db.prepare('DELETE FROM products').run();
  db.prepare('DELETE FROM users').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('users', 'products', 'sales_history', 'forecasts')").run();
})();

console.log('Development database reset. No demo data was inserted.');
