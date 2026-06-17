//popup.js
/* === VARIABLES GLOBALES === */
let contextoPantalla = document; // Cambia dinámicamente entre 'document' de la extensión y el contexto del PiP
let ultimaCancionVista = "";
let letrasKaraokeActual = [];
let ultimaLineaActivaIdx = -1;
let modoLecturaActivo = false;
let alternativasLetras = [];
let indiceAlternativaActual = 0;
let tituloLimpioParaBusqueda = "";
let artistaLimpioParaBusqueda = "";
let buscandoEnProgreso = false;
let volumenPrevio = 100;

const SVG_VOL_ALTO = "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z";
const SVG_VOL_BAJO = "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z";
const SVG_VOL_MUTE = "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z";

const PRODUCCION = true; // Cambiar a true para producción, false para desarrollo
if (PRODUCCION) {
    console.log = function() {};
    console.info = function() {};
}

/* === UPDATE CHECKER === */
// Se consulta el almacenamiento local persistido por background.js. 
// Usamos sessionStorage para respetar la decisión del usuario si descarta el aviso temporalmente.
chrome.storage.local.get(["updateAvailable", "updateUrl"], (res) => {
    if (res.updateAvailable && res.updateUrl && !sessionStorage.getItem("bannerCerrado")) {
        const banner = document.getElementById("banner-actualizacion");
        const enlace = document.getElementById("enlace-actualizar");
        const botonCerrar = document.getElementById("cerrar-banner");
        
        if (banner && enlace) {
            enlace.href = res.updateUrl; 
            banner.style.display = "block"; 
            
            if (typeof traducirInterfaz === "function") {
                traducirInterfaz(banner);
            }
        }

        if (botonCerrar && banner) {
            botonCerrar.addEventListener("click", () => {
                banner.style.display = "none";
                sessionStorage.setItem("bannerCerrado", "true");
            });
        }
    }
});

