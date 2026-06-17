const URL_VERSION_GITHUB = "https://raw.githubusercontent.com/Rober7oMR/YT-Music-Mini-Player/main/version.json";

// 1. Ventana flotante
chrome.action.onClicked.addListener((tab) => {
  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "panel", 
    width: 260,
    height: 385,
    focused: true
  });
});

// 2. Crear la alarma diaria al instalar o actualizar la extensión
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("checarActualizacion", { periodInMinutes: 1440 }); 
    verificarVersion(); 
});

// 3. Escuchar cuando se dispare la alarma diaria
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checarActualizacion") {
        verificarVersion();
    }
});

// 4. Lógica de petición a tu GitHub
function verificarVersion() {
    const manifest = chrome.runtime.getManifest();
    const versionActual = manifest.version; 

    fetch(URL_VERSION_GITHUB)
        .then(response => response.json())
        .then(data => {
            if (data.version && data.version !== versionActual) {
                chrome.storage.local.set({ 
                    updateAvailable: true, 
                    latestVersion: data.version,
                    updateUrl: data.url 
                });
            } else {
                chrome.storage.local.set({ updateAvailable: false });
            }
        })
        .catch(err => console.log("Error al verificar actualización:", err));
}