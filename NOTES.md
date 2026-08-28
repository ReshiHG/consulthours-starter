Al instalar el backend tuve problemas con el comando npm install, así que busqué con la IA a que se debía el problema

-Pregunté: Estoy intentando instalar el backend de un repositorio, sin embargo al ejecutar npm install me suelta los siguientes errores "npm error code 1
npm error path C:\laragon\www\consulthours-starter\backend\node_modules\better-sqlite3
npm error command failed
npm error command C:\WINDOWS\system32\cmd.exe /d /s /c node-gyp rebuild
npm error gyp info it worked if it ends with ok"

-Respuesta (corta): El error que ves al instalar better-sqlite3 es muy común en Windows cuando faltan herramientas de compilación para módulos nativos. better-sqlite3 necesita compilarse con C++ y requiere Python y las herramientas de compilación de Visual Studio.

Decidí revisar error por error, así que busqué en la web que significa el error "npm error code 1", y encontré que se debe a que la versión de node es muy actual, así que requeire regresar a una versión anterior, para saber que versión se requiere utilicé el comando "npm install --dry-run" que me dio DeepSeek para simular la instalación e indicarme que versión de node necesito, sin embargo esto no mostró ningún error...

Igual decidí hacer un downgrade de Node a la versión 22 que es la que tenia instalada a parte de la 25, sin embargo sigue sin funcionar.

Cambio a preguntarle a la IA pegando toda la lista de errores y me responde esto: "El error es claro: node-gyp no encuentra una instalación válida de Visual Studio con el workload "Desktop development with C++". Aunque tienes Python, te falta el compilador de C++ que necesita better-sqlite3 para compilarse.

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

1. Encuentra y corrige los problemas de seguridad del backend (no te decimos cuáles son).

1.1. El JWT está escrito directamente en el archivo server.js, lo correcto es manejarlo en el .env y traerlo de ahí

    const JWT_SECRET = "consulthours-super-secret-2024";

    Así que le pedí a la IA que me indicara la mejor forma de gestionar las variables de entorno, por eso instale dotenv

1.2 Sospechaba que cors(), debería tener argumentos para indicar que URL podía hacer peticiones, así que le pregunté a la IA como agregarlos. Por ello agregué la URL al .env

    app.use(cors());

    const corsOptions = {
      origin: process.env.FRONTEND_URL,
      optionsSuccessStatus: 200,
    };
    app.use(cors(corsOptions));

1.3 En la validación de usuario existe riesgo de inyección sql

const query = `SELECT * FROM consultants WHERE username = '${username}' AND password = '${password}'`;
const consultant = db.prepare(query).get();

Para solucionarlo implemento una consulta parametrizada

const query = `SELECT id,username,password,name,role FROM consultants WHERE username = ? AND password = ?`;
const consultant = db.prepare(query).get(username, password);

1.4 En api/clients agrega la buena práctica de traer explícitamente las columnas de la tabla

app.get("/api/clients", (req, res) => {
res.json(db.prepare("SELECT \* FROM clients").all());
});

app.get("/api/clients", (req, res) => {
res.json(db.prepare("SELECT id,name FROM clients").all());
});

1.5 Refactorizamos el query del endpoint "/api/time-entries" para solicitar las columnas de forma explícita

app.get("/api/time-entries", (req, res) => {
const rows = db
.prepare(
`     SELECT te.id, te.consultant_id, te.client_id, te.date, te.start_time, te.end_time, te.billable, te.description, c.name AS client_name, co.name AS consultant_name
    FROM time_entries te
    JOIN clients c ON c.id = te.client_id
    JOIN consultants co ON co.id = te.consultant_id
    ORDER BY te.date DESC, te.start_time ASC
  `,
)
.all();
res.json(rows);
});

1.6 En api/time-entries/search hay peligro de inyección SQL y la consulta usa \* (mala práctica)

app.get("/api/time-entries/search", (req, res) => {
const q = req.query.q || "";
const query = `SELECT * FROM time_entries WHERE description LIKE '%${q}%'`;
const rows = db.prepare(query).all();

res.json(rows);
});

Así que parametrizamos la consulta y llamamos a las columnas explícitamente

app.get("/api/time-entries/search", (req, res) => {
const q = req.query.q || "";
const query = `SELECT id, consultant_id, client_id, date, start_time, end_time, billable, description FROM time_entries WHERE description LIKE ?`;
const rows = db.prepare(query).all(`%${q}%`);

res.json(rows);
});

