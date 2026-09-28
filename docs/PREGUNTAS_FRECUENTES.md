# TecnOS ERP: preguntas y respuestas

Guía rápida para el equipo. Está organizada por tema; cada pregunta indica qué roles la necesitan.

**Roles:** `vendedor`, `operador`, `admin` y `escaneo` (solo Delivery Santiago y escaneo de paquetes).

---

## 1. Acceso y cuentas

**¿Con qué entro al sistema?**
Con tu **Usuario** y contraseña (ya no se pide correo). El admin crea tu usuario.

**Aparece "Demasiados intentos fallidos".**
Después de 9 intentos con contraseña incorrecta desde el mismo equipo, el acceso se bloquea 15 minutos. Espera o pide al admin que revise tu contraseña.

**Me sacó de la sesión sin avisar.**
La sesión dura 24 horas. Además, si el admin desactiva tu cuenta o te cambia el rol, el efecto es inmediato. Vuelve a ingresar; si dice "Tu cuenta está desactivada", habla con el admin.

**¿Puedo ver la contraseña de otro usuario?**
No. Las contraseñas se guardan cifradas de forma irreversible. Si alguien la olvida, el admin le asigna una nueva desde **Usuarios → Editar**.

**¿Qué puede hacer cada rol?**

| Módulo | Vendedor | Operador | Admin |
|---|---|---|---|
| Historial de ventas (solo las propias para vendedor) | Sí | Sí | Sí |
| Retiro en tienda: registrar | Sí | Sí | Sí |
| Retiro en tienda: editar, eliminar, entregar | No | Sí | Sí |
| Delivery Santiago y Envíos Regiones: crear etiquetas | Sí | Sí | Sí |
| Cambiar estado y courier de un envío | No | Sí | Sí |
| Caja, Apertura/Cierre, Gastos, Couriers, Anotaciones | No | Sí | Sí |
| Reportes | Solo sus ventas | Todo | Todo |
| Pago de comisiones a vendedores | No | Sí | Sí |
| Ver costos y rentabilidad de productos | **No** | Sí | Sí |
| Usuarios, Papelera, Auditoría, Configuración, Reglas (editar) | No | No | Sí |

---

## 2. Precios: SOL, MARKETPLACE y venta al mayor

**¿Qué son los tipos de precio?**
- **MARKETPLACE**: el precio normal del producto.
- **SOL**: el precio tienda, que es el precio marketplace + 20%.
- **VENTA AL MAYOR**: precio libre, con un mínimo de **6 unidades** por producto.

**¿Dónde elijo el tipo de precio?**
En los botones **SOL / MARKETPLACE / VENTA AL MAYOR** que aparecen sobre el buscador de productos en Caja, Retiro en Tienda y Delivery Santiago. **Envíos Regiones** solo tiene SOL y MARKETPLACE.

**¿Cuál viene marcado por defecto?**
- Caja: **SOL**.
- Retiro en Tienda, Delivery Santiago y Envíos Regiones: **MARKETPLACE**.

**¿Puedo usar SOL y MARKETPLACE en la misma venta?**
Sí. El botón define el precio del **próximo producto que agregues**; lo que ya agregaste no cambia. Puedes agregar el mismo producto dos veces, una con cada precio. La venta queda como **MIXTO**.

**¿Cómo funciona la venta al mayor?**
Al pulsar **VENTA AL MAYOR** la cantidad parte en 6 y aparece un campo para escribir el precio unitario. "Agregar" queda bloqueado con menos de 6 unidades o sin precio. El servidor también lo rechaza si alguien intenta saltarse la pantalla.

**¿Qué significa MIXTO?**
La venta tiene productos con más de un tipo de precio. En el Historial, el botón **Detalles** muestra qué tipo tiene cada producto.

**¿Cómo se calculan los precios y comisiones de cada producto?**
Todo se calcula solo, a partir del costo y el precio marketplace:

| Campo | Regla |
|---|---|
| Rentabilidad | precio − costo |
| Menos 75% | 75% de la rentabilidad |
| **Comisión marketplace** | 25% de la rentabilidad |
| Precio tienda | precio marketplace × 1,20 |
| Costo tienda | igual al costo |
| Rentabilidad tienda | precio tienda − costo tienda |
| **Comisión tienda** | 25% de la rentabilidad tienda |

**¿Y la comisión de una venta al mayor?**
25% de (precio de venta − costo del producto), por unidad. Si el precio queda bajo el costo, la comisión es $0. Un producto libre (no registrado) no genera comisión.

---

## 3. Productos

**¿Cómo agrego muchos productos de una vez?**
**Productos → Importar Excel.** La primera fila debe ser exactamente estas 9 columnas, en este orden: `Producto`, `SKU`, `Costo`, `Precio`, `Rentabilidad`, `Menos 75%`, `Menos 25% (Comisión de venta)`, `URL Imagen`, `Descripción`.
- Obligatorios: Producto, Costo y Precio (mayores a 0; el precio no puede ser menor que el costo).
- SKU, URL Imagen y Descripción son opcionales.
- Deja vacías las columnas de Rentabilidad, Menos 75% y Comisión: el sistema las calcula.

