// Fotos de entregas: lee del bot de Telegram las fotos que los repartidores mandan al grupo,
// las guarda en fotos_entregas y revisa si alguna fue borrada. No hay nada corriendo en segundo
// plano: todo pasa cuando un admin pulsa "Actualizar" o cuando llega la tarea automática de las 22:00.
//
// Variables de entorno:
//   TELEGRAM_BOT_TOKEN      token del bot (@BotFather)
//   TELEGRAM_CHAT_ID        id del grupo de entregas (número negativo)
//   TELEGRAM_CHECK_CHAT_ID  chat privado de un admin con el bot, para detectar fotos borradas (opcional)
//
// Importante: Telegram guarda los mensajes para el bot solo 24 horas. Si pasa más de un día sin
// actualizar, las fotos más antiguas se pierden; por eso existe la tarea automática diaria.
const pool = require('../config/database');
const { logAudit } = require('./auditLog');

const TZ_CHILE = 'America/Santiago';
const LOCK_KEY = 340034; // pg_advisory_lock: evita dos actualizaciones a la vez (botón + tarea automática)
const DIAS_ATRAS_MAX = 7; // la descripción puede mover una foto hasta 7 días antes del envío
// Telegram contesta "Message was not forwarded" cuando el mensaje que se pide reenviar ya fue borrado.
const NO_EXISTE = /no messages to forward|message to forward not found|message not found|message was not forwarded|MESSAGE_ID_INVALID/i;

function config() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    checkChatId: process.env.TELEGRAM_CHECK_CHAT_ID || '',
  };
}

function configurado() {
  const c = config();
  return Boolean(c.token && c.chatId);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// ---------- Fechas ----------
function diaChile(unixSeconds) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_CHILE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(unixSeconds * 1000));
}

function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diasEntre(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86400000);
}

const DIAS_SEMANA = [
  ['domingo', 'dom'], ['lunes', 'lun'], ['martes', 'mar'], ['miercoles', 'mier', 'mie'],
  ['jueves', 'jue'], ['viernes', 'vie'], ['sabado', 'sab'],
];

// Interpreta el día escrito AL INICIO de la descripción de la foto, relativo al día en que se envió.
// Acepta: lunes/lun ... domingo/dom, hoy, ayer, anteayer/antier/antes de ayer, 6/10, 06-10, 6.10.2026.
// Devuelve 'YYYY-MM-DD' o null (sin día, día futuro o más de DIAS_ATRAS_MAX días atrás).
function parseFechaDescripcion(descripcion, fechaEnvio) {
  if (!descripcion) return null;
  const t = descripcion.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/^[^a-z0-9]+/, ''); // emojis o signos antes del día

  let fecha = null;
  const palabra = t.match(/^[a-z]+(?: de [a-z]+)?/);
  if (palabra) {
    const p = palabra[0];
    if (p === 'antes de ayer') fecha = sumarDias(fechaEnvio, -2);
    else {
      const w = p.split(' ')[0];
      if (w === 'hoy') fecha = fechaEnvio;
      else if (w === 'ayer') fecha = sumarDias(fechaEnvio, -1);
      else if (w === 'anteayer' || w === 'antier') fecha = sumarDias(fechaEnvio, -2);
      else {
        const dia = DIAS_SEMANA.findIndex((nombres) => nombres.includes(w));
        if (dia >= 0) {
          const diaEnvio = new Date(`${fechaEnvio}T12:00:00Z`).getUTCDay();
          fecha = sumarDias(fechaEnvio, -((diaEnvio - dia + 7) % 7));
        }
      }
    }
  } else {
    const m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?(?!\d)/);
    if (m) {
      const [dd, mm] = [Number(m[1]), Number(m[2])];
      let anio = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(fechaEnvio.slice(0, 4));
      const armar = (a) => `${a}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      let f = armar(anio);
      if (!m[3] && f > fechaEnvio) f = armar(--anio); // "31/12" mandado el 2 de enero
      const d = new Date(`${f}T12:00:00Z`);
      if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f) fecha = f;
    }
  }

  if (!fecha) return null;
  const atras = diasEntre(fecha, fechaEnvio);
  return atras >= 0 && atras <= DIAS_ATRAS_MAX ? fecha : null;
}

// ---------- Telegram ----------
// Objeto (y no función suelta) para poder reemplazarlo en pruebas.
const telegram = {
  async call(method, params = {}) {
    const res = await fetch(`https://api.telegram.org/bot${config().token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const body = await res.json();
    if (!body.ok) {
      const err = new Error(`Telegram ${method}: ${body.description}`);
      err.description = body.description || '';
      err.retryAfter = body.parameters?.retry_after;
      throw err;
    }
    return body.result;
  },
};