/* === FORMATO DE TIEMPO === */
function formatTime(s) {
    if (isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

/* === PROCESAMIENTO DE METADATOS === */
/**
 * Normaliza y limpia las cadenas de texto del reproductor de YouTube Music.
 * Elimina carátulas sueltas, marcas de separación (•) y textos entre paréntesis/corchetes
 * para optimizar el porcentaje de aciertos en la API externa de LRCLIB.
 */
function descomponerMetadatos(tituloCrudo, artistaCrudo) {
    let tituloLimpio = tituloCrudo ? tituloCrudo.split("\n")[0].trim() : "";
    let artistaPrincipal = "";
    let subInfoFila = "";

    if (artistaCrudo) {
        const stringUnificado = artistaCrudo.replace(/\n/g, ' ').trim();
        const partes = stringUnificado.split(/\s*[\u2022\u00B7\u2027\u203A\u25CF\u25CB\u25A0\u25A1]\s*/);
        artistaPrincipal = partes[0] ? partes[0].trim() : "";
        
        if (partes.length > 1) {
            const detalles = partes.slice(1).map(p => p.trim()).filter(p => p !== "");
            subInfoFila = detalles.join(' • ');
        }
    }

    let tituloParaBusqueda = tituloLimpio;
    if (artistaPrincipal && tituloParaBusqueda.includes(artistaPrincipal)) {
        tituloParaBusqueda = tituloParaBusqueda.split(" - ")[0].trim();
    }
    tituloParaBusqueda = tituloParaBusqueda.replace(/\s*\(.*?\)\s*/g, "").replace(/\s*\[.*?\]\s*/g, "").trim();

    return { tituloLimpio, tituloParaBusqueda, artistaPrincipal, subInfoFila };
}

/* === PARSER DE LETRAS LRC === */
/**
 * Convierte un bloque de texto en formato nativo LRC timestamp a un array indexado de objetos.
 * Expresión regular encargada de capturar minutos, segundos y milisegundos.
 * @param {string} lrcText - Cadena cruda de texto tipo [01:23.45] Letra.
 * @returns {Array<{tiempo: number, texto: string}>} Array ordenado cronológicamente por segundos.
 */
function parsearLetrasLRC(lrcText) {
    if (!lrcText) return [];
    const lineas = lrcText.split("\n");
    const resultado = [];
    const regexTiempo = /\[(\d+):(\d+)(?:\.(\d+))?\]/;

    lineas.forEach((linea) => {
        const coincidencia = linea.match(regexTiempo);
        if (coincidencia) {
            const minutos = parseInt(coincidencia[1], 10);
            const segundos = parseInt(coincidencia[2], 10);
            const milisegundos = coincidencia[3] ? parseInt(coincidencia[3], 10) : 0;
            const tiempoTotalSegundos = minutos * 60 + segundos + (milisegundos / 100);
            const textoLetra = linea.replace(regexTiempo, "").trim();

            if (textoLetra) {
                resultado.push({ tiempo: tiempoTotalSegundos, texto: textoLetra });
            }
        }
    });
    return resultado.sort((a, b) => a.tiempo - b.tiempo);
}

/* === INYECTAR LETRAS EN EL DOM === */
function inyectarLetrasEnContenedor() {
    const contenedor = contextoPantalla.getElementById("lyrics-content");
    if (!contenedor) return;

    contenedor.innerHTML = "";
    
    if (!letrasKaraokeActual || letrasKaraokeActual.length === 0) {
        contenedor.innerText = chrome.i18n.getMessage("lyrics_buscando");
        const wrapperBotones = contextoPantalla.getElementById('wrapper-botones-flotantes');
        if (wrapperBotones) wrapperBotones.style.display = 'none';
        return;
    }

    if (alternativasLetras && alternativasLetras.length > 0) {
        const indicadorVersion = contextoPantalla.createElement("p");
        indicadorVersion.style.fontSize = '12px';
        indicadorVersion.style.color = 'rgba(255, 255, 255, 0.4)';
        indicadorVersion.style.marginBottom = '15px';
        indicadorVersion.style.fontStyle = 'italic';
        
        const idLetra = alternativasLetras[indiceAlternativaActual]?.id || "N/A";
        const versionActual = (indiceAlternativaActual + 1).toString();
        const totalVersiones = alternativasLetras.length.toString();
        indicadorVersion.innerText = chrome.i18n.getMessage("lyrics_version_indicador", [versionActual, totalVersiones, idLetra]);
        contenedor.appendChild(indicadorVersion);
    }

    letrasKaraokeActual.forEach((linea, index) => {
        const p = contextoPantalla.createElement("p");
        p.className = "linea-karaoke";
        p.id = `linea-${index}`;
        p.textContent = linea.texto;

        p.onclick = () => {
            console.log(`[AUDITORÍA] "${linea.texto}" -> Seg: ${linea.tiempo} (${formatTime(linea.tiempo)})`);
        };

        contenedor.appendChild(p);
    });

    const contenedorPadre = contextoPantalla.getElementById("lyrics-container");
    if (contenedorPadre) contenedorPadre.scrollTop = 0;
}

/* === PROGRESO DEL KARAOKE === */
/**
 * Controla el resaltado síncrono del karaoke.
 * Se utiliza requestAnimationFrame para delegar el cálculo del scroll 3D/Smooth a los ciclos
 * libres del procesador, reduciendo el lag al renderizar fuentes pesadas en ventanas PiP.
 * @param {number} segundosActuales - Transcurso de tiempo del reproductor inyectado.
 */
function actualizarProgresoKaraoke(segundosActuales) {
    if (modoLecturaActivo || !letrasKaraokeActual || letrasKaraokeActual.length === 0) return;

    let lineaActivaIdx = -1;
    for (let i = 0; i < letrasKaraokeActual.length; i++) {
        if (segundosActuales >= letrasKaraokeActual[i].tiempo) {
            lineaActivaIdx = i;
        } else {
            break; 
        }
    }

    if (lineaActivaIdx !== -1 && lineaActivaIdx !== ultimaLineaActivaIdx) {
        const lineaAnterior = contextoPantalla.querySelector(".linea-karaoke.activa");
        if (lineaAnterior) lineaAnterior.classList.remove("activa");

        const lineaNueva = contextoPantalla.getElementById(`linea-${lineaActivaIdx}`);
        const contenedorPadre = contextoPantalla.getElementById("lyrics-container");

        if (lineaNueva && contenedorPadre) {
            lineaNueva.classList.add("activa");
            
            requestAnimationFrame(() => {
                const scrollDestino = lineaNueva.offsetTop + (lineaNueva.offsetHeight / 2) - (contenedorPadre.clientHeight / 2);
                contenedorPadre.scrollTo({ top: Math.max(0, scrollDestino), behavior: "smooth" });
            });
        }
        ultimaLineaActivaIdx = lineaActivaIdx;
    }
}

/* === BÚSQUEDA LRCLIB === */
/**
 * Consulta asíncrona principal contra el servidor LRCLIB.
 * Implementa una estrategia de fallback reactiva: si la búsqueda con duración exacta falla (404),
 * reintenta la consulta omitiendo los segundos exactos antes de dar por perdida la canción.
 */
async function buscarLetraLRCLIB(tituloBusqueda, artistabusqueda, duracionSegundos) {
    if (!tituloBusqueda || !artistabusqueda) return null;
    buscandoEnProgreso = true;

    const btnLectura = contextoPantalla.getElementById('toggle-modo-lectura');
    if (btnLectura) btnLectura.classList.add('cargando-animacion');

    const cancionAlIniciarPeticion = ultimaCancionVista;
    console.log(`[LRCLIB] PETICIÓN -> Título: "${tituloBusqueda}" | Artista: "${artistabusqueda}"`);

    const durationParam = duracionSegundos ? `&duration=${Math.round(duracionSegundos)}` : '';
    let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(tituloBusqueda)}&artist_name=${encodeURIComponent(artistabusqueda)}${durationParam}`;

    console.log(`[LRCLIB] URL CONSULTADA PRINCIPAL: ${url}`);

    try {
        let respuesta = await fetch(url);
        
        if (!respuesta.ok && respuesta.status === 404 && durationParam !== '') {
            // Guardrail de carrera asíncrona: detiene el hilo si el usuario saltó de pista durante la petición.
            if (cancionAlIniciarPeticion !== ultimaCancionVista) {
                if (btnLectura) btnLectura.classList.remove('cargando-animacion');
                console.warn(`[LRCLIB] Petición de respaldo abortada. El usuario pasó de canción.`);
                return null;
            }
            console.log("[LRCLIB] 404 con duración exacta. Intentando búsqueda de respaldo sin duración...");
            url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(tituloBusqueda)}&artist_name=${encodeURIComponent(artistabusqueda)}`;
            respuesta = await fetch(url);
        }

        if (!respuesta.ok) throw new Error(`Error en servidor: ${respuesta.status}`);
        const cancion = await respuesta.json();

        if (btnLectura) btnLectura.classList.remove('cargando-animacion');

        if (cancionAlIniciarPeticion !== ultimaCancionVista || !cancion) {
            letrasKaraokeActual = [];
            ultimaLineaActivaIdx = -1;
            buscandoEnProgreso = false;
            console.warn(`[LRCLIB] Datos descartados por cambio de canción -> Título: "${tituloBusqueda}" | Artista: "${artistabusqueda}"`);
            return null;
        }

        if (cancion.syncedLyrics) {
            console.log("[LRCLIB] ¡Letras sincronizadas asignadas con éxito!");
            letrasKaraokeActual = parsearLetrasLRC(cancion.syncedLyrics);
            ultimaLineaActivaIdx = -1;
            inyectarLetrasEnContenedor();
            configurarEventoBotonLectura();
            buscandoEnProgreso = false;
            return { tipo: "synced", letras: letrasKaraokeActual };
        } else {
            console.log("[LRCLIB] Letra plana en API. Volviendo al respaldo estático.");
            letrasKaraokeActual = [];
            ultimaLineaActivaIdx = -1;
            buscandoEnProgreso = false;
            return null;
        }
    } catch (error) {
        console.error("[LRCLIB] Fallo de conexión o lectura:", error);
        if (btnLectura) btnLectura.classList.remove('cargando-animacion');
        if (cancionAlIniciarPeticion === ultimaCancionVista) {
            letrasKaraokeActual = [];
            ultimaLineaActivaIdx = -1;
            buscandoEnProgreso = false;
        }
        return null;
    }
}

