// seed.js — crea/reinicia la base de datos de ejemplo con datos de prueba.
// Ejecuta: node seed.js

const Database = require("better-sqlite3");
const db = new Database("consulthours.db");

db.exec(`
  DROP TABLE IF EXISTS time_entries;
  DROP TABLE IF EXISTS clients;
  DROP TABLE IF EXISTS consultants;

  CREATE TABLE consultants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'consultant'
  );

  CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consultant_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    billable INTEGER NOT NULL DEFAULT 1,
    description TEXT NOT NULL
  );
`);

// NOTA: contraseñas en texto plano a propósito para este ejercicio de evaluación.
const insertConsultant = db.prepare(
  "INSERT INTO consultants (username, password, name, role) VALUES (?, ?, ?, ?)"
);
insertConsultant.run("admin", "admin123", "Admin", "admin");
insertConsultant.run("carla", "carla2024", "Carla Reyes", "consultant");
insertConsultant.run("miguel", "miguel!!", "Miguel Torres", "consultant");

const insertClient = db.prepare("INSERT INTO clients (name) VALUES (?)");
insertClient.run("Grupo Ferretero del Norte");
insertClient.run("Clínica San Rafael");
insertClient.run("Textiles Monarca");

const insertEntry = db.prepare(`
  INSERT INTO time_entries (consultant_id, client_id, date, start_time, end_time, billable, description)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// consultant_id: 2 = carla, 3 = miguel · client_id: 1 = Ferretero, 2 = Clínica, 3 = Monarca
const entries = [
  // --- Carla, agosto 2026, cliente Grupo Ferretero del Norte ---
  [2, 1, "2026-08-03", "09:00", "13:00", 1, "Levantamiento de requerimientos módulo de inventario"],
  [2, 1, "2026-08-03", "14:00", "17:00", 1, "Diseño de esquema de base de datos"],
  [2, 1, "2026-08-04", "09:00", "12:00", 0, "Junta interna de seguimiento de proyecto (no facturable)"],
  [2, 1, "2026-08-05", "10:00", "12:30", 1, "Implementación de endpoint de reportes"],
  // Traslape intencional el mismo día para el mismo consultor — decisión de negocio a cargo del candidato:
  [2, 1, "2026-08-06", "09:00", "13:00", 1, "Soporte en sitio con el cliente"],
  [2, 1, "2026-08-06", "12:00", "15:00", 1, "Capacitación a usuarios finales"],

  // --- Miguel, agosto 2026, cliente Clínica San Rafael ---
  [3, 2, "2026-08-03", "08:00", "12:00", 1, "Migración de datos de pacientes"],
  [3, 2, "2026-08-10", "09:00", "11:00", 0, "Capacitación interna sobre HIPAA (no facturable)"],
  [3, 2, "2026-08-12", "13:00", "18:00", 1, "Integración con sistema de citas"],

  // --- Admin, agosto 2026, cliente Textiles Monarca ---
  [1, 3, "2026-08-07", "09:00", "11:00", 1, "Reunión de arranque de proyecto"],
  [1, 3, "2026-08-20", "09:00", "10:00", 0, "Administración interna (no facturable)"],
];
entries.forEach((e) => insertEntry.run(...e));

console.log("Base de datos inicializada con datos de prueba.");
console.log("Usuarios: admin/admin123, carla/carla2024, miguel/miguel!!");
db.close();
