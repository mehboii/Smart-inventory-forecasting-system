const PREFIX = '/Smartinventoryforecastingsystem';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
});
const fail = (message, status = 400) => json({ message }, status);
const now = () => new Date().toISOString();
const dateOnly = (days = 0) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

function token() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function passwordHash(password) {
  const bytes = new TextEncoder().encode(String(password));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, has_seen_walkthrough: Boolean(user.has_seen_walkthrough) };
}

async function currentUser(request, env) {
  const header = request.headers.get('authorization') || '';
  const value = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!value) return null;
  return env.DB.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?`).bind(value, now()).first();
}

async function requireUser(request, env) {
  const user = await currentUser(request, env);
  if (!user) throw new Response(JSON.stringify({ message: 'Authentication required' }), { status: 401, headers: { 'content-type': 'application/json' } });
  return user;
}

function productInput(body) {
  return [String(body.name || '').trim(), String(body.sku || '').trim(), String(body.category || '').trim(), Math.max(0, Number.parseInt(body.current_stock, 10) || 0), Math.max(0, Number.parseInt(body.reorder_point, 10) || 0), Math.max(0, Number(body.unit_cost) || 0), Math.max(1, Number.parseInt(body.lead_time_days, 10) || 7)];
}

async function dashboard(env, user) {
  const products = (await env.DB.prepare('SELECT * FROM products WHERE user_id = ? ORDER BY name').bind(user.id).all()).results;
  const sales = (await env.DB.prepare(`SELECT s.product_id, s.date, s.quantity_sold FROM sales_history s JOIN products p ON p.id=s.product_id WHERE p.user_id=? AND s.date>=? ORDER BY s.date`).bind(user.id, dateOnly(-13)).all()).results;
  const daily = new Map(); const perProduct = new Map();
  for (const sale of sales) { daily.set(sale.date, (daily.get(sale.date) || 0) + sale.quantity_sold); const list = perProduct.get(sale.product_id) || []; list.push(sale.quantity_sold); perProduct.set(sale.product_id, list); }
  const alerts = products.map((p) => { const values = (perProduct.get(p.id) || []).slice(-7); const demand = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; const reorderNeeded = p.current_stock <= p.reorder_point || p.current_stock < demand * p.lead_time_days; return { ...p, averageDailyDemand: Number(demand.toFixed(2)), reorderNeeded, suggestedReorderQuantity: Math.max(0, Math.ceil(demand * p.lead_time_days + p.reorder_point - p.current_stock)) }; }).filter((p) => p.reorderNeeded);
  const low = products.filter((p) => p.current_stock <= p.reorder_point); const due = products.filter((p) => p.current_stock <= p.reorder_point + 5); const counts = new Map(); products.forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + 1));
  return { metrics: { totalProducts: products.length, lowStockItems: low.length, dueForReorder: due.length, inventoryValue: Number(products.reduce((sum, p) => sum + p.current_stock * p.unit_cost, 0).toFixed(2)), openAlerts: alerts.length }, risk: { score: products.length ? Math.round(Math.min(1000, ((low.length * .65 + alerts.length * .35) / products.length) * 1000)) : 0, level: alerts.length ? 'Medium' : 'Low' }, products, alerts, salesTrend: Array.from({ length: 14 }, (_, i) => { const date = dateOnly(i - 13); return { date, quantitySold: daily.get(date) || 0 }; }), categoryMix: [...counts].map(([category, count]) => ({ category, count, percentage: Math.round((count / products.length) * 100) })), updatedAt: now() };
}

async function api(request, env, path) {
  const method = request.method;
  const body = method === 'GET' || method === 'DELETE' ? {} : await request.json().catch(() => ({}));
  if (path === '/health') return json({ status: 'ok' });
  if (path === '/auth/login' && method === 'POST') { const user = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(String(body.email || '').toLowerCase()).first(); if (!user || user.password_hash !== await passwordHash(body.password)) return fail('Invalid email or password', 401); const value = token(); await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(value, user.id, new Date(Date.now() + 604800000).toISOString()).run(); return json({ token: value, user: publicUser(user) }); }
  if (path === '/auth/register' && method === 'POST') { if (!body.name || !body.email || String(body.password || '').length < 6) return fail('Name, email, and a 6-character password are required'); try { const result = await env.DB.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').bind(String(body.name).trim(), String(body.email).trim().toLowerCase(), await passwordHash(body.password), body.role === 'admin' ? 'admin' : 'user').run(); const user = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(result.meta.last_row_id).first(); const value = token(); await env.DB.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)').bind(value,user.id,new Date(Date.now()+604800000).toISOString()).run(); return json({ token: value, user: publicUser(user) }, 201); } catch { return fail('Email already registered', 409); } }
  const user = await requireUser(request, env);
  if (path === '/auth/me') return json({ user: publicUser(user) });
  if (path === '/auth/walkthrough' && method === 'PATCH') { await env.DB.prepare('UPDATE users SET has_seen_walkthrough=1 WHERE id=?').bind(user.id).run(); return json({ user: { ...publicUser(user), has_seen_walkthrough: true } }); }
  if (path === '/auth/logout' && method === 'POST') return json({ message: 'Logged out' });
  if (path === '/dashboard') return json(await dashboard(env, user));
  if (path === '/products' && method === 'GET') return json({ products: (await env.DB.prepare('SELECT * FROM products WHERE user_id=? ORDER BY name').bind(user.id).all()).results });
  if (path === '/products' && method === 'POST') { const values = productInput(body); if (!values[0] || !values[1] || !values[2]) return fail('Name, SKU, and category are required'); try { const result = await env.DB.prepare('INSERT INTO products (user_id,name,sku,category,current_stock,reorder_point,unit_cost,lead_time_days) VALUES (?,?,?,?,?,?,?,?)').bind(user.id,...values).run(); return json({ product: await env.DB.prepare('SELECT * FROM products WHERE id=?').bind(result.meta.last_row_id).first() }, 201); } catch { return fail('SKU already exists', 409); } }
  const productMatch = path.match(/^\/products\/(\d+)$/);
  if (productMatch && method === 'PUT') { const values = productInput(body); await env.DB.prepare('UPDATE products SET name=?,sku=?,category=?,current_stock=?,reorder_point=?,unit_cost=?,lead_time_days=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').bind(...values, Number(productMatch[1]), user.id).run(); return json({ product: await env.DB.prepare('SELECT * FROM products WHERE id=?').bind(Number(productMatch[1])).first() }); }
  if (productMatch && method === 'DELETE') { const result = await env.DB.prepare('DELETE FROM products WHERE id=? AND user_id=?').bind(Number(productMatch[1]), user.id).run(); return result.meta.changes ? json({ message: 'Product deleted' }) : fail('Product not found', 404); }
  const salesMatch = path.match(/^\/sales\/(\d+)(\/bulk)?$/);
  if (salesMatch) { const id = Number(salesMatch[1]); const owned = await env.DB.prepare('SELECT id FROM products WHERE id=? AND user_id=?').bind(id,user.id).first(); if (!owned) return fail('Product not found',404); if (method === 'GET') return json({ sales: (await env.DB.prepare('SELECT * FROM sales_history WHERE product_id=? ORDER BY date').bind(id).all()).results }); const rows = salesMatch[2] ? (body.rows || []) : [body]; await env.DB.batch(rows.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date || '')).map((r) => env.DB.prepare('INSERT INTO sales_history (product_id,date,quantity_sold) VALUES (?,?,?) ON CONFLICT(product_id,date) DO UPDATE SET quantity_sold=excluded.quantity_sold').bind(id,r.date,Math.max(0,Number.parseInt(r.quantity_sold,10)||0)))); return json(salesMatch[2] ? { imported: rows.length } : { sale: await env.DB.prepare('SELECT * FROM sales_history WHERE product_id=? AND date=?').bind(id,body.date).first() },201); }
  return fail('Not found', 404);
}

export default { async fetch(request, env) { const url = new URL(request.url); if (!url.pathname.startsWith(PREFIX)) return new Response('Not found', { status: 404 }); const relative = url.pathname.slice(PREFIX.length) || '/'; if (relative.startsWith('/api')) { try { return await api(request, env, relative.slice(4) || '/'); } catch (error) { if (error instanceof Response) return error; return fail('Unexpected server error', 500); } } return env.ASSETS.fetch(request); } };