/* === LETRAS ALTERNATIVAS === */
async function ciclarLetrasAlternativas(titulo, artista) {
    const contenedor = contextoPantalla.getElementById("lyrics-content");
    if (!contenedor || !titulo || !artista) return;

    const letrasRespaldo = [...letrasKaraokeActual];

    if (!alternativasLetras || alternativasLetras.length === 0) {
        contenedor.innerText = chrome.i18n.getMessage("title_sync_alt");
        const urlSearch = `https://lrclib.net/api/search?track_name=${encodeURIComponent(titulo)}&artist_name=${encodeURIComponent(artista)}`;

        try {
            const respuesta = await fetch(urlSearch);
            if (!respuesta.ok) throw new Error("Fallo de red");
            
            const resultados = await respuesta.json();
            alternativasLetras = resultados.filter(item => item.syncedLyrics && item.syncedLyrics.trim() !== "");
            indiceAlternativaActual = 0;

            if (alternativasLetras.length <= 1) {
                contenedor.innerText = chrome.i18n.getMessage("js_no_versiones");
                setTimeout(() => { letrasKaraokeActual = letrasRespaldo; inyectarLetrasEnContenedor(); }, 1500);
                return;
            }
        } catch (error) {
            console.error("[Alternativas] Error:", error);
            contenedor.innerText = chrome.i18n.getMessage("js_error_servidor");
            setTimeout(() => { letrasKaraokeActual = letrasRespaldo; inyectarLetrasEnContenedor(); }, 1500);
            return;
        }
    }

    if (alternativasLetras && alternativasLetras.length > 0) {
        indiceAlternativaActual = (indiceAlternativaActual + 1) % alternativasLetras.length;
        const alternativaSeleccionada = alternativasLetras[indiceAlternativaActual];

        if (alternativaSeleccionada && alternativaSeleccionada.syncedLyrics) {
            console.log(`[Alternativas] Saltando a opción #${indiceAlternativaActual + 1} (ID: ${alternativaSeleccionada.id})`);
            letrasKaraokeActual = parsearLetrasLRC(alternativaSeleccionada.syncedLyrics);
            ultimaLineaActivaIdx = -1;
            inyectarLetrasEnContenedor();
        } else {
            letrasKaraokeActual = letrasRespaldo;
            inyectarLetrasEnContenedor();
        }
    }
}

/* === APARIENCIA DEL VOLUMEN === */
function actualizarAparienciaVolumen(valor) {
    const slider = contextoPantalla.getElementById('volume-slider');
    const path = contextoPantalla.getElementById('volume-path');
    if (!slider || !path) return;

    const porcentajeRelleno = 100 - valor;
    slider.style.background = `linear-gradient(to bottom, rgba(255,255,255,0.2) ${porcentajeRelleno}%, #ff0000 ${porcentajeRelleno}%)`;

    if (valor === 0) path.setAttribute('d', SVG_VOL_MUTE);
    else if (valor <= 50) path.setAttribute('d', SVG_VOL_BAJO);
    else path.setAttribute('d', SVG_VOL_ALTO);
}

