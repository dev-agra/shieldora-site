'use strict';
const { query, num } = require('./_lib/db');
const { normVehicle, validVehicle, validPhone, str, send, fail, body } = require('./_lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  try {
    const b = body(req);
    const productId = str(b.productId).toUpperCase();
    const phone = str(b.dealerPhone);
    const vehicle = normVehicle(b.vehicle);

    if (!/^[A-Z0-9-]{2,32}$/.test(productId)) return fail(res, 400, 'Enter a valid product ID');
    if (!validPhone(phone)) return fail(res, 400, 'Enter a valid 10 digit phone number');
    if (!validVehicle(vehicle)) return fail(res, 400, 'Enter a valid vehicle registration number');

    const rows = await query(
      `SELECT p.product_id, p.status, p.warranty_years, s.phone AS studio_phone
         FROM products p LEFT JOIN studios s ON s.studio_id = p.studio_id
        WHERE p.product_id = ?`, [productId]);
    const p = rows[0];
    if (!p || !p.studio_phone || p.studio_phone !== phone) {
      return fail(res, 404, 'Product ID and dealer phone number do not match our records');
    }
    if (p.status === 'activated') return fail(res, 409, 'This product has already been activated');

    const taken = await query('SELECT 1 AS x FROM products WHERE vehicle_reg = ?', [vehicle]);
    if (taken.length) return fail(res, 409, 'This vehicle already has a warranty registered');

    const now = new Date().toISOString();
    let done;
    try {
      done = await query(
        `UPDATE products SET status = 'activated', activation_date = ?, vehicle_reg = ?
          WHERE product_id = ? AND status = 'assigned'
          RETURNING warranty_years, activation_date`, [now, vehicle, productId]);
    } catch (e) {
      if (e.unique) return fail(res, 409, 'This vehicle already has a warranty registered');
      throw e;
    }
    if (!done.length) return fail(res, 409, 'This product has already been activated');

    send(res, 200, { ok: true, vehicle, activationDate: done[0].activation_date, warrantyYears: num(done[0].warranty_years) });
  } catch (e) {
    console.error('activate', e);
    fail(res, 500, 'Something went wrong. Please try again.');
  }
};
