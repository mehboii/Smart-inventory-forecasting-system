import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const APP_PREFIX = '/Smartinventoryforecastingsystem';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

let cachedDb;
let cachedDbKey;

function getDb(env) {
  const url = env.SUPABASE_URL || 'https://lmchqykidfdyanndexjp.supabase.co';
  const key = env.SUPABASE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('SUPABASE_KEY is required.');
  const cacheKey = `${url}:${key}`;
  if (!cachedDb || cachedDbKey !== cacheKey) {
    cachedDb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    cachedDbKey = cacheKey;
  }
  return cachedDb;
}

function assertDb(result, message = 'Database request failed') {
  if (result.error) {
    const error = new Error(result.error.message || message);
    error.code = result.error.code;
    throw error;
  }
  return result.data;
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers || {})
    }
  });
}

function text(data, init = {}) {
  return new Response(data, {
    status: init.status || 200,
    headers: init.headers || {}
  });
}

function base64UrlEncode(bytes) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecode(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function createToken(user, env) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  })));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(env.JWT_SECRET || 'development_secret_change_me'), new TextEncoder().encode(`${header}.${payload}`)));
  return `${header}.${payload}.${base64UrlEncode(signature)}`;
}

async function verifyToken(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [header, payload, signature] = parts;
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(env.JWT_SECRET || 'development_secret_change_me'),
    base64UrlDecode(signature),
    new TextEncoder().encode(`${header}.${payload}`)
  );
  if (!valid) throw new Error('Invalid token');
  const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) throw new Error('Expired token');
  return claims;
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.get('Cookie') || '').split(';').map((part) => {
    const [name, ...rest] = part.trim().split('=');
    return [name, rest.join('=')];
  }).filter(([name]) => name));
}

async function readBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return {};
  return request.json().catch(() => ({}));
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  return missing.length ? `Missing required field(s): ${missing.join(', ')}` : null;
}

function toPositiveInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toPositiveFloat(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, has_seen_walkthrough: Boolean(user.has_seen_walkthrough) };
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validRole(role) {
  return ['admin', 'manager', 'user'].includes(role);
}

function normalizeProduct(body) {
  return {
    name: String(body.name || '').trim(),
    sku: String(body.sku || '').trim(),
    category: String(body.category || '').trim(),
    current_stock: toPositiveInt(body.current_stock),
    reorder_point: toPositiveInt(body.reorder_point),
    unit_cost: toPositiveFloat(body.unit_cost),
    lead_time_days: Math.max(toPositiveInt(body.lead_time_days, 7), 1)
  };
}