// Reintenta cuando Telegram pide esperar (límite de mensajes por segundo).
async function tg(method, params) {
  for (let intento = 0; ; intento++) {
    try {
      return await telegram.call(method, params);
    } catch (err) {
      if (!err.retryAfter || intento >= 3) throw err;
      await new Promise((r) => setTimeout(r, err.retryAfter * 1000));
    }
  }
}

function esFoto(msg) {
  if (msg.photo) return true;
  return Boolean(msg.document && /^image\//.test(msg.document.mime_type || '')); // foto enviada "como archivo"
}

function nombreRemitente(msg) {
  const f = msg.from || {};
  return ([f.first_name, f.last_name].filter(Boolean).join(' ') || f.username || 'Desconocido').slice(0, 150);
}

function delGrupo(msg) {
  return String(msg.chat?.id) === config().chatId;
}

// ---------- Guardar fotos nuevas ----------
async function guardarFoto(client, msg) {
  if (!delGrupo(msg) || !esFoto(msg)) return 0;
  const fechaEnvio = diaChile(msg.date);
  const descripcion = msg.caption || null;
  const fechaDesc = parseFechaDescripcion(descripcion, fechaEnvio);
  const grupo = msg.media_group_id || null;

  // En un álbum Telegram pone la descripción en una sola foto: las demás heredan su día.
  let fecha = fechaDesc || fechaEnvio;
  let origen = fechaDesc ? 'descripcion' : 'envio';
  if (!fechaDesc && grupo) {
    const r = await client.query(
      `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha FROM fotos_entregas WHERE media_group_id = $1 AND fecha_origen = 'descripcion' LIMIT 1`, [grupo]
    );
    if (r.rows[0]) { fecha = r.rows[0].fecha; origen = 'descripcion'; }
  }

  const ins = await client.query(
    `INSERT INTO fotos_entregas (chat_id, message_id, media_group_id, fecha, fecha_envio, fecha_origen,
                                 enviado_at, enviado_por, telegram_user_id, descripcion)
     VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7), $8, $9, $10)
     ON CONFLICT (chat_id, message_id) DO NOTHING`,
    [msg.chat.id, msg.message_id, grupo, fecha, fechaEnvio, origen, msg.date, nombreRemitente(msg), msg.from?.id || null, descripcion]
  );
  if (fechaDesc && grupo) await moverAlbum(client, grupo, fechaDesc);
  return ins.rowCount;
}

async function moverAlbum(client, grupo, fecha) {
  await client.query(
    `UPDATE fotos_entregas SET fecha = $2, fecha_origen = 'descripcion'
     WHERE media_group_id = $1 AND fecha_origen <> 'manual'`, [grupo, fecha]
  );
}

// El repartidor editó la descripción de una foto ya enviada (p. ej. agregó "lunes").
async function aplicarEdicion(client, msg) {
  if (!delGrupo(msg) || !esFoto(msg)) return 0;
  const r = await client.query(
    'SELECT id, fecha_origen, media_group_id FROM fotos_entregas WHERE chat_id = $1 AND message_id = $2',
    [msg.chat.id, msg.message_id]
  );
  const foto = r.rows[0];
  if (!foto) return guardarFoto(client, msg); // la original no se alcanzó a leer: se guarda ya editada
  if (foto.fecha_origen === 'manual') return 0; // lo que corrigió un admin manda

  const descripcion = msg.caption || null;
  const fechaEnvio = diaChile(msg.date);
  const fechaDesc = parseFechaDescripcion(descripcion, fechaEnvio);
  await client.query('UPDATE fotos_entregas SET descripcion = $2 WHERE id = $1', [foto.id, descripcion]);

  const filtro = foto.media_group_id ? 'media_group_id = $1' : 'id = $1';
  const clave = foto.media_group_id || foto.id;
  if (fechaDesc) {
    const u = await client.query(
      `UPDATE fotos_entregas SET fecha = $2, fecha_origen = 'descripcion' WHERE ${filtro} AND fecha_origen <> 'manual'`,
      [clave, fechaDesc]
    );
    return u.rowCount;
  }
  if (foto.fecha_origen === 'descripcion') { // le borró el día a la descripción: vuelve al día del envío
    const u = await client.query(
      `UPDATE fotos_entregas SET fecha = fecha_envio, fecha_origen = 'envio' WHERE ${filtro} AND fecha_origen = 'descripcion'`,
      [clave]
    );
    return u.rowCount;
  }
  return 0;
}

async function leerNuevas(client) {
  let offset = Number((await client.query('SELECT telegram_offset FROM fotos_entregas_estado WHERE id = 1')).rows[0].telegram_offset);
  let nuevas = 0;
  let editadas = 0;
  // Diagnóstico: cuántos mensajes entregó Telegram y de qué chats no son el del grupo configurado.
  let recibidos = 0;
  const otrosChats = {};
  for (;;) {
    let updates;
    try {
      updates = await tg('getUpdates', { offset, limit: 100, timeout: 0, allowed_updates: ['message', 'edited_message'] });
    } catch (err) {
      if (/webhook/i.test(err.description || '')) { await tg('deleteWebhook'); continue; }
      throw err;
    }
    if (updates.length === 0) break;

    // Un lote por transacción: si algo falla, el offset no avanza y el lote se vuelve a leer.
    await client.query('BEGIN');
    try {
      for (const u of updates) {
        const m = u.message || u.edited_message;
        recibidos += 1;
        if (m && !delGrupo(m)) otrosChats[m.chat?.id] = (otrosChats[m.chat?.id] || 0) + 1;
        if (u.message) nuevas += await guardarFoto(client, u.message);
        else if (u.edited_message) editadas += await aplicarEdicion(client, u.edited_message);
      }
      offset = updates[updates.length - 1].update_id + 1;
      await client.query('UPDATE fotos_entregas_estado SET telegram_offset = $1 WHERE id = 1', [offset]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
  return { nuevas, editadas, recibidos, otrosChats };
}

// Cuando Telegram no entrega nada, ayuda a ver por qué: qué bot es, si ve el grupo y si tiene mensajes en cola.
async function diagnosticoSinMensajes() {
  const d = {};
  const probar = async (clave, fn) => { try { d[clave] = await fn(); } catch (err) { d[clave] = `error: ${err.description || err.message}`; } };
  await probar('bot', async () => { const b = await tg('getMe'); return `@${b.username}`; });
  await probar('grupo', async () => { const c = await tg('getChat', { chat_id: config().chatId }); return `${c.type}: ${c.title || ''}`; });
  await probar('webhook', async () => {
    const w = await tg('getWebhookInfo');
    return { activo: Boolean(w.url), enCola: w.pending_update_count, ultimoError: w.last_error_message || null };
  });
  return d;
}

// ---------- Fotos borradas ----------
// Telegram no avisa a los bots cuando se borra un mensaje. Se reenvían las fotos (sin sonido) al
// chat privado TELEGRAM_CHECK_CHAT_ID y se borran las copias: las que Telegram no puede reenviar
// ya no existen. forwardMessages manda hasta 100 de una vez y se salta las borradas; si faltan,
// se divide el lote en mitades hasta encontrar cuáles son.
async function buscarFaltantes(fromChat, ids, copias, faltantes) {
  let enviados;
  try {
    enviados = await tg('forwardMessages', {
      chat_id: config().checkChatId, from_chat_id: fromChat, message_ids: ids, disable_notification: true,
    });
  } catch (err) {
    if (!NO_EXISTE.test(err.description || '')) throw err;
    enviados = [];
  }
  copias.push(...enviados.map((m) => m.message_id));
  if (enviados.length === ids.length) return;
  if (ids.length === 1) { faltantes.push(ids[0]); return; }
  const mitad = Math.ceil(ids.length / 2);
  await buscarFaltantes(fromChat, ids.slice(0, mitad), copias, faltantes);
  await buscarFaltantes(fromChat, ids.slice(mitad), copias, faltantes);
}

async function revisarBorradas(client, { fecha, userId }) {
  if (!config().checkChatId) return { revisadas: 0, borradas: 0, sinRevisar: true };

  // Siempre: lo enviado hoy y ayer. Además, si se pidió, todo lo que cuenta para un día puntual.
  const hoy = diaChile(Date.now() / 1000);
  const r = await client.query(
    `SELECT id, chat_id, message_id, to_char(fecha, 'YYYY-MM-DD') AS fecha, enviado_por FROM fotos_entregas
     WHERE fecha_envio >= $1 OR fecha = $2 ORDER BY chat_id, message_id`,
    [sumarDias(hoy, -1), fecha || null]
  );

  const porChat = new Map();
  for (const f of r.rows) {
    if (!porChat.has(f.chat_id)) porChat.set(f.chat_id, []);
    porChat.get(f.chat_id).push(f);
  }

  const copias = [];
  const faltantes = new Set();
  try {
    for (const [chatId, fotos] of porChat) {
      const ids = fotos.map((f) => Number(f.message_id));
      for (let i = 0; i < ids.length; i += 100) {
        const encontradas = [];
        await buscarFaltantes(chatId, ids.slice(i, i + 100), copias, encontradas);
        for (const id of encontradas) faltantes.add(`${chatId}:${id}`);
      }
    }
  } finally {
    for (let i = 0; i < copias.length; i += 100) {
      await tg('deleteMessages', { chat_id: config().checkChatId, message_ids: copias.slice(i, i + 100) })
        .catch((err) => console.error('Fotos de entregas: no se pudieron borrar las copias de revisión:', err.message));
    }
  }

  const borrar = r.rows.filter((f) => faltantes.has(`${f.chat_id}:${f.message_id}`));
  // Si "faltan" todas las fotos revisadas, lo más probable es un problema con la revisión y no que
  // las hayan borrado todas: no se borra nada.
  if (r.rows.length >= 5 && borrar.length === r.rows.length) return { revisadas: r.rows.length, borradas: 0, sinRevisar: true };
  if (borrar.length > 0) {
    await client.query('DELETE FROM fotos_entregas WHERE id = ANY($1::int[])', [borrar.map((f) => f.id)]);
    for (const f of borrar) {
      await logAudit({
        userId, action: 'DELETE', tableName: 'fotos_entregas', recordId: f.id,
        oldValues: { fecha: f.fecha, enviado_por: f.enviado_por, motivo: 'Foto borrada del grupo de Telegram' },
      });
    }
  }
  return { revisadas: r.rows.length, borradas: borrar.length, sinRevisar: false };
}

// ---------- Actualizar (botón o tarea automática) ----------
// origen: 'manual' | 'automatica'. fecha (opcional): día extra a revisar por fotos borradas.
async function actualizar({ origen, userId = null, fecha = null }) {
  if (!configurado()) throw httpError(503, 'El bot de Telegram no está configurado (faltan TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID)');

  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY]);
    if (!lock.rows[0].ok) throw httpError(409, 'Ya hay una actualización en curso, espera unos segundos');
    try {
      const { nuevas, editadas, recibidos, otrosChats } = await leerNuevas(client);
      const { revisadas, borradas, sinRevisar } = await revisarBorradas(client, { fecha, userId });
      const resultado = { nuevas, editadas, revisadas, borradas, sinRevisar, recibidos, otrosChats };
      if (recibidos === 0) resultado.diagnostico = await diagnosticoSinMensajes();
      await client.query(
        `UPDATE fotos_entregas_estado
         SET ultima_actualizacion = NOW(), ultima_actualizacion_origen = $1, ultimo_resultado = $2 WHERE id = 1`,
        [origen, JSON.stringify(resultado)]
      );
      return resultado;
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

module.exports = { actualizar, configurado, parseFechaDescripcion, diaChile, sumarDias, telegram };
