'use strict';
const { query, num } = require('./_lib/db');
const { normVehicle, validVehicle, send, fail } = require('./_lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return fail(res, 405, 'Method not allowed');
  try {
    const vehicle = normVehicle(req.query && req.query.vehicle);
    if (!validVehicle(vehicle)) return fail(res, 400, 'Enter a valid vehicle registration number');
    const rows = await query(
      'SELECT activation_date, warranty_years FROM products WHERE vehicle_reg = ?', [vehicle]);
    if (!rows.length) return send(res, 200, { found: false });
    const years = num(rows[0].warranty_years);
    const start = new Date(rows[0].activation_date);
    const end = new Date(start); end.setFullYear(end.getFullYear() + years);
    send(res, 200, {
      found: true, vehicle,
      activationDate: rows[0].activation_date,
      warrantyYears: years,
      validUntil: end.toISOString(),
      active: end > new Date(),
    });
  } catch (e) {
    console.error('check', e);
    fail(res, 500, 'Something went wrong. Please try again.');
  }
};