function addDays(date, days) {
  const copy = new Date(`${date}T00:00:00.000Z`);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

function isoDateDaysAgo(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function movingAverage(history, horizon, windowSize) {
  const rolling = history.map((row) => row.quantity_sold);
  const predictions = [];
  for (let index = 0; index < horizon; index += 1) {
    const predicted = average(rolling.slice(-windowSize));
    predictions.push(Number(predicted.toFixed(2)));
    rolling.push(predicted);
  }
  return predictions;
}

function exponentialSmoothing(history, horizon, alpha) {
  const quantities = history.map((row) => row.quantity_sold);
  let smoothed = quantities[0] ?? 0;
  for (let index = 1; index < quantities.length; index += 1) {
    smoothed = alpha * quantities[index] + (1 - alpha) * smoothed;
  }
  return Array.from({ length: horizon }, () => Number(smoothed.toFixed(2)));
}

async function generateForecast(db, { productId, method = 'moving_average', horizon = 14, windowSize = 7, alpha = 0.35 }) {
  const product = assertDb(await db.from('products').select('*').eq('id', productId).maybeSingle());
  if (!product) {
    const error = new Error('Product not found');
    error.status = 404;
    throw error;
  }

  const history = assertDb(await db.from('sales_history').select('date, quantity_sold').eq('product_id', productId).order('date'));
  if (!history.length) {
    const error = new Error('At least one historical sales entry is required');
    error.status = 400;
    throw error;
  }

  const safeHorizon = Math.min(Math.max(Number.parseInt(horizon, 10) || 14, 1), 90);
  const safeWindow = Math.min(Math.max(Number.parseInt(windowSize, 10) || 7, 1), history.length);
  const safeAlpha = Math.min(Math.max(Number.parseFloat(alpha) || 0.35, 0.01), 1);
  const lastDate = history[history.length - 1].date;
  const predictions = method === 'exponential_smoothing'
    ? exponentialSmoothing(history, safeHorizon, safeAlpha)
    : movingAverage(history, safeHorizon, safeWindow);
  const today = new Date().toISOString().slice(0, 10);
  const forecastBaseDate = lastDate > today ? lastDate : today;
  const series = predictions.map((predictedDemand, index) => ({ forecast_date: addDays(forecastBaseDate, index + 1), predicted_demand: predictedDemand }));
  const totalPredictedDemand = predictions.reduce((sum, value) => sum + value, 0);
  const averageDailyDemand = totalPredictedDemand / predictions.length;
  const daysUntilStockout = averageDailyDemand > 0 ? product.current_stock / averageDailyDemand : null;
  const likelyStockoutDate = daysUntilStockout === null ? null : addDays(today, Math.floor(daysUntilStockout));
  const leadTimeDemand = averageDailyDemand * product.lead_time_days;
  const reorderNeeded = product.current_stock <= product.reorder_point || product.current_stock < leadTimeDemand;
  const suggestedReorderQuantity = reorderNeeded ? Math.max(0, Math.ceil(leadTimeDemand + product.reorder_point - product.current_stock)) : 0;

  assertDb(await db.from('forecasts').delete().eq('product_id', productId).eq('method', method));
  assertDb(await db.from('forecasts').insert(series.map((point) => ({ product_id: productId, ...point, method }))));

  const explanation = method === 'exponential_smoothing'
    ? `Exponential smoothing was calculated with alpha ${safeAlpha}. Recent sales receive more weight, while older sales still influence the estimate. The final smoothed value is projected across the next ${safeHorizon} day(s).`
    : `Simple moving average was calculated from the last ${safeWindow} available sales value(s). Each forecast step averages the most recent window and rolls the predicted value forward for the next ${safeHorizon} day(s).`;

  return {
    product,
    method,
    history,
    forecast: series,
    explanation,
    alert: {
      reorderNeeded,
      averageDailyDemand: Number(averageDailyDemand.toFixed(2)),
      likelyStockoutDate,
      suggestedReorderQuantity,
      reorderByDate: reorderNeeded ? addDays(likelyStockoutDate || new Date().toISOString().slice(0, 10), -product.lead_time_days) : null
    }
  };
}

async function authenticate(request, env) {
  const header = request.headers.get('Authorization') || '';
  const cookies = parseCookies(request);
  const token = header.startsWith('Bearer ') ? header.slice(7) : cookies.token;
  if (!token) throw Object.assign(new Error('Authentication required'), { status: 401 });
  try {
    return await verifyToken(token, env);
  } catch {
    throw Object.assign(new Error('Invalid or expired session'), { status: 401 });
  }
}

async function ensureProductOwnership(db, productId, userId) {
  return assertDb(await db.from('products').select('id').eq('id', productId).eq('user_id', userId).maybeSingle());
}

async function handleAuth(request, env, db, path) {
  const body = await readBody(request);
  if (request.method === 'POST' && path === '/auth/register') {
    const error = requireFields(body, ['name', 'email', 'password']);
    if (error) return json({ message: error }, { status: 400 });
    if (String(body.password).length < 6) return json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    const email = body.email.trim().toLowerCase();
    const admins = await db.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin');
    if (admins.error) return json({ message: 'Registration failed' }, { status: 500 });
    let role = 'user';
    let invitation;
    if (admins.count === 0) {
      role = 'admin';
    } else {
      invitation = assertDb(await db.from('invitations').select('*').eq('token', String(body.inviteToken || '')).eq('email', email).is('accepted_at', null).gt('expires_at', new Date().toISOString()).maybeSingle());
      if (!invitation) return json({ message: 'An active invitation is required. Ask an administrator to invite you.' }, { status: 403 });
      role = invitation.role;
    }
    const password_hash = await bcrypt.hash(body.password, 10);
    const result = await db.from('users').insert({
      name: body.name.trim(),
      email,
      password_hash,
      role
    }).select().single();
    if (result.error) return json({ message: result.error.code === '23505' ? 'Email already registered' : 'Registration failed' }, { status: result.error.code === '23505' ? 409 : 500 });
    if (invitation) assertDb(await db.from('invitations').update({ accepted_at: new Date().toISOString() }).eq('id', invitation.id));
    const token = await createToken(result.data, env);
    return json({ token, user: publicUser(result.data) }, { status: 201, headers: { 'Set-Cookie': `token=${token}; HttpOnly; SameSite=Lax; Secure; Path=${APP_PREFIX}; Max-Age=${TOKEN_TTL_SECONDS}` } });
  }

  if (request.method === 'POST' && path === '/auth/login') {
    const error = requireFields(body, ['email', 'password']);
    if (error) return json({ message: error }, { status: 400 });
    const user = assertDb(await db.from('users').select('*').eq('email', body.email.trim().toLowerCase()).maybeSingle());
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) return json({ message: 'Invalid email or password' }, { status: 401 });
    const token = await createToken(user, env);
    return json({ token, user: publicUser(user) }, { headers: { 'Set-Cookie': `token=${token}; HttpOnly; SameSite=Lax; Secure; Path=${APP_PREFIX}; Max-Age=${TOKEN_TTL_SECONDS}` } });
  }

  if (request.method === 'POST' && path === '/auth/logout') {
    return json({ message: 'Logged out' }, { headers: { 'Set-Cookie': `token=; HttpOnly; SameSite=Lax; Secure; Path=${APP_PREFIX}; Max-Age=0` } });
  }

  const user = await authenticate(request, env);
  const currentUser = assertDb(await db.from('users').select('*').eq('id', user.id).maybeSingle());
  if (!currentUser) return json({ message: 'User not found' }, { status: 404 });
  if (request.method === 'GET' && path === '/auth/team') {
    const members = assertDb(await db.from('users').select('id,name,role,created_at').order('created_at'));
    const owner = assertDb(await db.from('users').select('id,name,email,created_at').eq('role', 'admin').order('created_at').limit(1).maybeSingle());
    return json({ owner: owner || null, memberCount: members.length, members });
  }
  if (path.startsWith('/auth/admin/') && currentUser.role !== 'admin') return json({ message: 'Admin role required' }, { status: 403 });
  if (request.method === 'GET' && path === '/auth/admin/users') {
    const [users, owner] = await Promise.all([
      db.from('users').select('id,name,email,role,created_at').order('created_at'),
      db.from('users').select('id').eq('role', 'admin').order('created_at').limit(1).maybeSingle()
    ]);
    return json({ users: assertDb(users), ownerId: assertDb(owner)?.id || null });
  }
  const userRoleMatch = path.match(/^\/auth\/admin\/users\/([^/]+)\/role$/);
  if (request.method === 'PATCH' && userRoleMatch) {
    const role = String(body.role || '');
    if (!validRole(role)) return json({ message: 'Role must be admin, manager, or user' }, { status: 400 });
    const target = assertDb(await db.from('users').select('*').eq('id', userRoleMatch[1]).maybeSingle());
    if (!target) return json({ message: 'User not found' }, { status: 404 });
    const owner = assertDb(await db.from('users').select('id').eq('role', 'admin').order('created_at').limit(1).maybeSingle());
    if (String(target.id) === String(owner?.id)) return json({ message: 'The main owner role cannot be changed' }, { status: 403 });
    if (target.role === 'admin' && role !== 'admin') {
      const admins = assertDb(await db.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin'));
      if (admins.count === 1) return json({ message: 'At least one administrator must remain' }, { status: 400 });
    }
    const updated = assertDb(await db.from('users').update({ role }).eq('id', target.id).select().single());
    return json({ user: publicUser(updated) });
  }
  const deleteUserMatch = path.match(/^\/auth\/admin\/users\/([^/]+)$/);
  if (request.method === 'DELETE' && deleteUserMatch) {
    const target = assertDb(await db.from('users').select('*').eq('id', deleteUserMatch[1]).maybeSingle());
    if (!target) return json({ message: 'User not found' }, { status: 404 });
    const owner = assertDb(await db.from('users').select('id').eq('role', 'admin').order('created_at').limit(1).maybeSingle());
    if (String(target.id) === String(owner?.id)) return json({ message: 'The main owner cannot be removed' }, { status: 403 });
    if (target.role === 'admin' && String(currentUser.id) !== String(owner?.id)) return json({ message: 'Only the main owner can remove another administrator' }, { status: 403 });
    assertDb(await db.from('users').delete().eq('id', target.id));
    return json({ message: 'User removed' });
  }
  if (request.method === 'GET' && path === '/auth/admin/invitations') {
    return json({ invitations: assertDb(await db.from('invitations').select('id,email,role,token,expires_at,accepted_at,created_at').order('created_at', { ascending: false })) });
  }
  if (request.method === 'POST' && path === '/auth/admin/invitations') {
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || 'user');
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ message: 'A valid email is required' }, { status: 400 });
    if (!validRole(role)) return json({ message: 'Role must be admin, manager, or user' }, { status: 400 });
    const existing = assertDb(await db.from('users').select('id').eq('email', email).maybeSingle());
    if (existing) return json({ message: 'This email is already registered' }, { status: 409 });
    const invitation = assertDb(await db.from('invitations').insert({ email, role, token: randomToken(), invited_by: String(currentUser.id), expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }).select('id,email,role,token,expires_at,accepted_at,created_at').single());
    return json({ invitation }, { status: 201 });
  }
  const invitationMatch = path.match(/^\/auth\/admin\/invitations\/([^/]+)$/);
  if (request.method === 'DELETE' && invitationMatch) {
    const deleted = assertDb(await db.from('invitations').delete().eq('id', invitationMatch[1]).is('accepted_at', null).select('id'));
    return deleted.length ? json({ message: 'Invitation cancelled' }) : json({ message: 'Pending invitation not found' }, { status: 404 });
  }
  if (request.method === 'GET' && path === '/auth/me') {
    return currentUser ? json({ user: publicUser(currentUser) }) : json({ message: 'User not found' }, { status: 404 });
  }
  if (request.method === 'PATCH' && path === '/auth/walkthrough') {
    const updated = assertDb(await db.from('users').update({ has_seen_walkthrough: true }).eq('id', user.id).select().single());
    return json({ user: publicUser(updated) });
  }
  return null;
}

