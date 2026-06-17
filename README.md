# YT Music Mini Player & Lyrics

Language: [English 🇺🇸](README.md) | [Español 🇪🇸](README.es.md)

An elegant, compact, and efficient browser extension designed to enhance your YouTube Music experience. It allows you to control your music via a floating player, view synchronized lyrics, and keep the interface minimal using specialized modes.

---

## Key Features

* **Floating Mini Player:** Control your YouTube Music playback without switching tabs.
* **Synchronized Lyrics (Karaoke):** View your favorite songs' lyrics in real-time, perfectly synced.
* **Compact & PiP Modes:** Adapt the interface to any size you need, including full support for native Picture-in-Picture mode.
* **Multi-language Support:** Fully internationalized interface (available in both English and Spanish).
* **Update Alerts:** An integrated system that subtly notifies you in the main menu when a new version is available on GitHub.

---

## Installation (Developer Mode)

Since this is an open-source project hosted on GitHub, you can install the extension manually by following these steps:

1. Go to the **Releases** section in this repository and download the `.zip` file of the latest stable version (v1.0).
2. Extract the file into any folder on your computer.
3. Open Google Chrome (or any Chromium-based browser) and navigate to `chrome://extensions/`.
4. Turn on the **Developer mode** toggle in the top-right corner.
5. Click the **Load unpacked** button in the top-left corner.
6. Select the folder where you extracted the extension files.

That's it! The extension icon will appear in your toolbar.

---

## Project Structure

For developers looking to explore or contribute to the codebase:

* `manifest.json`: Native extension configuration (Manifest V3), permissions, and metadata.
* `background.js`: Background service worker managing windows and handling the daily update checks.
* `popup.html` & `popup.js`: The main graphical user interface and its interaction logic.
* `content.js`: Script injected into YouTube Music to read playback data and sync lyrics.
* `_locales/`: Internationalization folders containing the `messages.json` files (Translations).

---

## License

This project is licensed under the **GNU GPLv3** (GNU General Public License v3.0).

This means you are completely free to download, view, modify, and share this code. However, any derivative work or modified copy **is legally required to remain open-source, share its source code, and be distributed under this exact same license**. Closing the source code or placing commercial paywalls over this project or its derivatives is strictly prohibited.

---
Built with ❤️ for the open-source community.