# Guía para vendedores: TecnOS ERP

Esta guía te explica cómo usar el sistema con tu cuenta de vendedor: preguntas frecuentes y tutoriales paso a paso.

**Tutoriales**
1. [Registrar un retiro en tienda](#tutorial-1-registrar-un-retiro-en-tienda)
2. [Registrar un envío en Delivery Santiago](#tutorial-2-registrar-un-envío-en-delivery-santiago)
3. [Registrar un envío a regiones usando el cotizador de Blue Express](#tutorial-3-registrar-un-envío-a-regiones-con-el-cotizador-de-blue-express)
4. [Revisar tus comisiones](#tutorial-4-revisar-tus-comisiones)

---

# Preguntas frecuentes

## Mi cuenta

**¿Con qué entro?**
Con tu **Usuario** y tu contraseña (no se usa correo). Tu usuario y contraseña te los entrega el administrador.

**Olvidé mi contraseña o quiero cambiarla.**
Avísale al administrador: él te asigna una nueva. Desde tu cuenta no se puede cambiar.

**Dice "Demasiados intentos fallidos".**
Si escribes mal la contraseña varias veces seguidas, el acceso se bloquea 15 minutos. Espera ese tiempo y vuelve a intentar con calma; si sigues sin poder entrar, habla con el administrador.

**Dice "Tu cuenta está desactivada" o me sacó de la sesión.**
El administrador desactivó tu cuenta o cambió algo en ella. Habla con él. También puede pasar que tu sesión (dura 24 horas) haya vencido: en ese caso solo vuelve a ingresar.

**¿Qué puedo ver y hacer con mi cuenta?**

| Módulo | Qué puedes hacer |
|---|---|
| Dashboard | Ver tu resumen, la hora límite de envíos y las noticias |
| Historial de ventas | Ver **tus** ventas y su detalle |
| Retiro en tienda | Registrar retiros y ver los tuyos |
| Delivery Santiago | Crear etiquetas y ver las tuyas |
| Envíos Regiones | Crear etiquetas a regiones, con acceso al cotizador de Blue Express |
| Costos de envío | Consultar la tarifa por comuna |
| Productos | Consultar precios y comisiones (los costos no se muestran) |
| Clientes | Consultar y crear clientes |
| Reportes | Ver **tus** ventas y **tus** comisiones, y exportarlas a Excel |
| Noticias y Reglas | Leer |
| Preferencias | Cambiar el tema (claro u oscuro) y anotar tus cuentas de marketplace |

**No veo Caja, Usuarios ni Configuración.**
Son módulos de operadores y administradores; no forman parte de tu cuenta.

**¿Puedo ver las ventas de otros vendedores?**
Solo en dos módulos: en **Retiro en tienda** y **Delivery Santiago** ves los de todos los vendedores (solo lectura, sin su comisión, su pago ni si el cliente ya fue atendido en tienda: eso solo lo ves en lo tuyo). En el Historial de ventas, Reportes y Envíos Regiones solo ves lo tuyo; las ventas directas de tienda son de operadores y administradores.

**¿Dónde veo las novedades y las reglas del equipo?**
En **Noticias** y **Reglas** (categoría Comunicación del menú). Las noticias también aparecen en tu Dashboard.

## Funcionamiento de la página

**¿Cómo está organizado el menú?**
En categorías (Ventas, Envíos, Catálogo, Comunicación, Análisis). Pulsa el nombre de una categoría para abrirla o cerrarla.

**¿Qué significan SOL, MARKETPLACE y VENTA AL MAYOR?**
Son los tres tipos de precio de un producto:
- **MARKETPLACE:** el precio normal.
- **SOL:** el precio tienda (el precio normal + 20%).
- **VENTA AL MAYOR:** precio libre, con un mínimo de **6 unidades** por producto.

**¿Cuál uso?**
Usa el que corresponda a la venta. Por defecto, Retiro en tienda, Delivery Santiago y Envíos Regiones parten en **MARKETPLACE**. Si no estás seguro de cuál corresponde, consulta con tu operador.

**¿Puedo mezclar precios en una misma venta?**
Sí. El botón que tengas marcado define el precio del **próximo producto que agregues**, y no cambia lo que ya agregaste. Por ejemplo: agrega un producto con SOL, cambia a MARKETPLACE y agrega el mismo producto otra vez. La venta quedará como **MIXTO**.

**¿Cómo funciona la venta al mayor?**
Pulsa **VENTA AL MAYOR**: la cantidad sube a 6 y aparece un campo para escribir el precio unitario que acordaste. No podrás agregar el producto con menos de 6 unidades. (En **Envíos Regiones** no está disponible.)

**Un producto aparece con "(agotado)".**
Significa que el catálogo lo tiene marcado como agotado. Igual puedes seleccionarlo, pero confirma antes con tu operador.

**No encuentro un producto en la lista.**
La lista muestra las primeras 100 coincidencias. **Escribe parte del nombre** en el buscador para encontrarlo. Si el producto no está registrado, elige **Producto libre (no registrado)** y escribe su nombre y precio.

**Ya registré algo y me equivoqué. ¿Puedo corregirlo?**
No desde tu cuenta: los vendedores no pueden editar ni eliminar retiros, envíos o ventas ya registrados. Avísale a un operador o al administrador, indicando el cliente y qué hay que corregir.

**¿Qué es la hora límite de envíos?**
Es la hora de corte para registrar envíos del día. La ves como cuenta regresiva en tu Dashboard.

**¿Cómo creo un cliente nuevo?**
En **Clientes → Nuevo cliente**, o directamente desde el formulario de retiro o de envío, con la opción **Nuevo** en el campo Cliente.

**¿Puedo ver el costo de un producto?**
No, los costos solo los ven operadores y administradores. Tú ves el precio y la comisión de cada producto.

**¿Por qué una venta con varios productos aparece como "2 productos"?**
En el Historial, cuando una venta tiene más de un producto se muestra solo cuántos son. Pulsa **Detalles** para ver cada uno, con su precio, su tipo de precio y la comisión.

**¿Qué estados tiene un envío?**
Listo para imprimir, Impreso, En camino, Entregado, Cancelado, Reprogramado, Solo envío (ya pago), Solo entrega (incompleto) y Cambio de producto. Los cambia el operador; tú los puedes ver en la tabla.

---

# Tutorial 1: Registrar un retiro en tienda

Un **retiro en tienda** es la propuesta de venta para un cliente que pasará a buscar el producto. No cuenta como venta hasta que un operador lo entrega y lo cobra en Caja.

1. En el menú abre **Ventas → Retiro en Tienda**.
2. Pulsa **Registrar Retiro En Tienda**.
3. Verás tu nombre como **Vendedor** (no se cambia).
4. Escribe el nombre del **Cliente**. Si ya existe uno con ese nombre, se usa; si no, se crea.
5. En **Tipo de precio del producto que vas a agregar**, elige el botón que corresponda: **SOL**, **MARKETPLACE** (viene marcado) o **VENTA AL MAYOR**.
6. Abre el buscador **Selecciona un producto** y escribe parte del nombre. Elige el producto.
7. Indica la **cantidad**:
   - Con **VENTA AL MAYOR**, la cantidad parte en 6 (mínimo) y debes escribir además el **precio unitario**.
8. Pulsa **Agregar**. El producto aparece en la tabla de la derecha con su tipo de precio y su subtotal.
9. Repite los pasos 5 a 8 para agregar más productos. Puedes cambiar de tipo de precio entre uno y otro (incluso repetir el mismo producto).
10. Si quieres, escribe una **Nota** (por ejemplo, "pasa a las 5 pm").
11. Revisa el **Total** y pulsa **Registrar retiro**.

**Después:** el retiro aparece en la lista con el estado **Pendiente**. Cuando el cliente pase, un operador pulsa **Entregado**, cobra en Caja y el retiro pasa a **Entregado**; recién ahí se convierte en venta. Puedes seguir su estado en esa misma lista.

**Si te equivocaste:** pide a un operador o al administrador que lo edite o lo elimine.

---

# Tutorial 2: Registrar un envío en Delivery Santiago

Para despachos dentro de Santiago. Cada envío genera **una etiqueta con su QR**, aunque lleve varios productos.

1. Abre **Envíos → Delivery Santiago**.
2. Pulsa **Nueva etiqueta**.
3. **Vendedor:** aparece tu nombre y no se cambia.
4. **Cliente:** elige **Existente** y búscalo, o **Nuevo** y escribe su nombre.
5. **Productos** (puedes agregar varios):
   1. Elige el tipo de precio con los botones **SOL / MARKETPLACE / VENTA AL MAYOR** (por defecto, MARKETPLACE).
   2. Busca y elige el producto, y ajusta la **cantidad**. Con **VENTA AL MAYOR** el mínimo es 6 y debes escribir el **precio unitario**.
   3. Pulsa **Agregar**.
   4. Repite para cada producto. Con **Quitar** eliminas una línea.
   
   Si el producto no está en el catálogo, elige **Producto libre (no registrado)**, escribe el nombre y el precio.
6. **Comuna:** elígela de la lista. La tarifa de esa comuna se carga sola en **Precio envío** (si necesitas otro valor, lo puedes modificar).
7. **Precio producto** se calcula solo como la suma de tus productos.
8. Completa **Dirección** y **Teléfono** de entrega, y **Notas** si hace falta.
9. Revisa el **Total** (productos + envío) y pulsa **Guardar etiqueta**.

**Después:** el envío aparece en la tabla con estado **Listo para imprimir** y con un courier ya asignado (por defecto el que definió el administrador). Los estados y el courier los cambia el operador; tú puedes seguir el avance en la tabla y ver tu **Comisión** en su columna.

**Importante:** registra tus envíos **antes de la hora límite** que ves en tu Dashboard.

**Si te equivocaste:** avisa a un operador o al administrador.

---

# Tutorial 3: Registrar un envío a regiones con el cotizador de Blue Express

Para despachos fuera de la Región Metropolitana. Primero cotizas el costo de envío con Blue Express y luego lo registras.

## Paso A: Cotizar el envío

1. Abre **Envíos → Envíos Regiones**.
2. En la tarjeta **Cotizador de Blue Express**, pulsa **Abrir cotizador**. Se abre la página de Blue Express en una **pestaña nueva** (el sistema queda abierto en la otra).
3. En Blue Express completa el formulario:
   1. **Trayecto del envío**
      - **Origen:** escribe la comuna desde donde sale el paquete y elígela de la lista.
      - **Destino:** escribe la comuna de destino y elígela de la lista.
   2. **Talla:** elige la que corresponda al paquete:
      - **XS:** sobres acolchados o cajas chicas de hasta 0,5 kg.
      - **S:** hasta 3 kg o 20 × 20 × 30 cm.
      - **M:** hasta 6 kg o 30 × 30 × 25 cm.
      - **L:** hasta 20 kg o 70 × 70 × 70 cm.
      - **Prefiero ingresar las medidas:** para paquetes distintos; indicas alto, largo, ancho y peso.
   3. Espera a que el recuadro de verificación de Cloudflare diga **¡Operación exitosa!**
   4. Pulsa **Cotizar**.
4. **Anota el valor** que te muestra Blue Express: lo usarás como precio de envío.

## Paso B: Registrar el envío en el sistema

1. Vuelve a la pestaña del sistema (**Envíos Regiones**) y pulsa **Nueva etiqueta**.
2. **Vendedor:** tu nombre (no se cambia).
3. **Cliente:** existente o **Nuevo**.
4. **Productos:** igual que en Delivery Santiago. Elige el tipo de precio (**SOL** o **MARKETPLACE**; en Envíos Regiones no existe la venta al mayor), busca el producto, la cantidad y pulsa **Agregar**. Repite para más productos.
5. **Región** y **Comuna:** escríbelas a mano (por ejemplo, Región "Araucanía" y comuna "Temuco").
6. **Precio envío:** escribe el valor que cotizaste en Blue Express.
7. **Dirección** y **Teléfono** del destinatario, y **Notas** si hace falta.
8. Revisa el **Total** y pulsa **Guardar etiqueta**.

**Después:** el envío aparece en la tabla con el estado **Listo para imprimir**. El operador se encarga de despacharlo y de actualizar el estado.

**Consejos**
- Cotiza con la **talla correcta**: si el paquete es más grande de lo cotizado, el costo real puede ser mayor.
- Si cambias de comuna o de talla, vuelve a cotizar antes de registrar el envío.

---

# Tutorial 4: Revisar tus comisiones

Ganas una **comisión por cada venta**. Puedes revisarla en tres lugares.

## Dónde ver tu comisión

**1. Reportes (el lugar principal)**
1. Abre **Análisis → Reportes**.
2. Usa los filtros (por ejemplo **Desde** y **Hasta**, o **Día específico**) para elegir el período. También puedes filtrar por canal, por tipo de precio o por producto.
3. En **Vista previa** verás la columna **Comisión** de cada venta.
4. Arriba de la tabla, **Comisión total del filtro actual** te da la suma del período que elegiste.
5. Para llevarte los datos, pulsa **Exportar a Excel** (incluye la comisión de cada venta y el total).

**2. Historial de ventas**
Pulsa **Detalles** en una venta para ver el desglose por producto y la **Comisión** de esa venta.

**3. Delivery Santiago**
La tabla de envíos tiene una columna **Comisión**.

## Cuáles comisiones se pagan

En Reportes ves la comisión de **todas** tus ventas, pero solo se pagan las ventas ya **cerradas y con el pago confirmado**:

- Ventas de **tienda o retiro completadas**, o **envíos con estado Entregado**.
- Si el cliente pagó por **transferencia**, debe estar **verificada** por un operador.
- Las ventas **canceladas** o **eliminadas** no cuentan.
- Un envío **en proceso** (impreso, en camino, reprogramado…) todavía **no** cuenta: cuando se entrega, pasa a contar.

El cálculo del pago lo hace el administrador u operador por rango de fechas; tú no ves ese panel.

## Cómo se calcula cada comisión

Depende del **tipo de precio** con el que se vendió cada producto:

| Tipo de precio | Comisión |
|---|---|
| MARKETPLACE | La comisión marketplace del producto |
| SOL | La comisión tienda del producto |
| VENTA AL MAYOR | 25% de (tu precio de venta − el costo del producto), por unidad, y nunca menos de $0 |

- La comisión de cada producto se **multiplica por la cantidad** vendida.
- En una venta **MIXTO**, se suma la comisión de cada producto según su propio tipo de precio.
- La comisión queda **fijada al momento de la venta**: si después cambian los precios del catálogo, tus ventas anteriores no cambian.
- Puedes consultar la comisión unitaria de cada producto en **Catálogo → Productos**, en las columnas de comisión marketplace y comisión tienda.

## "Una venta mía no tiene comisión (aparece —)"

Puede ser porque:
- Vendiste un **producto libre** (no registrado en el catálogo): no tiene comisión.
- El producto **no tiene costo cargado** todavía.

Avisa a un operador para que lo revise.

## "Mi comisión no coincide con lo que esperaba"

1. Abre el **Detalle** de esa venta en el Historial y revisa el **tipo de precio** de cada producto.
2. Comprueba si la venta ya está **entregada/completada** y, si fue por transferencia, **verificada**.
3. Revisa que el rango de fechas del filtro incluya la **fecha de creación** de la venta.
4. Si sigue sin cuadrar, habla con el operador o el administrador indicando el cliente y la fecha de la venta.