async function handleProducts(request, env, db, path) {
  const user = await authenticate(request, env);
  const body = await readBody(request);
  const productId = path.match(/^\/products\/([^/]+)$/)?.[1];

  if (request.method === 'GET' && path === '/products') {
    return json({ products: assertDb(await db.from('products').select('*').eq('user_id', user.id).order('name')) });
  }
  if (request.method === 'GET' && path === '/products/summary/metrics') {
    const products = assertDb(await db.from('products').select('*').eq('user_id', user.id));
    const lowStockItems = products.filter((product) => product.current_stock <= product.reorder_point);
    const dueForReorder = products.filter((product) => product.current_stock <= product.reorder_point + 5);
    return json({
      totalProducts: products.length,
      lowStockItems: lowStockItems.length,
      dueForReorder: dueForReorder.length,
      inventoryValue: Number(products.reduce((sum, product) => sum + product.current_stock * Number(product.unit_cost), 0).toFixed(2))
    });
  }
  if (request.method === 'POST' && path === '/products') {
    const error = requireFields(body, ['name', 'sku', 'category']);
    if (error) return json({ message: error }, { status: 400 });
    const result = await db.from('products').insert({ user_id: user.id, ...normalizeProduct(body) }).select().single();
    if (result.error) return json({ message: result.error.code === '23505' ? 'SKU already exists' : 'Product creation failed' }, { status: result.error.code === '23505' ? 409 : 500 });
    return json({ product: result.data }, { status: 201 });
  }
  if (request.method === 'PUT' && productId) {
    const existing = assertDb(await db.from('products').select('id').eq('id', productId).eq('user_id', user.id).maybeSingle());
    if (!existing) return json({ message: 'Product not found' }, { status: 404 });
    const error = requireFields(body, ['name', 'sku', 'category']);
    if (error) return json({ message: error }, { status: 400 });
    const result = await db.from('products').update({ ...normalizeProduct(body), updated_at: new Date().toISOString() }).eq('id', productId).eq('user_id', user.id).select().single();
    if (result.error) return json({ message: result.error.code === '23505' ? 'SKU already exists' : 'Product update failed' }, { status: result.error.code === '23505' ? 409 : 500 });
    assertDb(await db.from('forecasts').delete().eq('product_id', productId));
    return json({ product: result.data });
  }
  if (request.method === 'DELETE' && productId) {
    const result = await db.from('products').delete().eq('id', productId).eq('user_id', user.id).select('id');
    if (result.error) return json({ message: 'Product deletion failed' }, { status: 500 });
    return result.data.length ? json({ message: 'Product deleted' }) : json({ message: 'Product not found' }, { status: 404 });
  }
  return null;
}

