# ConsultHours — Ejercicio técnico

Este repositorio es el punto de partida para el ejercicio práctico. Es un registro de horas
facturables para una consultora (parecido a lo que hace RR IT Consulting): consultores
capturan las horas que trabajaron para cada cliente, y se necesita un resumen mensual de
horas facturables por cliente.

Contiene una API (`backend/`) y un frontend (`frontend/`) que **funcionan**, pero fueron
escritos de forma deliberadamente descuidada para efectos de esta evaluación — no los tomes
como referencia de buenas prácticas.

## Cómo correrlo

**Backend**

```bash
cd backend
npm install
npm run seed     # crea backend/consulthours.db con datos de prueba
npm start        # http://localhost:4000
```

Usuarios de prueba (ver `backend/seed.js`): `admin/admin123`, `carla/carla2024`, `miguel/miguel!!`.

**Frontend**

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
```

## Lo que tienes que hacer

Instrucciones completas en el correo/mensaje que acompaña este repositorio. En resumen:

1. Encuentra y corrige los problemas de seguridad del backend (no te decimos cuáles son).
2. Implementa la búsqueda de registros en el frontend, conectándola al backend.
3. Construye una pantalla de "resumen mensual facturable por cliente" usando el endpoint
   `/api/summary` — pero antes de confiar en el número que regresa, verifícalo contra los
   datos de `seed.js`.
4. Agrega control de acceso con dos niveles, no solo uno:
   - **Autenticación**: las acciones que deberían requerir sesión iniciada, la requieren.
   - **Autorización por rol/dueño**: un consultor solo puede eliminar sus propios registros;
     un administrador puede eliminar cualquiera. Al crear un registro, el consultor dueño
     debe tomarse de la sesión iniciada, nunca de un valor que envíe el propio cliente.
     Revisa con cuidado cómo se está creando un registro nuevo hoy.
5. Decide y documenta dos reglas de negocio que el ejercicio deja abiertas a propósito:
   - Qué debería pasar cuando un consultor registra horas que se traslapan con otro
     registro suyo el mismo día (hay un ejemplo real en los datos de prueba, el 6 de agosto).
   - Si un consultor debería poder ver el resumen financiero/facturable de otros consultores,
     o solo el propio.
     No hay una única respuesta correcta en ninguno de los dos casos — justifica la tuya.
6. Sube tu solución con commits incrementales normales (no un solo commit final).
7. Incluye un archivo `NOTES.md` con lo que encontraste, cómo lo corregiste, tus decisiones
   del punto 5, y — si usaste IA como apoyo — qué le pediste y qué tuviste que corregir
   de lo que te propuso.

Puedes usar cualquier herramienta, incluida IA, para resolverlo. Lo que nos interesa no es
si usaste IA, sino si entiendes y puedes defender cada decisión de tu solución.
