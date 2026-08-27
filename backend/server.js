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

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const query = `SELECT id,username,password,name,role FROM consultants WHERE username = ? AND password = ?`;
  const consultant = db.prepare(query).get(username, password);

  if (!consultant) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
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
  res.json(db.prepare("SELECT * FROM clients").all());
});

// ---------------------------------------------------------------------------
// TIME ENTRIES
// ---------------------------------------------------------------------------

app.get("/api/time-entries", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT te.*, c.name AS client_name, co.name AS consultant_name
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
app.get("/api/time-entries/search", (req, res) => {
  const q = req.query.q || "";
  const query = `SELECT * FROM time_entries WHERE description LIKE '%${q}%'`;
  const rows = db.prepare(query).all();
  res.json(rows);
});

app.post("/api/time-entries", (req, res) => {
  const {
    consultant_id,
    client_id,
    date,
    start_time,
    end_time,
    billable,
    description,
  } = req.body;
  // Nota: no se valida que el consultor ya tenga un registro en ese mismo
  // rango de horas ese día. Ver instrucciones del ejercicio.
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
});

// Sin ningún tipo de verificación de sesión ni de rol.
app.delete("/api/time-entries/:id", (req, res) => {
  db.prepare("DELETE FROM time_entries WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// RESUMEN MENSUAL FACTURABLE POR CLIENTE
// TODO(frontend): no hay ninguna pantalla que muestre esto todavía — es parte
// del ejercicio construir la vista de "resumen mensual" para un cliente.
// ---------------------------------------------------------------------------

app.get("/api/summary", (req, res) => {
  const { client_id, month } = req.query; // month formato "2026-08"

  const rows = db
    .prepare(
      `
    SELECT * FROM time_entries WHERE client_id = ? AND date LIKE ?
  `,
    )
    .all(client_id, `${month}%`);

  let totalHours = 0;
  rows.forEach((r) => {
    const [sh, sm] = r.start_time.split(":").map(Number);
    const [eh, em] = r.end_time.split(":").map(Number);
    totalHours += (eh * 60 + em - (sh * 60 + sm)) / 60;
  });

  res.json({
    client_id: Number(client_id),
    month,
    billableHours: Math.round(totalHours * 100) / 100,
    entryCount: rows.length,
  });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`ConsultHours API corriendo en http://localhost:${PORT}`);
});