async function handleSales(request, env, db, path) {
  const user = await authenticate(request, env);
  const body = await readBody(request);
  const bulkMatch = path.match(/^\/sales\/([^/]+)\/bulk$/);
  const match = path.match(/^\/sales\/([^/]+)$/);
  const productId = bulkMatch?.[1] || match?.[1];
  if (!productId) return null;
  if (!await ensureProductOwnership(db, productId, user.id)) return json({ message: 'Product not found' }, { status: 404 });

  if (request.method === 'GET' && match) {
    return json({ sales: assertDb(await db.from('sales_history').select('*').eq('product_id', productId).order('date')) });
  }
  if (request.method === 'POST' && match) {
    const error = requireFields(body, ['date', 'quantity_sold']);
    if (error) return json({ message: error }, { status: 400 });
    if (!isIsoDate(body.date)) return json({ message: 'Date must use YYYY-MM-DD format' }, { status: 400 });
    const row = { date: body.date, quantity_sold: toPositiveInt(body.quantity_sold) };
    assertDb(await db.from('sales_history').upsert([{ product_id: productId, ...row }], { onConflict: 'product_id,date' }));
    assertDb(await db.from('forecasts').delete().eq('product_id', productId));
    return json({ sale: assertDb(await db.from('sales_history').select('*').eq('product_id', productId).eq('date', row.date).single()) }, { status: 201 });
  }
  if (request.method === 'POST' && bulkMatch) {
    const normalized = (Array.isArray(body.rows) ? body.rows : []).filter((row) => isIsoDate(row.date)).map((row) => ({ date: row.date, quantity_sold: toPositiveInt(row.quantity_sold) }));
    if (!normalized.length) return json({ message: 'No valid sales rows provided' }, { status: 400 });
    assertDb(await db.from('sales_history').upsert(normalized.map((row) => ({ product_id: productId, ...row })), { onConflict: 'product_id,date' }));
    assertDb(await db.from('forecasts').delete().eq('product_id', productId));
    return json({ imported: normalized.length }, { status: 201 });
  }
  return null;
}

