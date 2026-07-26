import bcrypt from 'bcryptjs';
import { db, assertDb } from '../src/db/database.js';

const passwordHash = await bcrypt.hash('password123', 10);
await db.from('forecasts').delete().neq('id', 0);
await db.from('sales_history').delete().neq('id', 0);
await db.from('products').delete().neq('id', 0);
await db.from('users').delete().neq('id', 0);

const user = assertDb(await db.from('users').insert({ name: 'Demo Owner', email: 'demo@inventory.edu', password_hash: passwordHash, role: 'admin' }).select().single());
const products = [
  ['Arabica Coffee Beans', 'COF-001', 'Beverages', 42, 30, 11.5, 7], ['Oat Milk Cartons', 'DRY-102', 'Dairy Alternatives', 22, 25, 2.4, 5],
  ['Paper Cups 12oz', 'SUP-210', 'Supplies', 310, 150, 0.08, 10], ['Blueberry Muffins', 'BAK-044', 'Bakery', 18, 20, 1.1, 2],
  ['Chocolate Cookies', 'BAK-050', 'Bakery', 55, 25, 0.65, 3], ['Green Tea Bags', 'TEA-012', 'Beverages', 75, 35, 0.18, 7],
  ['Receipt Paper Rolls', 'SUP-330', 'Supplies', 14, 18, 1.8, 14], ['Vanilla Syrup', 'SYR-005', 'Flavoring', 8, 10, 6.25, 6],
  ['Breakfast Sandwiches', 'FRZ-118', 'Frozen', 31, 22, 2.2, 3], ['Sparkling Water', 'DRK-203', 'Beverages', 66, 40, 0.9, 4],
  ['Compostable Lids', 'SUP-218', 'Supplies', 185, 120, 0.05, 10], ['House Blend Ground Coffee', 'COF-014', 'Beverages', 27, 24, 8.75, 7]
];

function isoDaysAgo(daysAgo) { const date = new Date(); date.setDate(date.getDate() - daysAgo); return date.toISOString().slice(0, 10); }
for (const [index, product] of products.entries()) {
  const row = assertDb(await db.from('products').insert({ user_id: user.id, name: product[0], sku: product[1], category: product[2], current_stock: product[3], reorder_point: product[4], unit_cost: product[5], lead_time_days: product[6] }).select().single());
  const sales = [];
  for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
    const weekday = new Date(`${isoDaysAgo(daysAgo)}T00:00:00`).getDay();
    const weekendBoost = weekday === 0 || weekday === 6 ? 4 : 0;
    const seasonal = Math.round(Math.sin((90 - daysAgo + index) / 9) * 2);
    sales.push({ product_id: row.id, date: isoDaysAgo(daysAgo), quantity_sold: Math.max(0, 3 + (index % 5) + weekendBoost + seasonal + ((daysAgo + index) % 4)) });
  }
  assertDb(await db.from('sales_history').insert(sales));
}
console.log('Seed complete');
console.log('Login: demo@inventory.edu / password123');
