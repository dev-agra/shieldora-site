'use strict';
const { makeToken, isAdmin, cookieHeader, TTL } = require('../_lib/auth');
const { send, fail, body, ctEqual } = require('../_lib/util');

module.exports = async (req, res) => {
  if (req.method === 'GET') return send(res, 200, { admin: isAdmin(req) });

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookieHeader(req, '', 0));
    return send(res, 200, { ok: true });
  }

  if (req.method === 'POST') {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) return fail(res, 500, 'ADMIN_PASSWORD is not configured on the server');
    const pw = String(body(req).password || '');
    await new Promise(r => setTimeout(r, 400));
    if (!ctEqual(pw, expected)) return fail(res, 401, 'Incorrect password');
    res.setHeader('Set-Cookie', cookieHeader(req, makeToken(), TTL));
    return send(res, 200, { ok: true });
  }

  fail(res, 405, 'Method not allowed');
};
