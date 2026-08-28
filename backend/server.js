// ConsultHours API — servidor de ejemplo para el ejercicio técnico.
//
// Este código funciona, pero fue escrito de forma deliberadamente descuidada
// para el propósito de esta evaluación. No lo tomes como referencia de buenas
// prácticas — al contrario, parte de tu tarea es encontrar y corregir lo que
// esté mal (incluyendo, no solo, temas de seguridad).
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const authenticateToken = require("./middleware/auth");

const app = express();
const db = new Database("consulthours.db");
// Opciones de CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------
// Agregamos un limitador de intentos
const rateLimit = require("express-rate-limit");
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
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

  const token = jwt.sign(
    { id: consultant.id, username: consultant.username, role: consultant.role },
    JWT_SECRET,
    { expiresIn: "2h" },
  );

  res.json({
    token,
    user: {
      id: consultant.id,
      username: consultant.username,
      role: consultant.role,
      name: consultant.name,
    },
  });
});

// ---------------------------------------------------------------------------
// CLIENTS
// ---------------------------------------------------------------------------

app.get("/api/clients", (req, res) => {
  res.json(db.prepare("SELECT id,name FROM clients").all());
});

// ---------------------------------------------------------------------------
// TIME ENTRIES
// ---------------------------------------------------------------------------

app.get("/api/time-entries", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT te.id, te.consultant_id, te.client_id, te.date, te.start_time, te.end_time, te.billable, te.description, c.name AS client_name, co.name AS consultant_name
    FROM time_entries te
    JOIN clients c ON c.id = te.client_id
    JOIN consultants co ON co.id = te.consultant_id
    ORDER BY te.date DESC, te.start_time ASC
  `,
    )
    .all();
  res.json(rows);
});

// Búsqueda de registros por texto libre en la descripción.
// TODO(frontend): aún no está conectada a ninguna pantalla — es parte del ejercicio.
app.get("/api/time-entries/search", authenticateToken, (req, res) => {
  const q = req.query.q || "";
  const query = `SELECT id, consultant_id, client_id, date, start_time, end_time, billable, description FROM time_entries WHERE description LIKE ?`;
  const rows = db.prepare(query).all(`%${q}%`);
  res.json(rows);
});

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

// Sin ningún tipo de verificación de sesión ni de rol.
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

// ---------------------------------------------------------------------------
// RESUMEN MENSUAL FACTURABLE POR CLIENTE
// TODO(frontend): no hay ninguna pantalla que muestre esto todavía — es parte
// del ejercicio construir la vista de "resumen mensual" para un cliente.
// ---------------------------------------------------------------------------

app.get("/api/summary", authenticateToken, (req, res) => {
  try {
    const { client_id, month, consultant_id } = req.query;

    // Validación de parámetros
    const clientIdNum = Number(client_id);
    if (!Number.isInteger(clientIdNum) || clientIdNum <= 0) {
      return res.status(400).json({ error: "ID de cliente inválido" });
    }

    if (!month || typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
      return res
        .status(400)
        .json({ error: "Formato de mes inválido. Use YYYY-MM" });
    }

    const consultantIdNum = Number(consultant_id);
    if (!Number.isInteger(consultantIdNum) || consultantIdNum <= 0) {
      return res.status(400).json({ error: "ID de consultante inválido" });
    }

    let rows = db
      .prepare(`SELECT id , role  FROM consultants WHERE id = ? `)
      .get(consultantIdNum);

    const role = rows.role;
    let query = ``;

    if (role === "admin") {
      rows = db
        .prepare(
          `SELECT TE.client_id, C.name AS client_name, TE.start_time, TE.end_time, TE.billable
         FROM time_entries TE 
         INNER JOIN clients C ON TE.client_id = C.id
         WHERE TE.client_id = ? AND TE.billable = 1 AND TE.date LIKE ?`,
        )
        .all(clientIdNum, `${month}%`);
    } else {
      rows = db
        .prepare(
          `SELECT TE.client_id, C.name AS client_name, TE.start_time, TE.end_time, TE.billable
         FROM time_entries TE 
         INNER JOIN clients C ON TE.client_id = C.id
         WHERE TE.client_id = ? AND TE.billable = 1 AND TE.date LIKE ? AND TE.consultant_id = ?`,
        )
        .all(clientIdNum, `${month}%`, consultantIdNum);
    }

    // Validamos si obtiene registros
    if (rows.length === 0) {
      // Si es admin, devuelve mensaje genérico; si no, mensaje específico
      if (role === "admin") {
        return res.status(404).json({
          error:
            "No hay horas facturables para este cliente en el mes solicitado",
        });
      } else {
        return res.status(404).json({
          error:
            "Usted no tiene horas facturables para este cliente en el mes solicitado",
        });
      }
    }

    let totalHours = 0;
    const clientName = rows[0].client_name;
    rows.forEach((r) => {
      const [sh, sm] = r.start_time.split(":").map(Number);
      const [eh, em] = r.end_time.split(":").map(Number);
      totalHours += (eh * 60 + em - (sh * 60 + sm)) / 60;
    });

    res.json({
      client_id: clientIdNum,
      clientName: clientName,
      month: month,
      billableHours: Math.round(totalHours * 100) / 100,
      entryCount: rows.length,
    });
  } catch (error) {
    console.error("Error en /api/summary:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`ConsultHours API corriendo en http://localhost:${PORT}`);
});
