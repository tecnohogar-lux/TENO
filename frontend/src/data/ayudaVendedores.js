// Contenido del centro de ayuda para vendedores (botón flotante). Es el mismo material de
// docs/GUIA_VENDEDORES.md; si cambia el funcionamiento del sistema, actualiza ambos.
//
// Formato de las respuestas: cada línea es un párrafo; las que empiezan con "- " se muestran como viñetas.

export const FAQ = [
  {
    categoria: 'Mi cuenta',
    preguntas: [
      {
        q: '¿Con qué entro al sistema?',
        a: 'Con tu Usuario y tu contraseña (no se usa correo).\nTu usuario y contraseña te los entrega el administrador.',
      },
      {
        q: 'Olvidé mi contraseña o quiero cambiarla',
        a: 'Avísale al administrador: él te asigna una contraseña nueva. Desde tu cuenta no se puede cambiar.',
        palabras: 'clave password cambiar recuperar',
      },
      {
        q: 'Dice "Demasiados intentos fallidos"',
        a: 'Si escribes mal la contraseña varias veces seguidas, el acceso se bloquea 15 minutos.\nEspera ese tiempo y vuelve a intentar con calma. Si sigues sin poder entrar, habla con el administrador.',
        palabras: 'bloqueado bloqueo login ingresar entrar',
      },
      {
        q: 'Dice "Tu cuenta está desactivada" o me sacó de la sesión',
        a: 'Puede ser que el administrador desactivara tu cuenta o cambiara algo en ella: habla con él.\nTambién puede que tu sesión haya vencido (las sesiones se reinician todos los días a las 3:00 AM): en ese caso solo vuelve a ingresar.',
        palabras: 'sesión desactivada cerrar sesion',
      },
      {
        q: '¿Qué puedo ver y hacer con mi cuenta?',
        a: '- Dashboard: tu resumen, la hora límite de envíos y las noticias.\n- Historial de ventas: solo tus ventas y su detalle.\n- Retiro en tienda: registrar retiros y ver los de todo el equipo.\n- Delivery Santiago: crear etiquetas y ver los envíos de todo el equipo.\n- Envíos Regiones: crear etiquetas y ver las tuyas.\n- Costos de envío, Productos y Clientes: consultar (puedes crear clientes).\n- Reportes: tus ventas y tus comisiones, con exportación a Excel.\n- Noticias y Reglas: leer.\n- Preferencias: cambiar el tema y anotar tus cuentas de marketplace.',
        palabras: 'permisos modulos menu acceso',
      },
      {
        q: '¿Puedo ver las ventas de otros vendedores?',
        a: 'Solo en dos módulos: en Retiro en tienda y en Delivery Santiago ves los de todos los vendedores (solo lectura, sin su comisión, su pago ni si el cliente ya fue atendido en tienda: eso solo lo ves en lo tuyo). En el Historial de ventas, Reportes y Envíos Regiones solo ves lo tuyo; las ventas directas de tienda son de operadores y administradores.',
      },
    ],
  },
  {
    categoria: 'Precios y productos',
    preguntas: [
      {
        q: '¿Qué significan SOL, MARKETPLACE y VENTA AL MAYOR?',
        a: 'Son los tres tipos de precio de un producto:\n- MARKETPLACE: el precio normal.\n- SOL: el precio tienda (el precio normal + 20%).\n- VENTA AL MAYOR: precio libre, con un mínimo de 6 unidades por producto.',
        palabras: 'precios tipo tienda mayorista',
      },
      {
        q: '¿Cuál tipo de precio debo usar?',
        a: 'El que corresponda a la venta. Por defecto, Retiro en tienda, Delivery Santiago y Envíos Regiones parten en MARKETPLACE.\nSi no estás seguro de cuál corresponde, consulta con tu operador.',
      },
      {
        q: '¿Puedo mezclar precios en una misma venta?',
        a: 'Sí. El botón que tengas marcado define el precio del próximo producto que agregues, y no cambia lo que ya agregaste.\nPor ejemplo: agrega un producto con SOL, cambia a MARKETPLACE y agrega el mismo producto otra vez. La venta quedará como MIXTO.',
        palabras: 'mixto mezclar sol marketplace',
      },
      {
        q: '¿Cómo funciona la venta al mayor?',
        a: 'Pulsa VENTA AL MAYOR: la cantidad sube a 6 y aparece un campo para escribir el precio unitario que acordaste.\nNo podrás agregar el producto con menos de 6 unidades.\nEn Envíos Regiones no está disponible.',
        palabras: 'mayorista 6 unidades minimo precio libre',
      },
      {
        q: 'No encuentro un producto en la lista',
        a: 'La lista muestra las primeras 100 coincidencias: escribe parte del nombre en el buscador.\nSi el producto no está registrado, elige "Producto libre (no registrado)" y escribe su nombre y precio.',
        palabras: 'buscar producto catalogo libre',
      },
      {
        q: 'Un producto aparece con "(agotado)"',
        a: 'Significa que el catálogo lo tiene marcado como agotado. Igual puedes seleccionarlo, pero confirma antes con tu operador.',
      },
    ],
  },
  {
    categoria: 'Ventas y envíos',
    preguntas: [
      {
        q: 'Ya registré algo y me equivoqué. ¿Puedo corregirlo?',
        a: 'No desde tu cuenta: los vendedores no pueden editar ni eliminar retiros, envíos o ventas ya registrados.\nAvísale a un operador o al administrador, indicando el cliente y qué hay que corregir.',
        palabras: 'editar eliminar borrar error equivocacion',
      },
      {
        q: '¿Qué es la hora límite de envíos?',
        a: 'Es la hora de corte para registrar envíos del día. La ves como cuenta regresiva en tu Dashboard.',
        palabras: 'deadline corte horario',
      },
      {
        q: '¿Cómo creo un cliente nuevo?',
        a: 'En Clientes → Nuevo cliente, o directamente desde el formulario de retiro o de envío, con la opción "Nuevo" en el campo Cliente.',
      },
      {
        q: '¿Qué estados tiene un envío?',
        a: 'Listo para imprimir, Impreso, En camino, Entregado, Cancelado, Reprogramado, Solo envío (ya pago), Solo entrega (incompleto) y Cambio de producto.\nLos cambia el operador; tú los puedes ver en la tabla.',
      },
      {
        q: 'Mi retiro en tienda dice "Pendiente"',
        a: 'Es lo normal: el retiro no cuenta como venta hasta que un operador lo entrega y lo cobra en Caja. Ahí pasa a "Entregado".',
        palabras: 'retiro pendiente entregado',
      },
      {
        q: '¿Por qué una venta con varios productos aparece como "2 productos"?',
        a: 'En el Historial, cuando una venta tiene más de un producto se muestra solo cuántos son. Pulsa "Detalles" para ver cada uno, con su precio, su tipo de precio y la comisión.',
        palabras: 'detalles historial varios productos',
      },
    ],
  },
  {
    categoria: 'Comisiones',
    preguntas: [
      {
        q: '¿Dónde veo mis comisiones?',
        a: '- Reportes: columna "Comisión" de cada venta y "Comisión total del filtro actual".\n- Historial de ventas: botón "Detalles" en cada venta.\n- Delivery Santiago: columna "Comisión" de la tabla.',
        palabras: 'comision ganancia pago reportes',
      },
      {
        q: '¿Cuáles comisiones se pagan?',
        a: 'Solo las ventas ya cerradas y con el pago confirmado:\n- Ventas de tienda o retiro completadas, o envíos con estado Entregado.\n- Si el cliente pagó por transferencia, debe estar verificada por un operador.\n- Las ventas canceladas o eliminadas no cuentan.\n- Un envío en proceso (impreso, en camino, reprogramado…) todavía no cuenta: cuando se entrega, pasa a contar.\nEl cálculo del pago lo hace el administrador u operador por rango de fechas.',
        palabras: 'pagan pago liquidacion transferencia verificada',
      },
      {
        q: 'Mi comisión no coincide con lo que esperaba',
        a: '- Abre el Detalle de esa venta en el Historial y revisa el tipo de precio de cada producto.\n- Comprueba si la venta ya está entregada/completada y, si fue por transferencia, verificada.\n- Revisa que el rango de fechas del filtro incluya la fecha de creación de la venta.\nSi sigue sin cuadrar, habla con el operador o el administrador indicando el cliente y la fecha de la venta.',
      },
    ],
  },
];

