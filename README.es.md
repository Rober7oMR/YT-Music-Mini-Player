# YT Music Mini Player & Lyrics

Idioma: [English 🇺🇸](README.md) | [Español 🇪🇸](README.es.md)

Una extensión de navegador elegante, compacta y eficiente diseñada para mejorar tu experiencia en YouTube Music. Permite controlar tu música mediante un reproductor flotante, visualizar letras sincronizadas y mantener la interfaz al mínimo con modos especializados.

---

## Características Principales

* **Mini Reproductor Flotante:** Controla la reproducción de YouTube Music sin cambiar de pestaña.
* **Letras Sincronizadas (Karaoke):** Visualiza las letras de tus canciones favoritas en tiempo real de forma sincronizada.
* **Modos Compacto & PiP:** Adapta la interfaz al tamaño que necesites, incluyendo soporte para el modo Picture-in-Picture nativo.
* **Soporte Multilenguaje:** Interfaz totalmente internacionalizada (disponible en Español e Inglés).
* **Alertas de Actualización:** Sistema integrado que te avisa de forma sutil en el menú principal cuando hay una nueva versión disponible en GitHub.

---

## Instalación (Modo Desarrollador)

Al ser un proyecto de código abierto alojado en GitHub, puedes instalar la extensión manualmente siguiendo estos sencillos pasos:

1. Ve a la sección de **Releases** en este repositorio y descarga el archivo `.zip` de la última versión estable (v1.0).
2. Descomprime el archivo en cualquier carpeta de tu computadora.
3. Abre Google Chrome (o cualquier navegador basado en Chromium) e ingresa a la dirección: `chrome://extensions/`.
4. Activa el interruptor de **Modo de desarrollador** en la esquina superior derecha.
5. Haz clic en el botón **Cargar descomprimida** (Load unpacked) en la esquina superior izquierda.
6. Selecciona la carpeta donde descomprimiste los archivos de la extensión.

¡Listo! El icono de la extensión aparecerá en tu barra de herramientas.

---

## Estructura del Proyecto

Para los desarrolladores interesados en explorar o colaborar con el código:

* `manifest.json`: Configuración nativa de la extensión (Manifest V3), permisos y metadatos.
* `background.js`: Service worker en segundo plano encargado de la gestión de ventanas y de verificar las actualizaciones diarias.
* `popup.html` & `popup.js`: La interfaz gráfica principal de la extensión y su lógica de interacción.
* `content.js`: Script inyectado en YouTube Music para leer los datos de reproducción y sincronizar las letras.
* `_locales/`: Carpetas de internacionalización que contienen los archivos `messages.json` (Traducciones).

---

## Licencia

Este proyecto está bajo la licencia **GNU GPLv3** (GNU General Public License v3.0).

Esto significa que eres completamente libre de descargar, ver, modificar y compartir este código. Sin embargo, cualquier obra derivada o copia modificada **está obligado por ley a mantenerse pública, compartir su código fuente y distribuirse bajo esta misma licencia**. Queda estrictamente prohibido cerrar el código o colocar barreras de pago comerciales sobre este proyecto o sus derivados.

---
Desarrollado con ❤️ para la comunidad de software libre.