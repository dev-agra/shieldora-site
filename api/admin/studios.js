'use strict';
const { query, num } = require('../_lib/db');
const { requireAdmin } = require('../_lib/auth');
const { validPhone, str, send, fail, body } = require('../_lib/util');

function parse(b) {
  const name = str(b.name);
  const managerName = str(b.managerName).replace(/\s+/g, ' ');
  const phone = str(b.phone);
  if (!name) return { error: 'Studio name is required' };
  if (managerName.split(' ').length < 2) return { error: 'Enter the manager\'s first and last name' };
  if (!validPhone(phone)) return { error: 'Phone number must be exactly 10 digits' };
  return { name, managerName, phone };
}

async function nextId() {
  const r = await query(
    `SELECT studio_id FROM studios ORDER BY CAST(SUBSTR(studio_id, 3) AS INTEGER) DESC LIMIT 1`);
  const n = r.length ? parseInt(r[0].studio_id.slice(2), 10) + 1 : 1;
  return 'ST' + String(n).padStart(3, '0');
}

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = str(req.query && req.query.id);

    if (req.method === 'GET') {
      const rows = await query(
        `SELECT s.studio_id, s.name, s.manager_name, s.phone, s.created_at,
                (SELECT COUNT(*) FROM products p WHERE p.studio_id = s.studio_id) AS product_count
           FROM studios s ORDER BY s.studio_id`);
      return send(res, 200, { studios: rows.map(r => ({ ...r, product_count: num(r.product_count) })) });
    }

    if (req.method === 'POST') {
      const v = parse(body(req));
      if (v.error) return fail(res, 400, v.error);
      if ((await query('SELECT 1 AS x FROM studios WHERE phone = ?', [v.phone])).length)
        return fail(res, 409, 'A studio with this phone number already exists');
      for (let i = 0; i < 3; i++) {
        const studioId = await nextId();
        try {
          await query('INSERT INTO studios (studio_id, name, manager_name, phone, created_at) VALUES (?,?,?,?,?)',
            [studioId, v.name, v.managerName, v.phone, new Date().toISOString()]);
          return send(res, 201, { ok: true, studioId });
        } catch (e) { if (!e.unique) throw e; }
      }
      return fail(res, 409, 'Could not allocate a studio ID, please retry');
    }

    if (req.method === 'PUT') {
      const v = parse(body(req));
      if (v.error) return fail(res, 400, v.error);
      if (!id) return fail(res, 400, 'Missing studio id');
      if ((await query('SELECT 1 AS x FROM studios WHERE phone = ? AND studio_id <> ?', [v.phone, id])).length)
        return fail(res, 409, 'A studio with this phone number already exists');
      const r = await query('UPDATE studios SET name=?, manager_name=?, phone=? WHERE studio_id=? RETURNING studio_id',
        [v.name, v.managerName, v.phone, id]);
      return r.length ? send(res, 200, { ok: true }) : fail(res, 404, 'Studio not found');
    }

    if (req.method === 'DELETE') {
      if (!id) return fail(res, 400, 'Missing studio id');
      const used = await query('SELECT COUNT(*) AS c FROM products WHERE studio_id = ?', [id]);
      if (num(used[0].c) > 0) return fail(res, 409, 'This studio still has products assigned. Reassign them first.');
      await query('DELETE FROM studios WHERE studio_id = ?', [id]);
      return send(res, 200, { ok: true });
    }

    fail(res, 405, 'Method not allowed');
  } catch (e) {
    console.error('admin/studios', e);
    fail(res, 500, 'Server error');
  }
};