async function handleForecasts(request, env, db, path) {
  const user = await authenticate(request, env);
  const body = await readBody(request);
  const productMatch = path.match(/^\/forecasts\/([^/]+)$/);
  if (request.method === 'POST' && productMatch) {
    const productId = productMatch[1];
    const product = assertDb(await db.from('products').select('id').eq('id', productId).eq('user_id', user.id).maybeSingle());
    if (!product) return json({ message: 'Product not found' }, { status: 404 });
    try {
      return json(await generateForecast(db, {
        productId: Number(productId),
        method: body.method,
        horizon: body.horizon,
        windowSize: body.windowSize,
        alpha: body.alpha
      }));
    } catch (error) {
      return json({ message: error.message || 'Forecast generation failed' }, { status: error.status || 500 });
    }
  }
  if (request.method === 'GET' && path === '/forecasts/alerts/summary') {
    const products = assertDb(await db.from('products').select('id, name, sku, current_stock, reorder_point, lead_time_days').eq('user_id', user.id));
    const alerts = (await Promise.all(products.map(async (product) => {
      const recent = assertDb(await db.from('sales_history').select('quantity_sold').eq('product_id', product.id).order('date', { ascending: false }).limit(7)).map((row) => row.quantity_sold);
      const averageDemand = average(recent);
      const leadTimeDemand = averageDemand * product.lead_time_days;
      return {
        ...product,
        averageDailyDemand: Number(averageDemand.toFixed(2)),
        reorderNeeded: product.current_stock <= product.reorder_point || product.current_stock < leadTimeDemand,
        suggestedReorderQuantity: Math.max(0, Math.ceil(leadTimeDemand + product.reorder_point - product.current_stock))
      };
    }))).filter((alert) => alert.reorderNeeded);
    return json({ alerts });
  }
  return null;
}

