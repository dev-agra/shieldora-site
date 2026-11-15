'use strict';
const { query, num } = require('../_lib/db');
const { requireAdmin } = require('../_lib/auth');
const { PRODUCTS, str, send, fail, body } = require('../_lib/util');

async function parse(b, creating) {
  const productId = str(b.productId).toUpperCase();
  const rollNumber = str(b.rollNumber);
  const productType = str(b.productType);
  const colorVariant = str(b.colorVariant);
  const studioId = str(b.studioId) || null;

  if (creating && !/^[A-Z0-9-]{2,32}$/.test(productId)) return { error: 'Product ID may only contain letters, numbers and hyphens (e.g. A001)' };
  if (!rollNumber || rollNumber.length > 200) return { error: 'Roll number is required' };
  const type = PRODUCTS[productType];
  if (!type) return { error: 'Select a product type' };
  if (!type.colors.includes(colorVariant)) return { error: 'Select a valid colour variant for this product type' };
  if (studioId && !(await query('SELECT 1 AS x FROM studios WHERE studio_id = ?', [studioId])).length)
    return { error: 'Assigned studio does not exist' };
  return { productId, rollNumber, productType, colorVariant, studioId, warranty: type.warranty };
}

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = str(req.query && req.query.id).toUpperCase();

    if (req.method === 'GET') {
      const rows = await query(
        `SELECT p.product_id, p.roll_number, p.product_type, p.warranty_years, p.color_variant,
                p.studio_id, p.status, p.activation_date, p.vehicle_reg, s.name AS studio_name
           FROM products p LEFT JOIN studios s ON s.studio_id = p.studio_id
          ORDER BY p.product_id`);
      return send(res, 200, {
        types: PRODUCTS,
        products: rows.map(r => ({ ...r, warranty_years: num(r.warranty_years) })),
      });
    }

    if (req.method === 'POST') {
      const v = await parse(body(req), true);
      if (v.error) return fail(res, 400, v.error);
      try {
        await query(
          `INSERT INTO products (product_id, roll_number, product_type, warranty_years, color_variant, studio_id, status, created_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          [v.productId, v.rollNumber, v.productType, v.warranty, v.colorVariant, v.studioId,
           v.studioId ? 'assigned' : 'unassigned', new Date().toISOString()]);
      } catch (e) {
        if (e.unique) return fail(res, 409, 'This product ID already exists');
        throw e;
      }
      return send(res, 201, { ok: true });
    }

    if (req.method === 'PUT') {
      if (!id) return fail(res, 400, 'Missing product id');
      const v = await parse(body(req), false);
      if (v.error) return fail(res, 400, v.error);
      const r = await query(
        `UPDATE products SET roll_number=?, product_type=?, warranty_years=?, color_variant=?, studio_id=?,
                status=?
          WHERE product_id=? AND status <> 'activated' RETURNING product_id`,
        [v.rollNumber, v.productType, v.warranty, v.colorVariant, v.studioId, v.studioId ? 'assigned' : 'unassigned', id]);
      if (r.length) return send(res, 200, { ok: true });
      const exists = await query('SELECT 1 AS x FROM products WHERE product_id = ?', [id]);
      return exists.length ? fail(res, 409, 'Activated products cannot be edited') : fail(res, 404, 'Product not found');
    }

    if (req.method === 'DELETE') {
      if (!id) return fail(res, 400, 'Missing product id');
      const r = await query(`DELETE FROM products WHERE product_id = ? AND status <> 'activated' RETURNING product_id`, [id]);
      return r.length ? send(res, 200, { ok: true }) : fail(res, 409, 'Product not found or already activated (activated products cannot be deleted)');
    }

    fail(res, 405, 'Method not allowed');
  } catch (e) {
    console.error('admin/products', e);
    fail(res, 500, 'Server error');
  }
};
