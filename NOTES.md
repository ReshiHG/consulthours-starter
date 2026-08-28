# Notas del Desarrollo – ConsultHours

## Resumen del Proceso

## 1. Problemas Iniciales con la Instalación (resumen)

- **Error principal:** `npm install` fallaba al compilar `better-sqlite3`.
- **Diagnóstico:** Faltaban herramientas de compilación (C++ y Python).
- **Solución:** Instalación del workload "Desarrollo para escritorio con C++" en Visual Studio Build Tools 2022.

### Detalles

Al instalar el backend tuve problemas con el comando npm install, así que busqué con la IA a que se debía el problema

**-Pregunté:** Estoy intentando instalar el backend de un repositorio, sin embargo al ejecutar npm install me suelta los siguientes errores "npm error code 1
npm error path C:\laragon\www\consulthours-starter\backend\node_modules\better-sqlite3
npm error command failed
npm error command C:\WINDOWS\system32\cmd.exe /d /s /c node-gyp rebuild
npm error gyp info it worked if it ends with ok"

**-Respuesta (corta):** El error que ves al instalar better-sqlite3 es muy común en Windows cuando faltan herramientas de compilación para módulos nativos. better-sqlite3 necesita compilarse con C++ y requiere Python y las herramientas de compilación de Visual Studio.

Decidí revisar error por error, así que busqué en la web que significa el error "npm error code 1", y encontré que se debe a que la versión de node es muy actual, así que requeire regresar a una versión anterior, para saber que versión se requiere utilicé el comando "npm install --dry-run" que me dio DeepSeek para simular la instalación e indicarme que versión de node necesito, sin embargo esto no mostró ningún error...

Igual decidí hacer un downgrade de Node a la versión 22 que es la que tenia instalada a parte de la 25, sin embargo sigue sin funcionar.

Cambio a preguntarle a la IA pegando toda la lista de errores y me responde esto: "El error es claro: **node-gyp no encuentra una instalación válida de Visual Studio con el workload "Desktop development with C++"**. Aunque tienes Python, te falta el compilador de C++ que necesita better-sqlite3 para compilarse.

Solución 1: Instalar el workload de C++ en Visual Studio Build Tools (recomendada)

Ya tienes Visual Studio Build Tools 2022 instalado (C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools), pero le falta el toolset de C++.
Pasos:

    Abre el Visual Studio Installer desde el menú de inicio.

    Busca "Visual Studio Build Tools 2022" y haz clic en "Modificar".

    En la pestaña "Cargas de trabajo" (Workloads), marca:

        "Desarrollo para el escritorio con C++" (Desktop development with C++)

    Haz clic en "Modificar" en la esquina inferior derecha y espera a que termine la instalación (puede tardar varios minutos).

    Reinicia la terminal y vuelve a ejecutar npm install."

Seguí los pasos y funcionó, básicamente faltaba instalar los paquetes de "Desarrollo para escritorio con C++"

Seguí las intrucciones para terminar de poblar la base de datos y ejecutar el servidor

---

## 1. Encuentra y corrige los problemas de seguridad del backend (no te decimos cuáles son).

### - 1.1. El JWT está escrito directamente en el archivo server.js, lo correcto es manejarlo en el .env y traerlo de ahí

