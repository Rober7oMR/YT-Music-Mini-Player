// content.js

// --- CONFIGURACIÓN DE DEPURACIÓN ---
const DEBUG_MODE = false; // Cambia a true para ver los rastreadores en consola

function logDebug(mensaje) {
    if (DEBUG_MODE) console.log(mensaje);
}

// --- VARIABLES GLOBALES ---
let currentSongId = "";
let lyricsState = { text: chrome.i18n.getMessage("lyrics_buscando") || "Buscando letras...", isProcessed: false, attempts: 0 };
const MAX_ATTEMPTS = 10; 
let tiempoCambioCancion = 0; 
let elementoAudioVideoCache = null; 

logDebug("DEBUG: content.js se ha cargado correctamente en esta pestaña.");

// --- CACHÉ MULTIMEDIA ---
function obtenerElementoMultimedia() {
    if (elementoAudioVideoCache && document.contains(elementoAudioVideoCache)) {
        return elementoAudioVideoCache;
    }
    elementoAudioVideoCache = document.querySelector('video') || document.querySelector('audio');
    return elementoAudioVideoCache;
}

// --- ALGORITMO DE EXTRACCIÓN ---
function getLyricsFromPage() {
    const shelves = document.querySelectorAll('ytmusic-description-shelf-renderer');
    logDebug(`[DEBUG] Buscando letras. Se encontraron ${shelves.length} contenedores totales.`);
    
    let bestCandidate = null;
    let maxLines = 0;

    shelves.forEach((shelf, index) => {
        const esOculto = shelf.closest('[hidden]') || shelf.style.display === 'none' || shelf.offsetParent === null;
        
        if (esOculto) {
            logDebug(`[DEBUG] Contenedor ${index} detectado pero está oculto. Saltando.`);
            return; 
        }

        const content = shelf.querySelector('.description')?.innerText || "";
        const lineCount = (content.match(/\n/g) || []).length;
        
        logDebug(`[DEBUG] Contenedor ${index} visible. Saltos de línea: ${lineCount}. Longitud: ${content.length}`);

        if (lineCount > maxLines && lineCount > 10) {
            logDebug(`[DEBUG] Contenedor ${index} supera filtro (> 10 líneas). Marcado como mejor candidato.`);
            maxLines = lineCount;
            bestCandidate = content;
        }
    });

    logDebug(`[DEBUG] Resultado de getLyricsFromPage(): ${bestCandidate ? "LETRA ENCONTRADA" : "NULL"}`);
    return bestCandidate;
}

// --- CLICKER DE PESTAÑA "LETRA" ---
function activarPestañaLetras() {
    const tabs = document.querySelectorAll('div.tab-content.style-scope.tp-yt-paper-tab');
    tabs.forEach(tab => {
        const texto = tab.innerText.toLowerCase();
        if (texto.includes('letra') || texto.includes('lyric')) {
            const parentTab = tab.closest('tp-yt-paper-tab');
            if (parentTab && parentTab.getAttribute('aria-selected') !== 'true') {
                parentTab.click();
                logDebug("[Content Script] Clic automatizado en pestaña Letras.");
            }
        }
    });
}