// Pasos que se muestran numerados. "ir" lleva al módulo correspondiente.
export const TUTORIALES = [
  {
    id: 'retiro',
    titulo: 'Registrar un retiro en tienda',
    resumen: 'La propuesta de venta para un cliente que pasará a buscar el producto.',
    ir: { ruta: '/retiro-tienda', texto: 'Ir a Retiro en Tienda' },
    intro: 'Un retiro no cuenta como venta hasta que un operador lo entrega y lo cobra en Caja.',
    pasos: [
      'En el menú abre Ventas → Retiro en Tienda.',
      'Pulsa "Registrar Retiro En Tienda". Verás tu nombre como Vendedor (no se cambia).',
      'Escribe el nombre del Cliente. Si ya existe uno con ese nombre se usa; si no, se crea.',
      'En "Tipo de precio del producto que vas a agregar" elige SOL, MARKETPLACE (viene marcado) o VENTA AL MAYOR.',
      'Abre el buscador "Selecciona un producto", escribe parte del nombre y elígelo.',
      'Indica la cantidad. Con VENTA AL MAYOR la cantidad parte en 6 (mínimo) y debes escribir también el precio unitario.',
      'Pulsa "Agregar": el producto aparece en la tabla con su tipo de precio y subtotal.',
      'Repite los pasos 4 a 7 para más productos (puedes cambiar de tipo de precio entre uno y otro, incluso repetir el mismo producto).',
      'Si quieres, escribe una nota (por ejemplo, "pasa a las 5 pm").',
      'Revisa el Total y pulsa "Registrar retiro".',
    ],
    despues: 'El retiro queda en estado Pendiente. Cuando el cliente pase, un operador lo entrega y cobra en Caja; recién ahí se convierte en venta. Si te equivocaste, pide a un operador o al administrador que lo edite o lo elimine.',
  },
  {
    id: 'delivery',
    titulo: 'Registrar un envío en Delivery Santiago',
    resumen: 'Despachos dentro de Santiago: una etiqueta con su QR, aunque lleve varios productos.',
    ir: { ruta: '/shipping', texto: 'Ir a Delivery Santiago' },
    intro: 'Registra tus envíos antes de la hora límite que ves en tu Dashboard.',
    pasos: [
      'Abre Envíos → Delivery Santiago y pulsa "Nueva etiqueta".',
      'Vendedor: aparece tu nombre y no se cambia.',
      'Cliente: elige "Existente" y búscalo, o "Nuevo" y escribe su nombre.',
      'Elige el tipo de precio con los botones SOL / MARKETPLACE / VENTA AL MAYOR (por defecto, MARKETPLACE).',
      'Busca y elige el producto y ajusta la cantidad (con VENTA AL MAYOR el mínimo es 6 y debes escribir el precio unitario). Pulsa "Agregar".',
      'Repite para cada producto. Con "Quitar" eliminas una línea. Si el producto no está en el catálogo, elige "Producto libre" y escribe nombre y precio.',
      'Comuna: elígela de la lista; la tarifa de esa comuna se carga sola en "Precio envío" (la puedes modificar).',
      '"Precio producto" se calcula solo como la suma de tus productos.',
      'Completa la dirección y el teléfono de entrega, y las notas si hace falta.',
      'Revisa el Total (productos + envío) y pulsa "Guardar etiqueta".',
    ],
    despues: 'El envío aparece con el estado "Listo para imprimir" y con un courier ya asignado. Los estados y el courier los cambia el operador; tú ves el avance y tu Comisión en la tabla. Si te equivocaste, avisa a un operador o al administrador.',
  },
  {
    id: 'regiones',
    titulo: 'Envío a regiones con el cotizador de Blue Express',
    resumen: 'Primero cotizas el costo con Blue Express y luego registras el envío.',
    ir: { ruta: '/envios-regiones', texto: 'Ir a Envíos Regiones' },
    intro: 'Para despachos fuera de la Región Metropolitana.',
    pasos: [
      'PARTE A: COTIZAR. Abre Envíos → Envíos Regiones.',
      'En la tarjeta "Cotizador de Blue Express" pulsa "Abrir cotizador": se abre Blue Express en una pestaña nueva (el sistema queda abierto en la otra).',
      'Origen: escribe la comuna desde donde sale el paquete y elígela de la lista.',
      'Destino: escribe la comuna de destino y elígela de la lista.',
      'Talla: XS (sobres o cajas chicas hasta 0,5 kg), S (hasta 3 kg o 20×20×30 cm), M (hasta 6 kg o 30×30×25 cm), L (hasta 20 kg o 70×70×70 cm), o "Prefiero ingresar las medidas".',
      'Espera a que el recuadro de verificación diga "¡Operación exitosa!" y pulsa "Cotizar". Anota el valor que te muestra.',
      'PARTE B: REGISTRAR. Vuelve a la pestaña del sistema y pulsa "Nueva etiqueta".',
      'Cliente (existente o nuevo) y productos: igual que en Delivery Santiago. Aquí solo hay SOL y MARKETPLACE (no existe venta al mayor).',
      'Región y Comuna: escríbelas a mano (por ejemplo, Región "Araucanía" y comuna "Temuco").',
      'Precio envío: escribe el valor que cotizaste en Blue Express.',
      'Dirección y teléfono del destinatario, notas si hace falta.',
      'Revisa el Total y pulsa "Guardar etiqueta".',
    ],
    despues: 'El envío queda en "Listo para imprimir"; el operador lo despacha y actualiza el estado. Consejos: cotiza con la talla correcta (si el paquete es más grande de lo cotizado, el costo real puede ser mayor) y, si cambias de comuna o de talla, vuelve a cotizar antes de registrar.',
  },
  {
    id: 'comisiones',
    titulo: 'Revisar tus comisiones',
    resumen: 'Dónde ver lo que ganas por cada venta y qué ventas se pagan.',
    ir: { ruta: '/reports', texto: 'Ir a Reportes' },
    intro: 'Ganas una comisión por cada venta. Puedes verla en Reportes, en el Historial y en Delivery Santiago.',
    pasos: [
      'Abre Análisis → Reportes.',
      'Elige el período con los filtros "Desde" y "Hasta" (o "Día específico"). También puedes filtrar por canal, tipo de precio o producto.',
      'En "Vista previa" verás la columna "Comisión" de cada venta.',
      'Sobre la tabla, "Comisión total del filtro actual" es la suma del período que elegiste.',
      'Para llevarte los datos pulsa "Exportar a Excel".',
      'Para el desglose por producto, ve a Historial de ventas y pulsa "Detalles" en la venta.',
    ],
    despues: 'Solo se pagan las ventas cerradas y con pago confirmado: tienda o retiro completados, o envíos entregados; las transferencias deben estar verificadas; las canceladas no cuentan. En una venta al mayor la comisión es el 25% de (tu precio − el costo). Los productos libres no tienen comisión.',
  },
];
