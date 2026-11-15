'use strict';
const crypto = require('crypto');
const { fail } = require('./util');

const COOKIE = 'sh_admin';
const TTL = 60 * 60 * 12;

const key = () => process.env.SESSION_SECRET || 'sh:' + (process.env.ADMIN_PASSWORD || '');
const sign = data => crypto.createHmac('sha256', key()).update(data).digest('base64url');

function makeToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + TTL })).toString('base64url');
  return payload + '.' + sign(payload);
}

function readCookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}

function isAdmin(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const [payload, sig] = readCookie(req, COOKIE).split('.');
  if (!payload || !sig) return false;
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now() / 1000; } catch { return false; }
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  fail(res, 401, 'Not signed in');
  return false;
}

function cookieHeader(req, token, maxAge) {
  const local = /^(localhost|127\.0\.0\.1)/.test(req.headers.host || '');
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${local ? '' : '; Secure'}`;
}

module.exports = { makeToken, isAdmin, requireAdmin, cookieHeader, TTL };
