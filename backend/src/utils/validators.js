export function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  if (missing.length) {
    return `Missing required field(s): ${missing.join(', ')}`;
  }
  return null;
}

export function toPositiveInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function toPositiveFloat(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}
