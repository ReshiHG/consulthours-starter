import { useEffect, useState } from "react";
import {
  getTimeEntries,
  getTimeEntriesSearch,
  getClients,
  login,
  createTimeEntry,
  deleteTimeEntry,
  type TimeEntry,
  type Client,
  type SummaryResult,
  getSummary,
} from "./api";
import "./App.css";
import { SearchBar } from "./components/SearchBar";

function App() {
  const [user, setUser] = useState<{
    id: number;
    username: string;
    role: string;
    name: string;
  } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [form, setForm] = useState({
    client_id: "",
    date: "",
    start_time: "",
    end_time: "",
    billable: true,
    description: "",
  });

  const [summaryForm, setSummaryForm] = useState({
    client_id: "",
    month: "",
  });
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(
    null,
  );
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    getTimeEntries().then(setEntries);
    getClients().then(setClients);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      const data = await login(username, password);
      setUser(data.user);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch {
      setLoginError("Usuario o contraseña incorrectos");
    }
  }

  async function handleSearch(q: string) {
    const results = await getTimeEntriesSearch(q);
    setEntries(results);
  }

  async function handleSummary(e: React.FormEvent) {
    e.preventDefault();
    if (!summaryForm.client_id || !summaryForm.month || !user) return;
    setSummaryError(null);
    try {
      const result = await getSummary(
        Number(summaryForm.client_id),
        summaryForm.month,
        user.id,
      );
      setSummaryResult(result);
    } catch (error) {
      console.error("Error al obtener resumen:", error);
      setSummaryError(error.message || "Error al obtener el resumen");
      setSummaryResult(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.client_id ||
      !form.date ||
      !form.start_time ||
      !form.end_time ||
      !user
    )
      return;
    await createTimeEntry({
      consultant_id: user.id, // TODO: usar el consultor con sesión iniciada, no un valor fijo
      client_id: Number(form.client_id),
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      billable: form.billable ? 1 : 0,
      description: form.description,
    });
    setForm({
      client_id: "",
      date: "",
      start_time: "",
      end_time: "",
      billable: true,
      description: "",
    });
    setEntries(await getTimeEntries());
  }

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

  return (
    <div className="app">
      <header>
        <h1>ConsultHours</h1>
        {user ? (
          <span className="user-pill">
            {user.name} · {user.role}
          </span>
        ) : (
          <span className="user-pill muted">sin sesión</span>
        )}
      </header>

      {!user && (
        <form className="login-form" onSubmit={handleLogin}>
          <h2>Iniciar sesión</h2>
          <input
            placeholder="usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            placeholder="contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">Entrar</button>
          {loginError && <p className="error">{loginError}</p>}
        </form>
      )}
      {user && (
        <section className="summary">
          {/*
          TODO (parte del ejercicio): construir aquí una vista de "resumen
          mensual facturable por cliente" usando GET /api/summary. Antes de
          confiar en el número que regresa el backend, verifícalo contra los
          datos de prueba de seed.js.
        */}
          <h2>Resumen mensual</h2>
          <form onSubmit={handleSummary}>
            <select
              value={summaryForm.client_id}
              onChange={(e) =>
                setSummaryForm({ ...summaryForm, client_id: e.target.value })
              }
            >
              <option value="">cliente…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              placeholder="AAAA-MM"
              value={summaryForm.month}
              onChange={(e) =>
                setSummaryForm({ ...summaryForm, month: e.target.value })
              }
            />
            <button type="submit">Generar</button>
          </form>

          {summaryResult && (
            <div className="summary-result">
              <h3>Resultado</h3>
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Mes</th>
                    <th>Horas facturables</th>
                    <th>Nº registros</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{summaryResult.clientName || "Sin nombre"}</td>
                    <td>{summaryResult.month}</td>
                    <td>{summaryResult.billableHours}</td>
                    <td>{summaryResult.entryCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {user && (
        <section className="search-bar">
          {/*
          TODO (parte del ejercicio): agregar aquí un buscador que filtre los
          registros por texto usando GET /api/time-entries/search?q=... No hay
          ninguna pantalla conectada a ese endpoint todavía.
        */}
          <SearchBar onSearch={handleSearch} />
        </section>
      )}

      {user && (
        <section className="entry-list">
          <h2>Registros de horas</h2>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Consultor</th>
                <th>Cliente</th>
                <th>Horario</th>
                <th>Facturable</th>
                <th>Descripción</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>{e.consultant_name}</td>
                  <td>{e.client_name}</td>
                  <td>
                    {e.start_time}–{e.end_time}
                  </td>
                  <td>{e.billable ? "Sí" : "No"}</td>
                  <td>{e.description}</td>
                  <td>
                    {(user.role === "admin" || e.consultant_id === user.id) && (
                      <button onClick={() => handleDelete(e)}>Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {user && (
        <section className="new-entry">
          <h2>Registrar horas</h2>
          <form onSubmit={handleCreate}>
            <select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            >
              <option value="">cliente…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            />
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.billable}
                onChange={(e) =>
                  setForm({ ...form, billable: e.target.checked })
                }
              />
              Facturable
            </label>
            <input
              placeholder="descripción"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <button type="submit">Agregar</button>
          </form>
        </section>
      )}

      {summaryError && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p>{summaryError}</p>
            <button onClick={() => setSummaryError(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
