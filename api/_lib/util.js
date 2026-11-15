'use strict';
const crypto = require('crypto');

const PRODUCTS = {
  Apex: { warranty: 10, colors: ['Gloss'] },
  Elite: { warranty: 8, colors: ['Gloss'] },
  Aura: { warranty: 6, colors: ['Gloss'] },
  Special: { warranty: 5, colors: ['Matte', 'Black matte', 'Black glossy', 'Coloured'] },
};

const normVehicle = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const validVehicle = v => /^[A-Z0-9]{6,12}$/.test(v);
const validPhone = p => /^\d{10}$/.test(p);
const str = v => (typeof v === 'string' ? v.trim() : '');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function fail(res, status, error) { send(res, status, { error }); }

function body(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  try { return JSON.parse(b || '{}'); } catch { return {}; }
}

function ctEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

module.exports = { PRODUCTS, normVehicle, validVehicle, validPhone, str, send, fail, body, ctEqual };