/* === NÚCLEO CENTRAL DE LA APP (UPDATE UI) === */
function updateUI() {
    chrome.tabs.query({ url: "*://music.youtube.com/*" }, (tabs) => {
        const elementoAviso = contextoPantalla.getElementById('aviso-no-tab');
        const elementoApp = contextoPantalla.getElementById('main-app');

        if (!tabs[0]) {
            if (window.documentPictureInPicture && window.documentPictureInPicture.window) {
                window.documentPictureInPicture.window.close();
            }

            document.body.classList.remove('pip-activo');
            const avisoHibrido = document.getElementById('aviso-pip-hibrido');
            if (avisoHibrido) avisoHibrido.remove();

            contextoPantalla = document;
            if (elementoApp) {
                elementoApp.classList.remove('modo-mini-activo');
                elementoApp.style.display = 'none';
            }

            isMini = false; 
            const btnMini = document.getElementById('mini-mode');
            if (btnMini) btnMini.classList.remove('activo');
            
            const infoDiv = document.getElementById('info');
            if (infoDiv) infoDiv.style.display = 'flex';
            
            const miniInfo = document.getElementById('mini-info-container');
            if (miniInfo) miniInfo.style.display = 'none';
            chrome.windows.getCurrent((win) => {
                chrome.windows.update(win.id, { width: 260, height: 385 });
            });

            if (elementoAviso) elementoAviso.style.display = 'flex';
            return;
        }

        if (elementoAviso) elementoAviso.style.display = 'none';
        if (elementoApp) elementoApp.style.display = 'flex';

        const containerLyrics = contextoPantalla.getElementById('lyrics-container');
        const ventanaOrigen = containerLyrics ? (containerLyrics.ownerDocument.defaultView || window) : window;
        const lyricsVisible = containerLyrics ? (ventanaOrigen.getComputedStyle(containerLyrics).display !== 'none') : true;
        const necesitaClic = lyricsVisible && !window.ultimaRespuestaLyrics;

        chrome.tabs.sendMessage(tabs[0].id, { 
            command: "GET_INFO", 
            shouldClickLyrics: necesitaClic 
        }, (response) => {
            if (chrome.runtime.lastError || !response) return;

            const wrapperBotones = contextoPantalla.getElementById('wrapper-botones-flotantes');
            const btnSyncAlt = contextoPantalla.getElementById('sync-lyrics-alt');
            const btnLectura = contextoPantalla.getElementById('toggle-modo-lectura');
            const lyricsDiv = contextoPantalla.getElementById('lyrics-content');
            const txtBuscando = chrome.i18n.getMessage("lyrics_buscando");
            
            if (response.lyrics && response.lyrics !== txtBuscando) {
                buscandoEnProgreso = false; 
                window.ultimaRespuestaLyrics = response.lyrics; 
            }

            const slider = contextoPantalla.getElementById('volume-slider');
            if (slider && response.volume !== undefined && document.activeElement !== slider) {
                const volYTM = Math.round(response.volume * 100);
                slider.value = volYTM;
                actualizarAparienciaVolumen(response.isMuted ? 0 : volYTM);
            }

            const btnPlayPause = contextoPantalla.getElementById('playPause');
            if (btnPlayPause) {
                const iconPlay = btnPlayPause.querySelector('.icon-play');
                const iconPause = btnPlayPause.querySelector('.icon-pause');
                if (iconPlay) iconPlay.style.display = response.playing ? 'none' : 'block';
                if (iconPause) iconPause.style.display = response.playing ? 'block' : 'none';
            }

            const datosCancion = descomponerMetadatos(response.title, response.artist);

            if (datosCancion.tituloLimpio !== ultimaCancionVista) {
                ultimaCancionVista = datosCancion.tituloLimpio;
                letrasKaraokeActual = []; 
                ultimaLineaActivaIdx = -1;
                modoLecturaActivo = false; 
                window.ultimaRespuestaLyrics = ""; 

                alternativasLetras = [];
                indiceAlternativaActual = 0;
                tituloLimpioParaBusqueda = datosCancion.tituloParaBusqueda;
                artistaLimpioParaBusqueda = datosCancion.artistaPrincipal;

                if (btnLectura) {
                    btnLectura.classList.add('activo'); 
                    const iconMic = btnLectura.querySelector('.icon-mic');
                    const iconMicOff = btnLectura.querySelector('.icon-mic-off');
                    if (iconMic) iconMic.style.display = 'block';
                    if (iconMicOff) iconMicOff.style.display = 'none';
                }

                if (btnSyncAlt) btnSyncAlt.disabled = true;
                buscandoEnProgreso = true; 
                if (lyricsDiv) lyricsDiv.innerText = chrome.i18n.getMessage("lyrics_buscando");
                window.esperandoDuracionParaApi = true;
            }

            if (window.esperandoDuracionParaApi && tituloLimpioParaBusqueda && artistaLimpioParaBusqueda && response.totalTime > 0) {
                window.esperandoDuracionParaApi = false;
                console.log(`[LRCLIB] Datos listos con duración verificada (${response.totalTime}s). Solicitando API...`); 
                buscarLetraLRCLIB(tituloLimpioParaBusqueda, artistaLimpioParaBusqueda, response.totalTime);
            }

            const elemTitle = contextoPantalla.getElementById('title');
            const elemArtist = contextoPantalla.getElementById('artist');
            const elemMTitle = contextoPantalla.getElementById('m-title');
            const elemMArtist = contextoPantalla.getElementById('m-artist');

            if (elemTitle) elemTitle.innerText = datosCancion.tituloLimpio;
            if (elemArtist) {
                elemArtist.innerHTML = datosCancion.subInfoFila ? 
                    `${datosCancion.artistaPrincipal}<br><span class="album-info">${datosCancion.subInfoFila}</span>` : 
                    datosCancion.artistaPrincipal;
            }
            if (elemMTitle) elemMTitle.innerText = datosCancion.tituloLimpio;
            if (elemMArtist) {
                const textoCompletoMini = datosCancion.subInfoFila ? `${datosCancion.artistaPrincipal} • ${datosCancion.subInfoFila}` : datosCancion.artistaPrincipal;
                elemMArtist.innerText = " - " + textoCompletoMini;
            }

            if (response.coverUrl && elementoApp) {
                elementoApp.style.backgroundImage = `url(${response.coverUrl})`;
            }

            if (!isDragging) {
                const elemCurrent = contextoPantalla.getElementById('current-time');
                const elemTotal = contextoPantalla.getElementById('total-time');
                const elemBarFill = contextoPantalla.getElementById('progress-bar-fill'); 

                if (elemCurrent) elemCurrent.innerText = formatTime(response.currentTime);
                if (elemTotal) elemTotal.innerText = formatTime(response.totalTime);
                if (elemBarFill) elemBarFill.style.width = (response.percent || 0) + "%";
                
                if (letrasKaraokeActual && letrasKaraokeActual.length > 0 && response.currentTime !== undefined) {
                    actualizarProgresoKaraoke(response.currentTime);
                }
            }

            if (lyricsVisible) {
                const tieneKaraoke = letrasKaraokeActual && letrasKaraokeActual.length > 0;
                const tieneTextoPlano = window.ultimaRespuestaLyrics && window.ultimaRespuestaLyrics.trim() !== "";
                const hayContenido = tieneKaraoke || tieneTextoPlano;
                
                if (wrapperBotones) wrapperBotones.style.display = hayContenido ? 'flex' : 'none';
                if (btnLectura) btnLectura.style.display = hayContenido ? 'block' : 'none';

                if (btnSyncAlt) {
                    btnSyncAlt.style.display = 'block'; 
                    btnSyncAlt.disabled = !tieneKaraoke;
                }

                if (lyricsDiv) {
                    if (modoLecturaActivo) {
                         if (lyricsDiv.innerText !== window.ultimaRespuestaLyrics) {
                             lyricsDiv.innerText = window.ultimaRespuestaLyrics || chrome.i18n.getMessage("js_sin_letra_disp");
                         }
                    } else if (!tieneKaraoke && tieneTextoPlano) {
                        if (lyricsDiv.innerText !== window.ultimaRespuestaLyrics) {
                            lyricsDiv.innerText = window.ultimaRespuestaLyrics;
                            lyricsDiv.style.whiteSpace = "pre-wrap";
                        }
                    } else if (!tieneKaraoke && !tieneTextoPlano) {
                        if (buscandoEnProgreso) {
                            if (!lyricsDiv.innerText.startsWith(txtBuscando.replace('...', ''))) {
                                lyricsDiv.innerText = txtBuscando;
                            }
                        } else if (ultimaCancionVista !== "") {
                            if (lyricsDiv.innerText !== chrome.i18n.getMessage("js_no_letras_disp")) {
                                lyricsDiv.innerText = chrome.i18n.getMessage("js_no_letras_disp");
                            }
                        }
                    }
                }
            } else {
                if (wrapperBotones) wrapperBotones.style.display = 'none';
            }
        });
    });
}