// --- ESCUCHADOR CENTRAL DE MENSAJES ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const video = obtenerElementoMultimedia();

    if (request.command === "GET_INFO") {
        
        if (request.shouldClickLyrics) {
            activarPestañaLetras();
        }

        const lyrics = getLyricsFromPage();

        // METADATOS DE LA CANCIÓN
        const titleEl = document.querySelector('.title.ytmusic-player-bar');
        const artistEl = document.querySelector('.byline.ytmusic-player-bar');
        const coverEl = document.querySelector('.image.ytmusic-player-bar');
        
        let coverUrl = coverEl ? coverEl.src : "";
        if (coverUrl && coverUrl.startsWith('http')) {
            coverUrl = coverUrl.replace(/w\d+-h\d+/, 'w400-h400');
        }

        const textoDesconocido = chrome.i18n.getMessage("js_desconocido");
        const songTitle = titleEl ? titleEl.innerText : textoDesconocido;
        const songArtist = artistEl ? artistEl.innerText : textoDesconocido;
        const songId = `${songTitle} - ${songArtist}`;

        const ahora = Date.now();

        // RESETEO DE ESTADOS AL CAMBIAR DE CANCIÓN
        if (songId !== currentSongId) {
            lyricsState = { 
                text: chrome.i18n.getMessage("lyrics_buscando"), 
                isProcessed: false, 
                attempts: 0 
            };
            currentSongId = songId;
            tiempoCambioCancion = ahora;
        }

        // SISTEMA INTELIGENTE DE EXTRACCIÓN Y REINTENTOS
        if (!lyricsState.isProcessed) { 
            if (ahora - tiempoCambioCancion > 1000) { 
                const rawLyrics = getLyricsFromPage();
                
                if (rawLyrics) {
                    lyricsState.text = rawLyrics;
                    lyricsState.isProcessed = true;
                    logDebug(`[Letras YT] Capturadas con éxito.`);
                } else {
                    lyricsState.attempts++;
                    if (lyricsState.attempts >= MAX_ATTEMPTS) {
                        lyricsState.text = chrome.i18n.getMessage("js_no_letras_disp"); 
                        lyricsState.isProcessed = true;
                    }
                }
            }
        }

        // ENVÍO DE RESPUESTA SÍNCRONA AL POPUP
        if (video) {
            sendResponse({
                title: songTitle,
                artist: songArtist,
                coverUrl: coverUrl,
                playing: !video.paused,
                currentTime: video.currentTime,
                totalTime: video.duration,
                percent: (video.currentTime / video.duration) * 100,
                volume: Math.sqrt(video.volume),
                isMuted: video.muted,
                lyrics: lyricsState.text,
                isLyricsProcessed: lyricsState.isProcessed
            });
        } else {
            sendResponse({ title: "Sin medios", artist: "", playing: false });
        }
        
        return false; 
    }

    // --- CONTROLES MULTIMEDIA ---
    if (request.command === "PLAY_PAUSE" && video) {
        video.paused ? video.play() : video.pause();
    }

    if (request.command === "NEXT") {
        document.querySelector('.next-button.ytmusic-player-bar')?.click();
    }

    if (request.command === "PREV") {
        document.querySelector('.previous-button.ytmusic-player-bar')?.click();
    }

    // --- SINCRONIZACIÓN DE VOLUMEN (LOGARÍTMICO) ---
    if (request.command === "SET_VOLUME" && video) {
        const volumenLineal = request.volumeValue / 100;
        video.volume = Math.pow(volumenLineal, 2);
        video.muted = (request.volumeValue === 0);

        const ytmSlider = document.querySelector('tp-yt-paper-slider#volume-slider');
        const ytmMuteBtn = document.querySelector('.volume.style-scope.ytmusic-player-bar');

        if (ytmSlider) {
            ytmSlider.setAttribute('value', request.volumeValue);
            ytmSlider.value = request.volumeValue;
            ytmSlider.dispatchEvent(new Event('change', { bubbles: true }));
            ytmSlider.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (ytmMuteBtn) {
            const estaMuteadoEnWeb = ytmMuteBtn.hasAttribute('aria-pressed') && ytmMuteBtn.getAttribute('aria-pressed') === 'true';
            
            if ((request.volumeValue === 0 && !estaMuteadoEnWeb) || (request.volumeValue > 0 && estaMuteadoEnWeb)) {
                ytmMuteBtn.click();
            }
        }
    }

    // --- SINCRONIZACIÓN DE BARRA DE PROGRESO ---
    if (request.command === "SEEK_TO" && request.percentage !== undefined && video && video.duration) {
        video.currentTime = (request.percentage * video.duration) / 100;
    }
});