\```javascript
const JWT_SECRET = "consulthours-super-secret-2024";
\```

    Así que le pedí a la IA que me indicara la mejor forma de gestionar las variables de entorno, por eso instale dotenv

### - 1.2 Sospechaba que cors(), debería tener argumentos para indicar que URL podía hacer peticiones, así que le pregunté a la IA como agregarlos. Por ello agregué la URL al .env

\```javascript
app.use(cors());

    const corsOptions = {
      origin: process.env.FRONTEND_URL,
      optionsSuccessStatus: 200,
    };
    app.use(cors(corsOptions));

\```

### - 1.3 En la validación de usuario existe riesgo de inyección sql

\```javascript
const query = `SELECT \* FROM consultants WHERE username = '${username}' AND password = '${password}'`;
const consultant = db.prepare(query).get();
\```

Para solucionarlo implemento una consulta parametrizada

\```javascript
const query = `SELECT id,username,password,name,role FROM consultants WHERE username = ? AND password = ?`;
const consultant = db.prepare(query).get(username, password);
\```

### - 1.4 En api/clients agrega la buena práctica de traer explícitamente las columnas de la tabla

**Mala práctica**
\```javascript
app.get("/api/clients", (req, res) => {
res.json(db.prepare("SELECT \* FROM clients").all());
});
\```

**Buena práctica**
\```javascript
app.get("/api/clients", (req, res) => {
res.json(db.prepare("SELECT id,name FROM clients").all());
});
\```

### - 1.5 Se refactorizó el query del endpoint "/api/time-entries" para solicitar las columnas de forma explícita

\```javascript
app.get("/api/time-entries", (req, res) => {
const rows = db
.prepare(
` SELECT te.id, te.consultant_id, te.client_id, te.date, te.start_time, te.end_time, te.billable, te.description, c.name AS client_name, co.name AS consultant_name
FROM time_entries te
JOIN clients c ON c.id = te.client_id
JOIN consultants co ON co.id = te.consultant_id
ORDER BY te.date DESC, te.start_time ASC
`,
)
.all();
res.json(rows);
});
\```

### - 1.6 En api/time-entries/search hay peligro de inyección SQL y la consulta usa \* (mala práctica)

**Mala práctica**
\```javascript
app.get("/api/time-entries/search", (req, res) => {
const q = req.query.q || "";
const query = `SELECT \* FROM time_entries WHERE description LIKE '%${q}%'`;
const rows = db.prepare(query).all();

res.json(rows);
});
\```

Así que parametrizamos la consulta y llamamos a las columnas explícitamente:

\```javascript
app.get("/api/time-entries/search", (req, res) => {
const q = req.query.q || "";
const query = `SELECT id, consultant_id, client_id, date, start_time, end_time, billable, description FROM time_entries WHERE description LIKE ?`;
const rows = db.prepare(query).all(`%${q}%`);

res.json(rows);
});
\```

### - 1.7 Se refactorizan las columnas del endpoint /api/summary y se mueve el número de puerto al archivo de entorno

## 2. Implementa la búsqueda de registros en el frontend, conectándola al backend.

### Resumen

- **Endpoint probado:** `/api/time-entries/search` (validado con Insomnia).
- **Implementación en frontend:**
  - Creación de `SearchBar` (componente de formulario).
  - Lógica de búsqueda centralizada en `App.tsx` (manejo de estado `Entries`).
  - Llamada a API con `getTimeEntriesSearch()`.

### Detallado

Primeró probé el endpoint con Insomnia y funcionó, una vez validado esto procedí a crear la función getTimeEntriesSearch en el archivo api.ts

Posteriormente necesité crear un componente que fuera un form con input search y con los estilos del login.

Para estructurar el componente y por temas de tiempo le pedí a la IA que estructurará el componente, al principio, pensaba manejar la llamada a la API dentro del componente, pero como los resultados se muestran en pantalla al actualizar el estado Entries, decidí que sería mejor manejar la lógica dentro del mismo App.tsx, así que para reconfigurar esto le solicité a la IA que lo integrara, con esto ya pude manejar el handleSearch en App.tsx y el componente SearchBar solo regresaba el callback con el texto, y este ejecutaba la función getTimeEntriesSearch en App.tsx actualizando el estado Entries y con ello la vista.

## 3. Construye una pantalla de "resumen mensual facturable por cliente" usando el endpoint `/api/summary` — pero antes de confiar en el número que regresa, verifícalo contra los datos de `seed.js`.

### Resumen

- **Verificación manual:** Se detectó que el endpoint `/api/summary` devolvía horas no facturables.
- **Corrección:** Se agregó filtro `billable = 1` en la consulta SQL.
- **Componentes en frontend:**
  - Estado para `summaryData` y `summaryError`.
  - Formulario para seleccionar cliente y mes.
  - Tabla de resultados con manejo de errores (pop-up).

### Detallado

- Primero revise el endpoint con insomnia, para verificar use un caso sencillo, con el cliente Textiles Monarca (id: 3) y me devolvio 3 horas, lo que es incorrecto, ya que solo 2 horas fueron facturables. Así que agregué otra condición al query para que solo traiga las horas facturables desde un inicio, reduciendo la carga en el servidor con datos que serán descartados inmediatamente después.

- Lo siguiente fue crear la función getSummary en api.tsx

- Posteriormente cree dos estados, uno para manejar los datos de envio id y mes, y otro para guardar el resultado

- Luego generé el form para enviar los datos al manejador que utilizaría la función de la API para obtener el resumen

- Por último genere una tabla simple con los datos de las horas facturables

## 4. Agrega control de acceso con dos niveles, no solo uno:

## - **Autenticación**: las acciones que deberían requerir sesión iniciada, la requieren.

## - **Autorización por rol/dueño**: un consultor solo puede eliminar sus propios registros;

## Resumen

### 4.1. Login con Bcrypt y Rate Limiting

- **Bcrypt:** Se instaló `bcrypt` para hashear contraseñas.
- **Rate Limiting:** Se implementó `express-rate-limit` (5 intentos en 15 minutos).
- **Actualización de datos:** Las contraseñas en la base de datos se actualizaron usando `bcrypt.hashSync()`.

### 4.2. Protección de Rutas en Frontend

- Las vistas solo se muestran cuando `user` está definido.
- Uso de `localStorage` para guardar el token.

### 4.3. Autorización por Rol / Propiedad

- **Regla:** Admin puede eliminar cualquier registro. Consultor solo puede eliminar los suyos.
- **Frontend:** Renderizado condicional del botón "Eliminar".
- **Backend:** Middleware `authenticateToken` + verificación de `role` vs `consultant_id`.

### 4.4. Creación de Registros con Autenticación

- **Cambio clave:** `consultant_id` se toma de `req.user.id` (sesión), no del cuerpo de la petición.
- **Validaciones adicionales:**
  - Formato de horas (HH:MM).
  - Solapamiento de horarios (conflicto con otros registros del mismo día).

## Detallado

- Agregué npm install bcrypt para hashear las contraseñas, y las actualicé con node y en la base de datos

\```javascript
node
const bcrypt = require('bcrypt');
bcrypt.hashSync('admin123', 10)
\```

- Posteriormente actualice la forma de hacer el login, buscando por usuario y comparando con bcrypt contra la contraseña en base de datos y para mejorar la seguridad agregamos un login limiter (npm install express-rate-limit)

\```javascript
const rateLimit = require("express-rate-limit");
const loginLimiter = rateLimit({
windowMs: 15 _ 60 _ 1000, // 15 minutos
max: 5, // máximo 5 intentos
message: { error: "Demasiados intentos, intente más tarde" },
});

app.post("/api/login", loginLimiter, async (req, res) => {
const { username, password } = req.body;

const query = `SELECT id, username, password, name, role FROM consultants WHERE username = ?`;
const consultant = db.prepare(query).get(username);

if (!consultant) {
return res.status(401).json({ error: "Credenciales incorrectas" });
}

const isValid = await bcrypt.compare(password, consultant.password);
if (!isValid) {
return res.status(401).json({ error: "Credenciales incorrectas" });
}

[...]

});
\```

- Se restringen las vistas a que solo se muestren si el usuario está logueado. Para ello se agrega el condicional de user

\```typescript
{user && <section></section>}
\```

- Se modifica el endpoint /api/summary para que pida una autenticación de usuario, valide los formatos de entrada y se gestionen los errores mediante un try catch

- Se modifica la función getSummary para que admita el envio de consultantID, además de obtener y usar el token en el header para la validación del usuario, y el manejo del mensaje de error para mostrarlo al usuario cuando intenta consultar horas facturadas de clientes que no atendio

- Se agrega el estado summaryError, se modifica el handleSummary para que actualice dicho estado y envié el user.id al getSummary. Y por último se agrega un Pop-up con el mensaje de error.

## - **Autenticación**: las acciones que deberían requerir sesión iniciada, la requieren.

Para esto, solo se muestran las pantallas cuando el usuario se loguea, y al mismo tiempo se guarda en el localStorage el token del usuario para realizar las validaciones con los endpoints

## - **Autorización por rol/dueño**: un consultor solo puede eliminar sus propios registros;

un administrador puede eliminar cualquiera.

Para que solo el administrador pueda eliminar todos los registros y cada consultor solo pueda eliminar los propios agregamos en el fontend una validación para que el botón eliminar aparezca según este criterio.

\```typescript
{(user.role === "admin" || e.consultant_id === user.id) && (
<button onClick={() => handleDelete(e)}>Eliminar</button>
)}
\```

- Del lado del backend, en el endpoint “/api/time-entries/:id” solicitamos el token de autenticación, validamos que el registro exista y dependiendo si el usuario es admin o propietario del registro permitimos que lo borre

\```javascript
app.delete("/api/time-entries/:id", authenticateToken, (req, res) => {
try {
const entryId = req.params.id;
const userId = req.user.id;
const userRole = req.user.role;

    // Se verifica que el registro exista y se obtiene el consultant_id par validar
    const entry = db
      .prepare("SELECT id, consultant_id FROM time_entries WHERE id = ?")
      .get(entryId);

    if (!entry) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    // Se validan permisos: admin o propietario
    if (userRole !== "admin" && entry.consultant_id !== userId) {
      return res.status(403).json({
        error: "No tienes permiso para eliminar este registro",
      });
    }

    db.prepare("DELETE FROM time_entries WHERE id = ?").run(entryId);

    res.json({ ok: true, message: "Registro eliminado correctamente" });

} catch (error) {
console.error("Error en DELETE /api/time-entries/:id:", error);
res.status(500).json({ error: "Error interno del servidor" });
}
});
\```

- Del lado del fontend en la _api_, modificamos la función deleteTimeEntry para que obtenga y envié el token de autenticación

\```javascript
export async function deleteTimeEntry(id: number): Promise<void> {
const token = localStorage.getItem("token");
const res = await fetch(`${API_URL}/time-entries/${id}`, {
method: "DELETE",
headers: {
Authorization: `Bearer ${token}`,
},
});
if (!res.ok) {
const errorData = await res.json().catch(() => ({}));
throw new Error(errorData.error || "Error al eliminar el registro");
}
}
\```

- Por último en el _handleDelete_ solicitamos una confirmación antes de permitir la eliminación del registro

\```typescript
async function handleDelete(entry: TimeEntry) {
// Confirmar eliminación
const confirmDelete = window.confirm(
`¿Seguro que quieres eliminar el registro del ${entry.date}?`,
);
if (!confirmDelete) return;

    try {
      await deleteTimeEntry(entry.id);
      setEntries(await getTimeEntries());
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert(error.message || "No se pudo eliminar el registro");
    }

}
\```

## Al crear un registro, el consultor dueño debe tomarse de la sesión iniciada, nunca de un valor que envíe el propio cliente. Revisa con cuidado cómo se está creando un registro nuevo hoy.

- Se modifica el handleCreate para que el consultant_id lo tome del user.id que se proporciono al iniciar la sesión.

\```typescript
await createTimeEntry({
consultant_id: user.id, // TODO: usar el consultor con sesión iniciada, no un valor fijo
client_id: Number(form.client_id),
date: form.date,
start_time: form.start_time,
end_time: form.end_time,
billable: form.billable ? 1 : 0,
description: form.description,
});
\```

- Y de manera adicional se solicita la autenticación del usuario al momento de crear en el _endpoint_ y de paso se hace la verificación para evitar solapamientos

\```javascript

app.post("/api/time-entries", authenticateToken, (req, res) => {
try {
let {
consultant_id,
client_id,
date,
start_time,
end_time,
billable,
description,
} = req.body;

    // Validaciones
    if (!Number.isInteger(consultant_id) || consultant_id <= 0) {
      return res.status(400).json({ error: "ID de consultante inválido" });
    }

    if (!Number.isInteger(client_id) || client_id <= 0) {
      return res.status(400).json({ error: "ID de cliente inválido" });
    }

    // Validar formato y orden de horas
    if (
      !/^([01]\d|2[0-3]):([0-5]\d)$/.test(start_time) ||
      !/^([01]\d|2[0-3]):([0-5]\d)$/.test(end_time)
    ) {
      return res
        .status(400)
        .json({ error: "Formato de hora inválido. Use HH:MM" });
    }
    if (start_time >= end_time) {
      return res.status(400).json({
        error: "La hora de inicio debe ser anterior a la hora de fin",
      });
    }

    // Validación de solapamiento
    const conflictQuery = `
      SELECT id FROM time_entries
      WHERE consultant_id = ?
        AND date = ?
        AND (
          (start_time < ? AND end_time > ?) OR  -- nuevo empieza antes de que termine el existente
          (start_time < ? AND end_time > ?) OR  -- nuevo termina después de que empiece el existente
          (start_time >= ? AND end_time <= ?)   -- nuevo está completamente dentro del existente
        )
    `;
    const conflict = db
      .prepare(conflictQuery)
      .get(
        consultant_id,
        date,
        end_time,
        start_time,
        start_time,
        end_time,
        start_time,
        end_time,
      );

    if (conflict) {
      return res.status(409).json({
        error:
          "El consultor ya tiene un registro de horas que se traslapa con el horario solicitado.",
      });
    }

    const stmt = db.prepare(`
      INSERT INTO time_entries (consultant_id, client_id, date, start_time, end_time, billable, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      consultant_id,
      client_id,
      date,
      start_time,
      end_time,
      billable ? 1 : 0,
      description,
    );

    res.status(201).json({ id: result.lastInsertRowid });

} catch (error) {
console.error("Error en POST /api/time-entries:", error);
res.status(500).json({ error: "Error interno del servidor" });
}
});
\```

- En la _api_ se modifica createTimeEntry para enviar el token y manejar los errores

\```javascript
export async function createTimeEntry(
input: Omit<TimeEntry, "id">,
): Promise<{ id: number }> {
const token = localStorage.getItem("token");
const res = await fetch(`${API_URL}/time-entries`, {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${token}`,
},
body: JSON.stringify(input),
});
if (!res.ok) {
const errorData = await res.json().catch(() => ({}));
throw new Error(errorData.error || "Error al crear el registro");
}
return res.json();
}
\```

- Y en el _handleCreate_ se modifica para manejar los errores y validar si intentan agregar horas que se solapan

\```typescript
async function handleCreate(e: React.FormEvent) {
e.preventDefault();

    // Validar que todos los campos estén completos
    if (
      !form.client_id ||
      !form.date ||
      !form.start_time ||
      !form.end_time ||
      !user
    ) {
      alert("Todos los campos son obligatorios");
      return;
    }

    // Validar que la hora de inicio sea anterior a la de fin
    if (form.start_time >= form.end_time) {
      alert("La hora de inicio debe ser anterior a la hora de fin");
      return;
    }

    try {
      await createTimeEntry({
        consultant_id: user.id,
        client_id: Number(form.client_id),
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        billable: form.billable ? 1 : 0,
        description: form.description,
      });

      // Éxito: limpiar formulario y recargar lista
      setForm({
        client_id: "",
        date: "",
        start_time: "",
        end_time: "",
        billable: true,
        description: "",
      });
      setEntries(await getTimeEntries());
      alert("Registro creado correctamente");
    } catch (error) {
      console.error("Error al crear registro:", error);
      alert(error.message || "No se pudo crear el registro");
    }

}
\```

## 5. Decide y documenta dos reglas de negocio que el ejercicio deja abiertas a propósito:

### - Qué debería pasar cuando un consultor registra horas que se traslapan con otro registro suyo el mismo día (hay un ejemplo real en los datos de prueba, el 6 de agosto).

- No se debería permitir que las horas se solapen para evitar una doble facturación, y mantener los registros confiables. el sistema debe validar las horas antes de hacer el insert

### - Si un consultor debería poder ver el resumen financiero/facturable de otros consultores, o solo el propio.

- Los consultores pueden ver los registros de los demás, sin embargo solo pueden eliminar sus propios registros (excepto para el rol admin, este puede eliminar cualquier registro) y en el resumen de horas facturables solo pueden ver las horas en las que trabajaron ellos mismos, excepto si el rol es admin.

  No hay una única respuesta correcta en ninguno de los dos casos — justifica la tuya.

## 6. Sube tu solución con commits incrementales normales (no un solo commit final).

## 7. Incluye un archivo `NOTES.md` con lo que encontraste, cómo lo corregiste, tus decisiones del punto 5, y — si usaste IA como apoyo — qué le pediste y qué tuviste que corregir de lo que te propuso.

- En general le solicitaba a la ia las estructuras de los componentes y tips para mejorar el código, de lo que me arrojaba solo implementaba lo que necesitaba y hacia correcciones en nombres de variables o le indicaba que obtuviera, por ejemplo, el id del _usuario.id_ que se guardo cuando el usuario inició sesión
