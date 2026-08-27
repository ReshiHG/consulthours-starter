const API_URL = "http://localhost:4000/api";

export type Client = { id: number; name: string };

export type TimeEntry = {
  id: number;
  consultant_id: number;
  client_id: number;
  client_name?: string;
  consultant_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  billable: 0 | 1;
  description: string;
};

export type LoginResponse = {
  token: string;
  user: { id: number; username: string; role: string; name: string };
};

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Credenciales inválidas");
  return res.json();
}

export async function getClients(): Promise<Client[]> {
  const res = await fetch(`${API_URL}/clients`);
  return res.json();
}

export async function getTimeEntries(): Promise<TimeEntry[]> {
  const res = await fetch(`${API_URL}/time-entries`);
  return res.json();
}

export async function createTimeEntry(
  input: Omit<TimeEntry, "id">,
): Promise<{ id: number }> {
  const res = await fetch(`${API_URL}/time-entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function deleteTimeEntry(id: number): Promise<void> {
  await fetch(`${API_URL}/time-entries/${id}`, { method: "DELETE" });
}

// TODO (parte del ejercicio): implementar aquí una función searchTimeEntries(q)
// que llame a GET /api/time-entries/search?q=... y se use desde un buscador en la UI.
export async function getTimeEntriesSearch(q: string): Promise<TimeEntry[]> {
  const res = await fetch(`${API_URL}/time-entries/search?q=${q}`);
  return res.json();
}

// TODO (parte del ejercicio): implementar aquí una función getSummary(clientId, month)
// que llame a GET /api/summary?client_id=...&month=... y se use en una pantalla de
// "resumen mensual facturable por cliente". Antes de confiar en el número que
// devuelve, revisa si es consistente con los datos de prueba.