/* === EVENTOS: CONTROLES DE REPRODUCCIÓN Y VOLUMEN === */
const sendControl = (cmd) => {
    chrome.tabs.query({ url: "*://music.youtube.com/*" }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { command: cmd });
    });
};

contextoPantalla.getElementById('playPause')?.addEventListener('click', () => sendControl('PLAY_PAUSE'));
contextoPantalla.getElementById('next')?.addEventListener('click', () => sendControl('NEXT'));
contextoPantalla.getElementById('prev')?.addEventListener('click', () => sendControl('PREV'));

contextoPantalla.getElementById('volume-slider')?.addEventListener('input', (e) => {
    const vol = parseInt(e.target.value, 10);
    actualizarAparienciaVolumen(vol);
    chrome.tabs.query({ url: "*://music.youtube.com/*" }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { command: "SET_VOLUME", volumeValue: vol });
    });
});

contextoPantalla.getElementById('btn-icono-volumen')?.addEventListener('click', () => {
    const slider = contextoPantalla.getElementById('volume-slider');
    if (!slider) return;

    const volActual = parseInt(slider.value, 10);
    const nuevoVol = volActual > 0 ? 0 : (volumenPrevio > 0 ? volumenPrevio : 50);
    if (volActual > 0) volumenPrevio = volActual;

    slider.value = nuevoVol;
    actualizarAparienciaVolumen(nuevoVol);

    chrome.tabs.query({ url: "*://music.youtube.com/*" }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { command: "SET_VOLUME", volumeValue: nuevoVol });
    });
});

/* === EVENTOS: VISIBILIDAD DE LETRAS === */
contextoPantalla.getElementById('toggle-lyrics')?.addEventListener('click', () => {
    const container = contextoPantalla.getElementById('lyrics-container');
    const title = contextoPantalla.getElementById('title');
    const btn = contextoPantalla.getElementById('toggle-lyrics');
    const btnLectura = contextoPantalla.getElementById('toggle-modo-lectura');
    const capaBoton = contextoPantalla.querySelector('.capa-flotante-boton');

    const isClosed = (window.getComputedStyle(container).display === 'none');

    container.style.display = isClosed ? 'block' : 'none';
    if (capaBoton) capaBoton.style.display = isClosed ? 'block' : 'none';
    title.style.fontSize = isClosed ? "1em" : "1.2em"; 
    
    if (isClosed) {
        btn.classList.add('activo');
    } else {
        btn.classList.remove('activo');
        if (btnLectura) btnLectura.style.display = 'none'; 
    }
});

/* === FUNCIÓN: CONFIGURACIÓN BOTÓN LECTURA === */
function configurarEventoBotonLectura() {
    const btnLectura = contextoPantalla.getElementById('toggle-modo-lectura');
    const lyricsDiv = contextoPantalla.getElementById('lyrics-content');
    
    if (!btnLectura) return;

    btnLectura.onclick = () => {
        modoLecturaActivo = !modoLecturaActivo;
        
        const iconMic = btnLectura.querySelector('.icon-mic');
        const iconMicOff = btnLectura.querySelector('.icon-mic-off');
        
        if (iconMic) iconMic.style.display = modoLecturaActivo ? 'none' : 'block';
        if (iconMicOff) iconMicOff.style.display = modoLecturaActivo ? 'block' : 'none';

        if (modoLecturaActivo) {
            lyricsDiv.innerHTML = ""; 
            if (window.ultimaRespuestaLyrics) {
                lyricsDiv.innerText = window.ultimaRespuestaLyrics;
                lyricsDiv.style.textAlign = "center";
                lyricsDiv.style.whiteSpace = "pre-wrap"; 
            } else {
                lyricsDiv.innerText = chrome.i18n.getMessage("js_sin_letras_yt");
            }
        } else {
            lyricsDiv.style.whiteSpace = "normal"; 
            lyricsDiv.innerHTML = ""; 
            inyectarLetrasEnContenedor();
        }
    };
}