async function handleDashboard(request, env, db, path) {
  if (request.method !== 'GET' || path !== '/dashboard') return null;
  const user = await authenticate(request, env);
  const products = assertDb(await db.from('products').select('*').eq('user_id', user.id).order('name'));
  const productIds = products.map((product) => product.id);
  const fromDate = isoDateDaysAgo(13);
  const sales = productIds.length
    ? assertDb(await db.from('sales_history').select('product_id, date, quantity_sold').in('product_id', productIds).order('date'))
    : [];
  const salesByProduct = new Map();
  const salesByDate = new Map();
  for (const sale of sales) {
    const productSales = salesByProduct.get(sale.product_id) || [];
    productSales.push(Number(sale.quantity_sold));
    salesByProduct.set(sale.product_id, productSales);
    if (sale.date >= fromDate) salesByDate.set(sale.date, (salesByDate.get(sale.date) || 0) + Number(sale.quantity_sold));
  }
  const alerts = products.map((product) => {
    const recentSales = (salesByProduct.get(product.id) || []).slice(-7);
    const averageDailyDemand = average(recentSales);
    const leadTimeDemand = averageDailyDemand * product.lead_time_days;
    const reorderNeeded = product.current_stock <= product.reorder_point || product.current_stock < leadTimeDemand;
    return {
      ...product,
      averageDailyDemand: Number(averageDailyDemand.toFixed(2)),
      reorderNeeded,
      suggestedReorderQuantity: Math.max(0, Math.ceil(leadTimeDemand + product.reorder_point - product.current_stock))
    };
  }).filter((alert) => alert.reorderNeeded);
  const lowStockItems = products.filter((product) => product.current_stock <= product.reorder_point);
  const dueForReorder = products.filter((product) => product.current_stock <= product.reorder_point + 5);
  const riskScore = products.length ? Math.round(Math.min(1000, ((lowStockItems.length * 0.65 + alerts.length * 0.35) / products.length) * 1000)) : 0;
  const categoryCounts = products.reduce((counts, product) => counts.set(product.category, (counts.get(product.category) || 0) + 1), new Map());
  const alertIds = new Set(alerts.map((alert) => String(alert.id)));

  return json({
    metrics: {
      totalProducts: products.length,
      lowStockItems: lowStockItems.length,
      dueForReorder: dueForReorder.length,
      inventoryValue: Number(products.reduce((sum, product) => sum + product.current_stock * Number(product.unit_cost), 0).toFixed(2)),
      openAlerts: alerts.length
    },
    risk: { score: riskScore, level: riskScore >= 700 ? 'High' : riskScore >= 400 ? 'Medium' : 'Low' },
    products: products.map((product) => ({ ...product, reorderNeeded: alertIds.has(String(product.id)) })),
    alerts,
    salesTrend: Array.from(salesByDate, ([date, quantitySold]) => ({ date, quantitySold })),
    categoryMix: Array.from(categoryCounts, ([category, count]) => ({ category, count, percentage: products.length ? Math.round((count / products.length) * 100) : 0 })).sort((a, b) => b.count - a.count),
    updatedAt: new Date().toISOString()
  });
}

