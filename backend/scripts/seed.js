import bcrypt from 'bcryptjs';
import { db } from '../src/db/database.js';

const passwordHash = await bcrypt.hash('password123', 10);

db.prepare('DELETE FROM forecasts').run();
db.prepare('DELETE FROM sales_history').run();
db.prepare('DELETE FROM products').run();
db.prepare('DELETE FROM users').run();
db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('users', 'products', 'sales_history', 'forecasts')").run();

const userResult = db
  .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
  .run('Demo Owner', 'demo@inventory.edu', passwordHash, 'admin');
const userId = userResult.lastInsertRowid;

const products = [
  ['Arabica Coffee Beans', 'COF-001', 'Beverages', 42, 30, 11.5, 7],
  ['Oat Milk Cartons', 'DRY-102', 'Dairy Alternatives', 22, 25, 2.4, 5],
  ['Paper Cups 12oz', 'SUP-210', 'Supplies', 310, 150, 0.08, 10],
  ['Blueberry Muffins', 'BAK-044', 'Bakery', 18, 20, 1.1, 2],
  ['Chocolate Cookies', 'BAK-050', 'Bakery', 55, 25, 0.65, 3],
  ['Green Tea Bags', 'TEA-012', 'Beverages', 75, 35, 0.18, 7],
  ['Receipt Paper Rolls', 'SUP-330', 'Supplies', 14, 18, 1.8, 14],
  ['Vanilla Syrup', 'SYR-005', 'Flavoring', 8, 10, 6.25, 6],
  ['Breakfast Sandwiches', 'FRZ-118', 'Frozen', 31, 22, 2.2, 3],
  ['Sparkling Water', 'DRK-203', 'Beverages', 66, 40, 0.9, 4],
  ['Compostable Lids', 'SUP-218', 'Supplies', 185, 120, 0.05, 10],
  ['House Blend Ground Coffee', 'COF-014', 'Beverages', 27, 24, 8.75, 7]
];

const insertProduct = db.prepare(
  `INSERT INTO products (user_id, name, sku, category, current_stock, reorder_point, unit_cost, lead_time_days)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertSale = db.prepare('INSERT INTO sales_history (product_id, date, quantity_sold) VALUES (?, ?, ?)');

function isoDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

products.forEach((product, productIndex) => {
  const result = insertProduct.run(userId, ...product);
  for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
    const weekday = new Date(`${isoDaysAgo(daysAgo)}T00:00:00`).getDay();
    const weekendBoost = weekday === 0 || weekday === 6 ? 4 : 0;
    const seasonal = Math.round(Math.sin((90 - daysAgo + productIndex) / 9) * 2);
    const baseline = 3 + (productIndex % 5) + weekendBoost + seasonal;
    const quantity = Math.max(0, baseline + ((daysAgo + productIndex) % 4));
    insertSale.run(result.lastInsertRowid, isoDaysAgo(daysAgo), quantity);
  }
});

console.log('Seed complete');
console.log('Login: demo@inventory.edu / password123');