/* === EVENTOS: MODO MINI === */
let isMini = false;
let lyricsWereOpen = false; 

contextoPantalla.getElementById('mini-mode')?.addEventListener('click', () => {
    const mainAppContainer = contextoPantalla.getElementById('main-app');
    const lyricsContainer = contextoPantalla.getElementById('lyrics-container');
    const lyricsBtn = contextoPantalla.getElementById('toggle-lyrics');
    const btnMini = contextoPantalla.getElementById('mini-mode');
    const infoDiv = contextoPantalla.getElementById('info');
    const miniInfo = contextoPantalla.getElementById('mini-info-container');
    const btnLectura = contextoPantalla.getElementById('toggle-modo-lectura');
    const enPiP = (contextoPantalla !== document);

    if (!isMini) {
        lyricsWereOpen = (lyricsContainer.style.display === 'block');
        mainAppContainer.classList.add('modo-mini-activo');

        lyricsContainer.style.display = 'none';
        infoDiv.style.display = 'none';
        miniInfo.style.display = 'block'; 
        if (btnLectura) btnLectura.style.display = 'none';
        
        btnMini.classList.add('activo'); 
        lyricsBtn.classList.remove('activo');
        lyricsBtn.style.pointerEvents = 'none';

        if (enPiP && pipWindow) {
            pipWindow.resizeTo(264, 195);
        } else {
            chrome.windows.getCurrent((win) => {
                chrome.windows.update(win.id, { width: 264, height: 195 });
            });
        }
        isMini = true;
    } else {
        mainAppContainer.classList.remove('modo-mini-activo');

        if (mainAppContainer) {
            mainAppContainer.style.width = '';
            mainAppContainer.style.height = '';
        }

        infoDiv.style.display = 'flex';
        miniInfo.style.display = 'none'; 
        btnMini.classList.remove('activo');

        if (lyricsWereOpen) {
            lyricsContainer.style.display = 'block';
            lyricsBtn.classList.add('activo');
        }
        lyricsBtn.style.pointerEvents = 'auto';

        if (enPiP && pipWindow) {
            pipWindow.resizeTo(260, 385);
        } else {
            chrome.windows.getCurrent((win) => {
                chrome.windows.update(win.id, { width: 260, height: 385 });
            });
        }
        isMini = false;
    }
    
    // Sincronización de seguridad
    if (typeof updateUI === 'function') updateUI();
});

/* === EVENTOS: BARRA DE PROGRESO === */
const progressBarBg = contextoPantalla.getElementById('progress-bar-bg');
const progressContainer = contextoPantalla.getElementById('progress-container');
const tooltip = contextoPantalla.getElementById('progress-tooltip');
let isDragging = false;

function handleSeek(e) {
    if (!progressBarBg) return;
    const rect = progressBarBg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    contextoPantalla.getElementById('progress-bar-fill').style.width = percentage + "%";

    chrome.tabs.query({ url: "*://music.youtube.com/*" }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { command: "SEEK_TO", percentage: percentage });
    });
}

if (progressBarBg) {
    progressBarBg.onmousedown = (e) => {
        isDragging = true;
        if (progressContainer) progressContainer.classList.add('dragging'); 
        handleSeek(e);
    };

    progressBarBg.onmousemove = (e) => {
        const rect = progressBarBg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        
        if (tooltip) tooltip.style.left = x + "px";

        chrome.tabs.query({ url: "*://music.youtube.com/*" }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { command: "GET_INFO" }, (response) => {
                    if (response && response.totalTime && tooltip) {
                        const estimatedTime = (percentage * response.totalTime) / 100;
                        tooltip.innerText = formatTime(estimatedTime);
                    }
                });
            }
        });

        if (isDragging) handleSeek(e);
    };
}

const registrarMovimientoGlobal = (vistaVentana) => {
    vistaVentana.addEventListener('mousemove', (e) => {
        if (isDragging && progressBarBg && tooltip) {
            handleSeek(e);
            const rect = progressBarBg.getBoundingClientRect();
            const x = e.clientX - rect.left;
            tooltip.style.left = Math.max(0, Math.min(rect.width, x)) + "px";
        }
    });
};
registrarMovimientoGlobal(window);

contextoPantalla.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        if (progressContainer) progressContainer.classList.remove('dragging');
        setTimeout(() => { if (!isDragging) updateUI(); }, 500); 
    }
});

/* === EVENTOS: MODO PIP === */
/**
 * Motor de renderizado y control del modo Picture-in-Picture (Document PiP API).
 * Clona dinámicamente hojas de estilo y teletransporta el nodo DOM '#main-app'
 * hacia el árbol de la ventana flotante, remapeando la variable reactiva 'contextoPantalla'.
 */