function csvEscape(value) {
  const content = String(value ?? '');
  return content.includes(',') || content.includes('"') || content.includes('\n') ? `"${content.replaceAll('"', '""')}"` : content;
}

async function handleReports(request, env, db, path) {
  if (request.method !== 'GET' || path !== '/reports/inventory-forecast.csv') return null;
  const user = await authenticate(request, env);
  const products = assertDb(await db.from('products').select('name, sku, category, current_stock, reorder_point, unit_cost, id').eq('user_id', user.id).order('name'));
  const rows = [];
  for (const product of products) {
    const forecasts = assertDb(await db.from('forecasts').select('forecast_date, predicted_demand, method').eq('product_id', product.id).order('forecast_date'));
    if (!forecasts.length) rows.push({ ...product, forecast_date: null, predicted_demand: null, method: null });
    forecasts.forEach((forecast) => rows.push({ ...product, ...forecast }));
  }
  const header = ['name', 'sku', 'category', 'current_stock', 'reorder_point', 'unit_cost', 'forecast_date', 'predicted_demand', 'method'];
  const csv = [header.join(','), ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(','))].join('\n');
  return text(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="inventory_forecast.csv"',
      'Cache-Control': 'no-store'
    }
  });
}

async function handleLive(request, env, _db, path) {
  if (request.method !== 'GET' || path !== '/live') return null;
  await authenticate(request, env);
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', updatedAt: new Date().toISOString() })}\n\n`));
      controller.close();
    }
  }), {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      'Content-Type': 'text/event-stream',
      'X-Accel-Buffering': 'no'
    }
  });
}

async function handleApi(request, env, path) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method === 'GET' && path === '/health') return json({ status: 'ok' });
  const db = getDb(env);
  const handlers = [handleAuth, handleProducts, handleSales, handleForecasts, handleDashboard, handleReports, handleLive];
  for (const handler of handlers) {
    const response = await handler(request, env, db, path);
    if (response) return response;
  }
  return json({ message: 'Not found' }, { status: 404 });
}

async function serveAsset(request, env) {
  const url = new URL(request.url);
  const appPath = url.pathname.slice(APP_PREFIX.length);
  const isNavigation = request.headers.get('Sec-Fetch-Mode') === 'navigate';
  if (isNavigation && appPath && !appPath.includes('.')) {
    url.pathname = `${APP_PREFIX}/index.html`;
    return env.ASSETS.fetch(new Request(url, request));
  }

  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404 || !isNavigation) return response;
  url.pathname = `${APP_PREFIX}/index.html`;
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname === APP_PREFIX) {
        url.pathname = `${APP_PREFIX}/`;
        return Response.redirect(url, 308);
      }
      if (url.pathname.startsWith(`${APP_PREFIX}/api`)) {
        const apiPath = url.pathname.slice(`${APP_PREFIX}/api`.length) || '/';
        return handleApi(request, env, apiPath);
      }
      return serveAsset(request, env);
    } catch (error) {
      console.error(error);
      return json({ message: error.status ? error.message : 'Unexpected server error' }, { status: error.status || 500 });
    }
  }
};