**Subí un Excel y algunas filas no se importaron.**
Las filas válidas sí se importan; las inválidas se omiten y el sistema te lista cada una con su motivo (falta el costo, falta el nombre, precio menor al costo, etc.). Corrige esas filas y vuelve a subir el archivo: los productos que ya existen se omiten ("ya existe un producto llamado…"), así que no se duplican.

**¿Cómo cambio precios de muchos productos a la vez?**
1. **Exportar para editar** (descarga todos los productos, siempre en el mismo orden).
2. Cambia solo los valores que necesites (por ejemplo, la columna Precio).
3. **Subir edición masiva.**

La actualización se hace **por posición de fila**: lo que está en la fila 5 se aplica al producto que estaba en la fila 5 al exportar. Por eso:
- **No agregues, borres ni reordenes filas.** Si la cantidad de filas no coincide con la de productos, el sistema rechaza el archivo.
- Una celda vacía significa "no cambiar".
- Si alguien crea o elimina un producto entre que exportas y subes, vuelve a exportar.

**¿Las columnas extra del Excel exportado sirven?**
El Excel exportado trae 5 columnas de precios tienda al final (informativas). Se ignoran al subir.

**¿Por qué un vendedor no ve el costo?**
Es intencional: el servidor no le envía costos ni rentabilidad. Sí ve precios y comisiones. Ten en cuenta que con el precio y la comisión a la vista se puede deducir el costo (costo = precio − 4 × comisión). Si eso es un problema, se puede ocultar también la comisión del catálogo.

**Marqué un producto como agotado.**
Sigue apareciendo en los buscadores con la marca "(agotado)". No bloquea la venta.

---

## 4. Caja y cierre de caja

**Dice "No hay una caja abierta".**
Un operador o admin debe abrirla en **Apertura/Cierre de Caja** (con el saldo inicial). Solo hay una caja global a la vez.

**¿Cómo registro una venta?**
En **Caja**: elige el vendedor, el cliente (existente o nuevo), agrega productos, elige la forma de pago y pulsa **Registrar venta**. Varios productos en una sola venta quedan como **una sola venta** en el Historial.

**¿Qué formas de pago hay?**
Efectivo, débito, crédito, transferencia y link de pago.

**¿Qué es "Transferencia verificada"?**
Marca que el pago por transferencia ya se comprobó. Se puede activar al crear la venta o después, desde el Historial. Una transferencia sin verificar **no cuenta** para el pago de comisiones.

**¿Cómo hago un envío prepagado?**
En Caja elige **Envío prepagado**: admite un solo producto, pide dirección y comuna, y suma el costo de envío de esa comuna.

**¿Cómo cierro la caja?**
En **Apertura/Cierre de Caja**: cuenta el efectivo, escríbelo y cierra. El sistema calcula el saldo esperado (saldo inicial + ventas en efectivo − gastos) y muestra la diferencia con lo que contaste.

**¿Dónde registro los gastos?**
En **Gastos y egresos**. Se restan del saldo esperado al cerrar la caja.

---

## 5. Retiro en tienda

**¿Cómo funciona?**
Cualquier usuario registra un retiro (una propuesta de venta para un cliente que pasará a buscar). **No cuenta como venta** hasta que un operador o admin pulsa **Entregado**, lo que lo lleva a Caja con los productos y sus precios ya cargados; ahí se elige la forma de pago y se registra la venta real.

**¿Se puede corregir o eliminar un retiro?**
Sí, un operador o admin, con **Editar** y **Eliminar**. Si el retiro ya fue entregado, la venta que se creó en Caja no cambia: para borrarla, hazlo desde el Historial de ventas.

**Registré un retiro con dos tipos de precio.**
Es válido; queda marcado como MIXTO y al pasar a Caja cada producto conserva su precio.

---

## 6. Delivery Santiago y Envíos Regiones

**¿Cómo creo una etiqueta?**
**Nueva etiqueta**: vendedor, cliente, productos (con el botón de tipo de precio), comuna (Santiago) o región y comuna (Regiones), precio de envío, dirección y teléfono. Una etiqueta con varios productos sigue siendo **un solo paquete y un solo QR**.

**¿El precio de envío se llena solo?**
En Delivery Santiago, al elegir la comuna se carga su tarifa (editable). En Envíos Regiones la región y la comuna se escriben a mano, y el precio de envío también.

**¿Qué courier se asigna?**
Todo envío de Delivery Santiago nace con el **courier predeterminado** (hoy Mattos). Operador o admin pueden cambiarlo por envío en la tabla, y el admin puede cambiar el predeterminado en **Configuración**. Los couriers se administran en **Couriers**.