let pipWindow = null;
const btnPip = document.getElementById('pip-btn');
if (btnPip) {
    btnPip.onclick = async () => {
        if (!('documentPictureInPicture' in window)) {
            if (document.getElementById('alerta-temporal-pip')) return;

            const bannerError = document.createElement('div');
            bannerError.id = 'alerta-temporal-pip';
            bannerError.style.cssText = `
                position: absolute;
                top: 10px;
                left: 10px;
                right: 10px;
                background: #2a1f3d;
                border: 1px solid #7952b3;
                color: #e2d9f3;
                padding: 10px;
                border-radius: 6px;
                font-size: 12px;
                text-align: center;
                z-index: 9999;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                animation: fadeIn 0.2s ease;
            `;

            bannerError.innerText = chrome.i18n.getMessage("js_alert_no_pip");

            document.body.appendChild(bannerError);

            setTimeout(() => {
                bannerError.style.transition = "opacity 0.3s ease";
                bannerError.style.opacity = "0";
                setTimeout(() => bannerError.remove(), 300);
            }, 4000);

            return;
        }

        if (pipWindow) {
            pipWindow.close();
            return;
        }

        const mainApp = document.getElementById('main-app');

        try {
            const anchoApertura = isMini ? 264 : 250;
            const altoApertura = isMini ? 195 : 350;

            pipWindow = await window.documentPictureInPicture.requestWindow({ width: anchoApertura, height: altoApertura });
            btnPip.classList.add('activo');

            pipWindow.document.head.innerHTML = "";
            pipWindow.document.body.innerHTML = "";

            const styleFix = pipWindow.document.createElement('style');
            styleFix.textContent = `
                :root { background: #000 !important; }
                html, body { width: 100vw !important; height: 100vh !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background-color: #030303 !important; display: flex !important; justify-content: center !important; align-items: flex-start !important; }
                #main-app { width: 100% !important; height: 100% !important; display: flex !important; flex-direction: column !important; align-items: center !important; margin: 0 !important; }
                .overlay { width: 100% !important; height: 100% !important; display: flex !important; flex-direction: column !important; align-items: center !important; padding: 15px !important; box-sizing: border-box !important; position: relative !important; }
                #info, #progress-container, .controls { width: 220px !important; min-width: 220px !important; flex-shrink: 0 !important; }
                #main-app.modo-mini-activo, #main-app.modo-mini-activo .overlay { height: auto !important; min-height: 100vh !important; justify-content: center !important; width: 100vw !important; background-size: cover !important; background-position: center !important; }
                #main-app.modo-mini-activo #mini-info-container { display: block !important; height: 30px !important; min-height: 30px !important; width: 220px !important; flex-shrink: 0 !important; }
                .linea-karaoke { font-size: 14px !important; color: rgba(255, 255, 255, 0.35) !important; margin: 14px 0 !important; transition: color 0.25s ease, font-size 0.25s ease, transform 0.25s ease !important; text-align: center !important; transform-origin: center center; will-change: transform, color; padding: 0 25px; box-sizing: border-box; backface-visibility: hidden; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
                .linea-karaoke.activa { color: #ffffff !important; font-weight: bold !important; transform: scale(1.12) !important; text-shadow: 0 0 8px rgba(255, 255, 255, 0.4) !important; }
                .controls button { background: none !important; border: none !important; color: #ffffff !important; opacity: 0.5 !important; }
                .controls button.activo { opacity: 1 !important; filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.6)) !important; }
                .controls button:hover { opacity: 0.65 !important; }
                #toggle-modo-lectura { cursor: pointer !important; background: none !important; border: none !important; padding: 0px; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s, transform 0.1s, filter 0.2s; color: #ffffff !important; opacity: 0.35; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4)); }
                #toggle-modo-lectura:hover { transform: scale(1.15); opacity: 0.75; }
                #toggle-modo-lectura.activo { opacity: 1 !important; transform: scale(1.1); filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.6)) drop-shadow(0 2px 4px rgba(0,0,0,0.6)) !important; }
                .icon-mic, .icon-mic-off { transition: transform 0.2s ease !important; }
            `;
            pipWindow.document.head.appendChild(styleFix);

            [...document.styleSheets].forEach((styleSheet) => {
                try {
                    if (styleSheet.cssRules) {
                        const rules = [...styleSheet.cssRules].map(r => r.cssText).join('');
                        const s = pipWindow.document.createElement('style');
                        s.textContent = rules;
                        pipWindow.document.head.appendChild(s);
                    }
                } catch (e) {}
            });

            mainApp.style.display = 'none';

            if (!isMini) {
                mainApp.classList.remove('modo-mini-activo');
                mainApp.style.width = '';
                mainApp.style.height = '';

                const overlay = mainApp.querySelector('.overlay');
                if (overlay) {
                    overlay.style.width = '';
                    overlay.style.height = '';
                }
            } else {
                mainApp.classList.add('modo-mini-activo');
            }
            
            pipWindow.document.body.append(mainApp);
            mainApp.style.display = 'flex';

            // Redirección crucial de contexto: Los selectores ahora buscarán dentro del documento flotante.
            contextoPantalla = pipWindow.document;

            // Chrome guarda en caché el tamaño del PiP anterior e ignora el requestWindow.
            // resizeTo bloqueado si no es por acción directa del usuario. 
            // Se implementa respuesta de fallback: Forzamos la adaptación de la UI si la ventana física no coincide con el modo esperado.
            setTimeout(() => {
                if (!pipWindow) return;
                const alturaReal = pipWindow.innerHeight;
                const pInfo = contextoPantalla.getElementById('info');
                const pMiniInfo = contextoPantalla.getElementById('mini-info-container');
                const pLyrics = contextoPantalla.getElementById('lyrics-container');
                const pBtnMini = contextoPantalla.getElementById('mini-mode');
                const pBtnLectura = contextoPantalla.getElementById('toggle-modo-lectura');
                const pLyricsBtn = contextoPantalla.getElementById('toggle-lyrics');
                
                if (!isMini && alturaReal > 0 && alturaReal <= 250) {
                    isMini = true;
                    mainApp.classList.add('modo-mini-activo');
                    
                    if (pLyrics) pLyrics.style.display = 'none';
                    if (pInfo) pInfo.style.display = 'none';
                    if (pMiniInfo) pMiniInfo.style.display = 'block';
                    if (pBtnLectura) pBtnLectura.style.display = 'none';
                    
                    if (pBtnMini) pBtnMini.classList.add('activo');
                    if (pLyricsBtn) {
                        pLyricsBtn.classList.remove('activo');
                        pLyricsBtn.style.pointerEvents = 'none';
                    }
                    
                    if (typeof updateUI === 'function') updateUI();
                } 
                else if (isMini && alturaReal >= 300) {
                    isMini = false;
                    mainApp.classList.remove('modo-mini-activo');
                    
                    if (pInfo) pInfo.style.display = 'flex';
                    if (pMiniInfo) pMiniInfo.style.display = 'none';
                    if (pBtnMini) pBtnMini.classList.remove('activo');
                    
                    if (pLyricsBtn) pLyricsBtn.style.pointerEvents = 'auto';
                    if (typeof lyricsWereOpen !== 'undefined' && lyricsWereOpen && pLyrics) {
                        pLyrics.style.display = 'block';
                        if (pLyricsBtn) pLyricsBtn.classList.add('activo');
                    }
                    
                    if (typeof updateUI === 'function') updateUI();
                }
            }, 50);

            const pipBtnInFloatingWindow = contextoPantalla.getElementById('pip-btn');
            if (pipBtnInFloatingWindow) pipBtnInFloatingWindow.classList.add('activo');

            traducirInterfaz(pipWindow.document);
            configurarEventoBotonLectura();
            updateUI();

            document.body.classList.add('pip-activo');
            
            const avisoPip = document.createElement('div');
            avisoPip.id = 'aviso-pip-hibrido';
            avisoPip.innerHTML = `<p>${chrome.i18n.getMessage("js_pip_aviso_linea1")}</p><p>${chrome.i18n.getMessage("js_pip_aviso_linea2")}</p>`;
            document.body.append(avisoPip);

            chrome.windows.getCurrent((win) => chrome.windows.update(win.id, { width: 262, height: 146 }));

            const retornarPipLink = document.getElementById('retornar-pip-link');
            if(retornarPipLink) retornarPipLink.onclick = () => { if (pipWindow) pipWindow.close(); };

            pipWindow.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    const pContainer = pipWindow.document.getElementById('progress-container');
                    if (pContainer) pContainer.classList.remove('dragging');
                    setTimeout(() => { if (!isDragging) updateUI(); }, 500);
                }
            });
            registrarMovimientoGlobal(pipWindow);

            pipWindow.addEventListener("pagehide", (event) => {
                const container = event.target.querySelector("#main-app");
                if (container) document.body.append(container);
                
                document.body.classList.remove('pip-activo');
                const aviso = document.getElementById('aviso-pip-hibrido');
                if (aviso) aviso.remove();
                
                chrome.windows.getCurrent((win) => { 
                    chrome.windows.update(win.id, { width: isMini ? 264 : 260, height: isMini ? 195 : 385 }); 
                });
                
                const originalBtnPip = document.getElementById('pip-btn');
                if (originalBtnPip) originalBtnPip.classList.remove('activo');

                contextoPantalla = document;
                pipWindow = null;
                configurarEventoBotonLectura();
                updateUI();
            });

        } catch (err) { console.error("Error PiP:", err); }
    };
}

