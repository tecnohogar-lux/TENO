// backend/utils/sinCobro.js
// Tipos de envío que NO se cobran: "solo envío (ya pagó)", "solo entrega (producto
// incompleto)" y "cambio de producto". Al pasar un envío a uno de estos tipos se le
// quitan precio, total y comisión (quedan en 0) y deja de contar en métricas, conteos,
// reportes y caja. Los montos originales se guardan en sales.cobro_original para poder
// restaurarlos si el envío vuelve a ser un "delivery" normal.

const TIPOS_SIN_COBRO = ['solo_envio_pagado', 'solo_entrega_incompleto', 'cambio_producto'];

const esSinCobro = (deliveryType) => TIPOS_SIN_COBRO.includes(deliveryType);

// Condición SQL: la venta SÍ se cobra (cuenta en métricas). `alias` incluye el punto, ej. 's.'
const conCobroSql = (alias = '') => `COALESCE(${alias}delivery_type, 'delivery') = 'delivery'`;

// Cambia el tipo de envío de varias ventas a la vez, quitando o restaurando los montos.
// Devuelve las filas actualizadas. `db` es un pool o un cliente de transacción.
async function aplicarTipoEnvio(db, ids, deliveryType) {
  if (esSinCobro(deliveryType)) {
    // Solo se guarda el respaldo la primera vez (si ya estaba sin cobro, se conserva el original).
    const result = await db.query(
      `UPDATE sales
       SET cobro_original = COALESCE(cobro_original, jsonb_build_object(
             'price', price, 'total', total, 'precio_producto', precio_producto,
             'precio_envio', precio_envio, 'comision', comision)),
           price = 0, total = 0, precio_producto = 0, precio_envio = 0, comision = 0,
           delivery_type = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($2::int[])
       RETURNING *`,
      [deliveryType, ids]
    );
    return result.rows;
  }

  // Vuelve a ser un envío normal: restaura los montos respaldados (si los hay).
  const result = await db.query(
    `UPDATE sales
     SET price = CASE WHEN cobro_original IS NOT NULL THEN (cobro_original->>'price')::numeric ELSE price END,
         total = CASE WHEN cobro_original IS NOT NULL THEN (cobro_original->>'total')::numeric ELSE total END,
         precio_producto = CASE WHEN cobro_original IS NOT NULL THEN (cobro_original->>'precio_producto')::numeric ELSE precio_producto END,
         precio_envio = CASE WHEN cobro_original IS NOT NULL THEN (cobro_original->>'precio_envio')::numeric ELSE precio_envio END,
         comision = CASE WHEN cobro_original IS NOT NULL THEN (cobro_original->>'comision')::numeric ELSE comision END,
         cobro_original = NULL,
         delivery_type = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ANY($2::int[])
     RETURNING *`,
    [deliveryType, ids]
  );
  return result.rows;
}

module.exports = { TIPOS_SIN_COBRO, esSinCobro, conCobroSql, aplicarTipoEnvio };
