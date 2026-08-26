Al instalar el backend tuve problemas con el comando npm install, así que busqué cin la IA a que se debía el problema

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
