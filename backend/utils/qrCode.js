// backend/utils/qrCode.js
// El QR de las etiquetas es puramente publicitario (lleva al Instagram de la
// tienda), ya no identifica la venta para el módulo de Escaneo.
const IG_URL = 'https://www.instagram.com/tecnohogar.cl/';

function buildQrValue() {
  return IG_URL;
}

module.exports = { buildQrValue };