1.7 Se refactorizan las columnas del endpoint /api/summary y se mueve el número de puerto al archivo de entorno

2. Implementa la búsqueda de registros en el frontend, conectándola al backend.

2.1 Primeró probé el endpoint con Insomnia y funcionó, una vez validado esto procedí a crear la función getTimeEntriesSearch en el archivo api.ts

Posteriormente necesité crear un componente que fuera un form con input search y con los estilos del login.

Para estructurar el componente y por temas de tiempo le pedí a la IA que estructurará el componente, al principio, pensaba manejar la llamada a la API dentro del componente, pero como los resultados se muestran en pantalla al actualizar el estado Entries, decidí que sería mejor manejar la lógica dentro del mismo App.tsx, así que para reconfigurar esto le solicité a la IA que lo integrara, con esto ya pude manejar el handleSearch en App.tsx y el componente SearchBar solo regresaba el callback con el texto, y este ejecutaba la función getTimeEntriesSearch en App.tsx actualizando el estado Entries y con ello la vista.

3. Construye una pantalla de "resumen mensual facturable por cliente" usando el endpoint
   `/api/summary` — pero antes de confiar en el número que regresa, verifícalo contra los
   datos de `seed.js`.

3.1 Primero revise el endpoint con insomnia, para verificar use un caso sencillo, con el cliente Textiles Monarca (id: 3) y me devolvio 3 horas, lo que es incorrecto, ya que solo 2 horas fueron facturables. Así que agregué otra condición al query para que solo traiga las horas facturables desde un inicio, reduciendo la carga en el servidor con datos que serán descartados inmediatamente después.

Lo siguiente fue crear la función getSummary en api.tsx

Posteriormente cree dos estados, uno para manejar los datos de envio id y mes, y otro para guardar el resultado

Luego generé el form para enviar los datos al manejador que utilizaría la función de la API para obtener el resumen

Por último genere una tabla simple con los datos de las horas facturables

4. Agrega control de acceso con dos niveles, no solo uno:
   - **Autenticación**: las acciones que deberían requerir sesión iniciada, la requieren.
   - **Autorización por rol/dueño**: un consultor solo puede eliminar sus propios registros;
     un administrador puede eliminar cualquiera.
     Al crear un registro, el consultor dueño debe tomarse de la sesión iniciada, nunca de un valor que envíe el propio cliente.
     Revisa con cuidado cómo se está creando un registro nuevo hoy.

4.1 Agregué npm install bcrypt para hashear las contraseñas, y las actualicé con node y en la base de datos
node
const bcrypt = require('bcrypt');
bcrypt.hashSync('admin123', 10)

Posteriormente actualice la forma de hacer el login, buscando por usuario y comparando con bcrypt contra la contraseña en base de datos y para mejorar la seguridad agregamos un login limiter (npm install express-rate-limit)

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

Se restringen las vistas a que solo se muestren si el usuario está logueado. Para ello se agrega el condicional de user {user && <section></section>}

Se modifica el endpoint /api/summary para que pida una autenticación de usuario, valide los formatos de entrada y se gestionen los errores mediante un try catch

Se modifica la función getSummary para que admita el envio de consultantID, además de obtener y usar el token en el header para la validación del usuario, y el manejo del mensaje de error para mostrarlo al usuario cuando intenta consultar horas facturadas de clientes que no atendio

También se agrega el estado summaryError, se modifica el handleSummary para que actualice dicho estado y envié el user.id al getSummary. Y por último se agrega un Pop-up con el mensaje de error.

5. Decide y documenta dos reglas de negocio que el ejercicio deja abiertas a propósito:
   - Qué debería pasar cuando un consultor registra horas que se traslapan con otro
     registro suyo el mismo día (hay un ejemplo real en los datos de prueba, el 6 de agosto).
   - Si un consultor debería poder ver el resumen financiero/facturable de otros consultores,
     o solo el propio.

     Los consultores pueden ver los registros de los demás, sin embargo solo pueden eliminar sus propios registros (excepto para el rol admin, este puede eliminar cualquier registro) y en el resumen de horas facturables solo pueden ver las horas en las que trabajaron ellos mismos, excepto si el rol es admin.

     No hay una única respuesta correcta en ninguno de los dos casos — justifica la tuya.

6. Sube tu solución con commits incrementales normales (no un solo commit final).
7. Incluye un archivo `NOTES.md` con lo que encontraste, cómo lo corregiste, tus decisiones
   del punto 5, y — si usaste IA como apoyo — qué le pediste y qué tuviste que corregir
   de lo que te propuso.