/* === INICIALIZACIÓN Y EVENTOS GENERALES === */
setInterval(updateUI, 500);

document.getElementById('btn-abrir-ytmusic')?.addEventListener('click', () => chrome.tabs.create({ url: "https://music.youtube.com/" }));

contextoPantalla.getElementById('sync-lyrics-alt')?.addEventListener('click', () => {
    if (tituloLimpioParaBusqueda && artistaLimpioParaBusqueda) {
        ciclarLetrasAlternativas(tituloLimpioParaBusqueda, artistaLimpioParaBusqueda);
    }
});

/* === FUNCIÓN: LAYOUT ELÁSTICO === */
function ajustarPantallaElastica() {
    if (contextoPantalla.body.classList.contains('pip-activo') || contextoPantalla.body.classList.contains('mini-mode')) return; 

    const appContainer = contextoPantalla.getElementById('main-app');
    if (appContainer) {
        appContainer.style.width = `${window.innerWidth}px`;
        appContainer.style.height = `${window.innerHeight}px`;
    }

    const letrasContainer = contextoPantalla.getElementById('lyrics-container'); 
    if (letrasContainer) letrasContainer.style.width = '100%';
}

window.addEventListener('resize', ajustarPantallaElastica);
document.addEventListener('DOMContentLoaded', () => {
    ajustarPantallaElastica();
    traducirInterfaz(document); 
});
ajustarPantallaElastica();

/* === SISTEMA INTERNACIONALIZACIÓN (i18n) === */
/**
 * Motor central de internacionalización para la interfaz.
 * Escanea el árbol del DOM en busca de los selectores 'data-i18n' y 'data-i18n-title'
 * e inyecta dinámicamente las cadenas del idioma activo del usuario.
 * @param {HTMLElement|Document} [documentoObjetivo=document] - Se recibe como parámetro 
 * para poder traducir secciones específicas (como el PiP o el banner de updates) sin requerir un recargo completo.
 */
function traducirInterfaz(documentoObjetivo = document) {
    documentoObjetivo.querySelectorAll('[data-i18n]').forEach(elem => {
        const mensaje = chrome.i18n.getMessage(elem.getAttribute('data-i18n'));
        if (mensaje) elem.innerText = mensaje;
    });

    documentoObjetivo.querySelectorAll('[data-i18n-title]').forEach(elem => {
        const mensaje = chrome.i18n.getMessage(elem.getAttribute('data-i18n-title'));
        if (mensaje) elem.setAttribute('title', mensaje);
    });
}