**¿Cuáles son los estados de un envío?**
Listo para imprimir, Impreso, En camino, Entregado, Cancelado, Reprogramado, Solo envío (ya pago), Solo entrega (incompleto) y Cambio de producto. Al pasar a **Entregado**, la venta queda como completada.

**¿Puedo editar un envío con varios productos?**
Puedes cambiar cliente, vendedor, dirección, teléfono y notas. El producto, la cantidad y el monto no se editan en un envío con varios productos; si hay que cambiarlos, elimina el envío y créalo de nuevo.

**¿Cómo imprimo etiquetas?**
Desde la tabla: **Imprimir etiqueta**, o selecciona varios y usa **Acciones → Imprimir etiquetas**.

**¿Y para cotizar el envío con Blue Express?**
En **Envíos Regiones** hay un botón **Abrir cotizador**, que abre la página de Blue Express en una pestaña nueva (no se puede mostrar dentro del sistema porque ellos lo impiden).

**¿Qué hace la hora límite?**
Es la hora de corte de envíos del día (se ve como cuenta regresiva en el Dashboard). El admin la configura por separado para lunes a viernes, sábado y domingo.

**¿Para qué sirve "Escanear"?**
El rol `escaneo` y los operadores escanean el QR de cada paquete en la página de escaneo y marcan varios como entregados de una vez.

---

## 6b. Historial de ventas

**¿Por qué una venta con varios productos aparece como "2 productos"?**
En el listado se muestra solo la cantidad de productos cuando son más de uno; si es uno solo se muestra su nombre. Pulsa **Detalles** para ver cada producto, su tipo de precio, cantidad, precio, envío, total y comisión.

**Una venta me aparece como MARKETPLACE y no como SOL.**
Las ventas hechas antes de existir los tipos de precio se marcaron como MARKETPLACE, porque usaron los precios normales.

---

## 7. Reportes y comisiones

**¿Qué veo en Reportes?**
Un vendedor ve solo sus ventas; operador y admin ven todas. Puedes filtrar por fechas, canal, tipo de precio, producto, vendedor y cliente, y exportar a Excel con totales. Cada venta muestra su **comisión**.

**¿Cómo sé cuánto pagarle a cada vendedor?**
En Reportes (operador y admin): **Comisiones a pagar por vendedor**, elige el rango de fechas y pulsa **Calcular**.

**¿Qué ventas cuentan para el pago?**
Solo las ya cerradas y con pago confirmado:
- Ventas de tienda o retiro **completadas**, o envíos **entregados**.
- Las transferencias deben estar **verificadas**.
- Las canceladas y las eliminadas no cuentan.
- El rango de fechas se aplica a la fecha de creación de la venta.

**¿Cuál comisión se le paga por cada venta?**
La de **su tipo de precio**: comisión marketplace si se vendió con MARKETPLACE, comisión tienda si fue SOL, y la regla del mayor si fue venta al mayor. Se guarda al momento de la venta: si después cambias el costo o el precio de un producto, las ventas ya hechas no cambian.

**Una venta no tiene comisión.**
Ocurre con productos libres (no registrados) o con productos sin costo cargado.

---

## 8. Administración

**¿Cómo creo o desactivo un usuario?**
**Usuarios** (solo admin). Desactivar corta el acceso al instante y conserva su historial.

**Borré una venta por error.**
Va a la **Papelera** (solo admin), donde se puede restaurar o eliminar definitivamente.

**¿Dónde veo quién cambió qué?**
En **Auditoría** (solo admin).

**¿Qué son Noticias, Anotaciones y Reglas?**
- **Noticias**: novedades de productos (se generan solas) y avisos manuales.
- **Anotaciones diarias**: bitácora interna de operadores y admin.
- **Reglas**: texto libre que solo el admin edita y todos leen.

**¿Qué configuro en Configuración?**
La hora límite de envíos (semana, sábado y domingo) y el courier predeterminado.

---

## 9. Problemas comunes

| Síntoma | Qué hacer |
|---|---|
| "No hay una caja abierta" | Abrir la caja en Apertura/Cierre de Caja |
| "Venta al mayor: el mínimo es 6 unidades" | Subir la cantidad a 6 o más, o usar otro tipo de precio |
| "El archivo no tiene el formato esperado" | Revisar que la primera fila sea el encabezado exacto de 9 columnas |
| El Excel de edición masiva fue rechazado por filas distintas | Volver a exportar y editar solo valores, sin agregar ni borrar filas |
| No puedo cambiar el producto de un envío | Es un envío con varios productos: eliminarlo y crearlo de nuevo |
| El vendedor no ve un producto en el buscador | Escribe parte del nombre: la lista muestra solo las primeras 100 coincidencias |
| Todo sale en blanco o da error tras un tiempo | Cerrar sesión y volver a entrar |
