# Validacion Final

Ejecutada el 2026-10-11 en Windows, Node 24.19.0, TypeScript 5.9.3, Vite 7.3.7, Playwright 1.64.0 y Chromium headless con SwiftShader. El checkout actual es `dev`; HEAD y `dev` son `a0277fb37919f9c10e2b525021d67acaaf0403b9`. `04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3` permanece como referencia historica de exportacion/ports, no como HEAD actual. Esta entrega no cambia rama, commits ni backend.

## Gates

| Comprobacion | Resultado |
| --- | --- |
| `npm test` final | 192/192 pasan, 22 archivos |
| Suite E2E completa, desktop y movil | 56/58 pasan; fallos moviles en restauracion de scroll y contador de plot |
| E2E dirigido final, fuentes congeladas | 14/14 pasan, incluidos ambos fallos anteriores y los diez casos de inspeccion/cierre/fallback |
| Recarga repetida final | 6/6 pasan: tres repeticiones por viewport |
| Pixeles WebGL aislados, tras ampliar proyecciones | 4/4 E2E pasan, LF/HF y desktop/movil; controles HTML ocultos |
| `npm run build` final | TypeScript y build de produccion pasan |
| `npm audit --omit=dev` | 0 vulnerabilidades de runtime reportadas |
| Composiciones estaticas finales | 114 JPEG exportados por caso/escena; 170 JPEG totales, sin borrar imagenes anteriores |
| Preservacion del Explorer | 184 archivos no ignorados comparados por SHA-256; 0 cambios, eliminaciones o adiciones |
| Referencia del backend | HEAD/dev actual a0277fb; exportacion historica 04e5f7b, sin ediciones del backend |
| Medicion de produccion | Ambos casos, desktop y movil, tres recorridos por contexto; 0 errores y 0 overflow horizontal |

Los 58 escenarios distintos quedaron cubiertos entre la suite completa y la repeticion dirigida final. La ejecucion integral obtuvo 56/58; cambios HMR coincidieron con parte de la corrida. Despues de corregir restauracion y congelar fuentes, 14/14 pruebas dirigidas pasan, incluidos ambos fallos previos. No se afirma una ejecucion integral de 58/58 tras todos los ajustes finales.

LF contiene 39 identificadores entre sus 12 combinaciones de detector/clasificador. La ruta inicial CNN/ResNet tiene 27 fases; Boxcar/radio es opcional, 23. HF tiene 18 fases y no aplica esos selectores LF ni resultados entrenados incompatibles.

## Control Y Encuadre

Un toque de flecha avanza o retrocede 0.0125 fases. Mantenerla inicia avance continuo tras 250 ms; velocidad inicial 0.12 fases/s, ajustable entre 0.10 y 1.00. Release, cancelacion, perdida de captura, blur y ocultacion detienen avance sostenido. La rueda horizontal respeta magnitud, conserva scroll vertical nativo y amortigua el destino con respuesta exponencial de 65 ms, sin overshoot. Invertir direccion descarta impulso pendiente. Barra `step=any`, PageUp/PageDown de 0.1 fases y Home/End conservados.

Pruebas numericas cubren incrementos, acumulacion, inversion, cancelacion y callbacks obsoletos. El salto explicito de acto sigue animado; repetir operacion dura ocho segundos y control manual cancela esa reproduccion. No se usa la amortiguacion de navegacion como reloj fisico ni como retraso de llegada.

Viewports principales: 1440x1000 y 390x844. El cierre y selector tambien se comprobaron en 320x568 y 844x390. El header movil ocupa dos filas; los plots comienzan por debajo. Cambiar caso vuelve al origen, cancela carga LF y elimina score, progresion y seleccion incompatibles.

El cierre de hasta 1120 px queda centrado, sin sidebar heredado ni flow recortado. El titulo LF es `Candidato detectado`; HF conserva `DM no resuelta`. La nota fija es: `Para confirmar: descartar RFI y contrastar evidencia astronómica independiente.` Ambos conservan `data-confirmation="not-confirmed"`; titulo, clase y confirmacion no se equiparan. Los plots finales siguen siendo 2D y vinculados.

La inspeccion 3D usa OrbitControls: rotacion, pan, zoom, teclado, touch y cuatro vistas. Lateral/superior conservan oblicuidad z0.35 para no hacer invisible una superficie plana. El relieve normalizado 0..3 u.a. cambia un uniform GPU, nunca arrays, ejes cientificos, hashes o inferencia. Restaurar deja perspectiva y 1 u.a.; salir restaura encuadre y relieve narrativos. Escape devuelve foco al boton 3D. Salida resincroniza el termino matematico con el progreso actual. Cambio de fase/caso y perdida WebGL limpian controles y muestran explicaciones compatibles.

La recarga conserva un checkpoint de posicion en `history.state`, validado por version, caso, firma de ruta y rango; no persiste evidencia ni scores. Una prueba A/B en Chromium, sin restauracion nativa, mostro que `pagehide` guarda demasiado tarde para su entrada recargada. `beforeunload` conserva progreso22.63981 y restaura escena22, scrollY33228. Ambos eventos ocurrieron en la prueba. El checkpoint se consume una vez, solo en recarga; no se aplica a navegacion normal, back/forward ni rutas/casos distintos. Se conservan otros campos de historial y no se sobrescriben estados no planos.

La QA matematica inicial recorrio 232 focos en ocho escenas por caso y cuatro viewports. Tras reservar cuatro pixeles en el ajuste tipografico, se comprobaron otros 44 focos de plasma LF y antenas LF/HF: cero desbordes de formula, cero overflow del documento y cero errores. Margen minimo de descendientes KaTeX: 2.046875 px. Evidencia: `validation/qa-math-observation.json`, `validation/qa-final-math-observation.json` y capturas en `validation/screenshots/`. Se inspeccionaron visualmente Arecibo, ALMA con foco de retardo y el cierre HF movil.

Las pruebas comprueban pixeles coloreados en Canvas/WebGL, reconstruccion reversible de plots, cursores vinculados, coordenadas, imagenes fallback cargadas y accesibilidad por teclado. Es una comprobacion automatizada y visual acotada, no equivalencia con cualquier dispositivo o navegador.

La inspeccion se verifica aparte ocultando HTML: mas de 200 muestras brillantes en el area central de Canvas, muestreo cada ocho pixeles, para no confundir iconos con datos. El criterio admite superficies LF mayormente blancas, no exige una cromaticidad artificial. Las capturas bajo demanda solicitan la misma pose tras volver a mostrar HTML; `preserveDrawingBuffer=false` permanece. Se inspeccionaron las vistas LF frontal/superior y el relieve HF movil. Capturas: `inspection-pixels-*` e `inspection-*-relief.png`. Ampliar oblicuidad de 0.12 a 0.35 no cambia radio de camara, objetivo ni coordenadas cientificas.

## Ciencia Y Procedencia

**LF / Arecibo:** fixture sintetico fijo de DM500, 64 canales, 2048 muestras, dt1 ms y 96 DM de prueba. Centros extremos 1203.125 y 1596.875 MHz producen retardo 619.595982824 ms. DMmax1000 produce R1239.191965647. El reflector historico de 305 m incluye tres torres, cables y receptor suspendido; ALFA tiene siete haces, no siete platos coherentes. Arecibo descubrio FRB121102, pero este fixture no son sus datos: el articulo de descubrimiento da DM central557.4, dt65.5 us y anchura3 ms. La ruta LF no contiene phasing entre antenas.

El viaje LF conserva presupuesto didactico de DM observada: anfitriona100, IGM280, halo50 y disco70, en pc cm^-3. Son contribuciones ilustrativas, no mediciones. Se distingue longitud propia y factor cosmologico 1/(1+z). La entrada a la Via Lactea termina con descenso a Puerto Rico. La textura terrestre NASA se carga de forma diferida. RM rota polarizacion; DM retrasa frecuencias. Ningun fixture aporta una medicion polarimetrica.

**HF / phased ALMA:** nuevo pulso galactico sintetico inspirado en PSR J1745-2900, no FRB observado. Banda85.268-87.268 GHz, 32 canales, muestreo nativo32 us y suma temporal explicita x128: dt efectivo4.096 ms. Retardo a DM conocida1770, entre centros, 44.333157045 us: 1.385411 muestras nativas y 0.010823525 efectivas. La dispersion existe; queda no resuelta bajo esta configuracion efectiva.

El selector del backend evalua R con **DMmax**, no con DM conocida: DMmax3000 da R0.018344957066. HF si R < 2; igualdad pertenece a LF. Sin suma x128, este mismo ejemplo da R2.348155 y el criterio escogeria LF. La banda alta no implica por si sola que toda observacion ALMA sea HF. La regla separada de omitir cubo depende del intervalo DMmax-DMmin.

HF conserva DM conocida/inyectada aparte y resultado `unresolved_high_freq`; no mide DM0 ni dibuja un Bow Tie informativo artificial. La animacion no magnifica el retardo hasta producir una falsa curva. ALMA muestra seis antenas ilustrativas de 12 m, valle de Chajnantor, retardos geometricos, fases, suma coherente y correlador paralelo. El correlador no es entrada serial de la suma. Modelos no son CAD, topografia medida ni configuracion completa del articulo.

El fixture HF integra una gaussiana con desplazamientos continuos y modela suma temporal de senal/ruido. Sus 128x32 valores son intensidad residual de fondo sustraido, sin calibracion Jy. Las seis anchuras son 1,2,3,5,8,15 muestras: 4.096,8.192,12.288,20.480,32.768,61.440 ms. Banco y perfil coinciden con `computeSNR` del Explorer; se conservan kernels float32, padding `same`, bordes y asimetria de anchuras pares. Maximo: SNR9.6916513443, t249.856 ms, W20.48 ms. Seleccion exige exposicion completa y SNR >= umbral, incluida igualdad.

Los oraculos comparan formulacion GHz independiente con helper MHz, resolucion nativa/efectiva, ambos lados de R2, determinismo, banco/perfil, umbral, superficies finitas y limpieza de geometrias. ADC, Hann, FFT, correlacion conjugada, Stokes y Faraday conservan sus pruebas anteriores. Sin Fs calibrada se usan ciclos/muestra, no Hz inventados. ADC4 bits y FFT64 son operadores ilustrativos independientes, no hardware real de ALMA ni causa fisica de los fixtures.

Fuentes y contratos completos: [OBSERVING_CASES](OBSERVING_CASES.md), [SCIENCE](SCIENCE.md), [COSMIC_SOURCES](COSMIC_SOURCES.md) y [CODE_REUSE_MAP](CODE_REUSE_MAP.md). El articulo ALMA de 2025 detecta ocho pulsos de magnetar, no ocho FRBs. No se extiende su estado historico a una ausencia universal de FRBs en 2026.

## Resultados Y Redes

Seis binarios LF, 2361344 bytes, y metadata de 69691 bytes conservan dimensiones, little-endian, finitud, hashes SHA-256, decode y logits/softmax. Waterfall, recorte, perfil, mapa DM-tiempo y RGB pertenecen al mismo ejemplo. Perfil de busqueda: fila47 del mapa de media expuesta, no SNR. RGB es preparacion RGB real, no los tres planos cientificos. Se conservan los 512 valores GAP de la inferencia CPU heredada.

Solo CNN/ResNet LF usa ficha completa con esa inferencia exacta. CNN con otro clasificador conserva procedencia del detector, pero clasificacion es didactica. ResNet tras otro detector usa ejemplo independiente, no recorte de la traza registrada. Boxcar, reglas de radio, bosque y Transformer muestran ejemplos publicados, sin nueva inferencia entrenada, probabilidad calibrada ni confirmacion astrofisica. Cambiar ruta/caso invalida resultado incompatible.

Cierre LF registrado: perfil SNR, mapa DM-tiempo y recorte frecuencia-tiempo vinculados. Pico SNR0.554 s, ventana14 ms y centro CNN0.5512215728759766 s son cantidades distintas. Las rutas toy no heredan score. Cierre HF: perfil SNR, **anchura-tiempo** y waterfall frecuencia-tiempo propios. Umbral reutiliza arrays; cursor compartido no estima otra DM ni ejecuta clasificacion. HF no descarga evidencia LF ni muestra logits/ResNet entrenados de otro evento. El backend puede clasificar HF con ResNet, pero este fixture nuevo no tiene una traza compatible.

Plots revelan escrituras discretas preparadas y recuperan el mismo contador al retroceder. No se recalcula una matriz completa ni una red por frame. Candidato y score permanecen distintos de confirmacion astronomica. Ver [METHODS](METHODS.md).

## Rendimiento

Medicion final: 2026-10-11T15:32:50.420Z. Build estatica local con gzip, contextos nuevos, sin throttling de red. LF usa la ruta inicial CNN/ResNet de 27 fases; HF conserva Boxcar/radio de 18 fases. Tres recorridos por caso y viewport. Evidencia LF `idle` en primera vista. Reporte completo: [performance.json](../validation/performance.json).

| Caso / viewport | Fases | Renderer y fuentes listos | Heap inicial tras GC | Heap final tras GC |
| --- | --- | --- | --- | --- |
| LF, 1440x1000 | 27 | 1326.9 ms | 9134108 bytes | 14185312 bytes |
| LF, 390x844 | 27 | 770.5 ms | 9076880 bytes | 14144588 bytes |
| HF, 1440x1000 | 18 | 893.0 ms | 8318392 bytes | 11402068 bytes |
| HF, 390x844 | 18 | 736.2 ms | 8312984 bytes | 11394292 bytes |

Bodies iniciales: 605648 bytes, fuentes incluidas, en los cuatro contextos. JS inicial gzip: 435262 bytes. Bodies finales: 2722093 bytes LF y 1072176 bytes HF. Bodies excluyen HTML y cabeceras HTTP; no representan trafico total. Canvas DPR1: 1440000 pixeles desktop y 329160 movil. `dist/`: 11909831 bytes; posters: 6254728 bytes, incluido manifest y composiciones anteriores. Loader de evidencia diferido: 3516 bytes gzip; cierre HF: 3865 bytes JS gzip mas369 bytes CSS.

| Caso / viewport | Geometrias tras cada tour | Texturas tras cada tour | Draw calls finales | Long tasks / maximo |
| --- | --- | --- | --- | --- |
| LF, desktop | 313/313/313 | 150/150/150 | 20 | 60 / 405 ms |
| LF, movil | 308/310/310 | 150/150/150 | 20 | 16 / 297 ms |
| HF, desktop | 159/159/159 | 47/47/47 | 12 | 33 / 349 ms |
| HF, movil | 154/157/157 | 46/46/46 | 12 | 9 / 292 ms |

Cada contexto registro cero errores de pagina, cero overflow horizontal y cero redibujos durante600 ms pausado. Nueve sondas por contexto registraron cero redibujos durante30 oportunidades rAF en reposo. Esas oportunidades no son FPS de GPU. La fuente ambiental dio medianas rAF33.3 ms desktop y16.7 ms movil bajo SwiftShader. Long tasks incluyen montaje y primer acceso; no se afirma fluidez perfecta con renderer de software.

JSHeapUsedSize puede excluir backing stores de ArrayBuffer; excluye Workers, GPU y proceso del navegador. Hay crecimiento moderado del heap entre recorridos. Texturas estables; en movil se agregan dos geometrias LF o tres HF al segundo recorrido y quedan estables en el tercero. No se presenta como memoria total ni prueba exhaustiva de ausencia de fugas. Las cifras corresponden a CNN/ResNet LF y Boxcar/radio HF, no a todas las rutas ni a ejecucion de redes entrenadas en el navegador.

Vite avisa que el chunk Three.js minificado supera500 kB (528616 bytes,135138 gzip). No es error de build. Math, motion, renderer, loader y cierre HF tienen chunks separados. Rasterizacion reutilizada y render bajo demanda evitan redibujar matrices quietas; arrays cientificos no cambian con cada frame.

## Alcance Y Entrega

Chromium en Windows y movil emulado; no GPU movil fisica, Safari/Firefox ni conexiones lentas. La QA no cubre todos los drivers. Movimiento reducido, pausa y posters conservan recorrido; recursos WebGL se liberan al desmontar/cambiar caso.

No se ejecuto nueva inferencia Torch ni entrenamiento. Checkpoints no incluidos. El ejemplo LF registrado es fijo; HF es nuevo y clasico. Datos privados de tesis no disponibles; no se afirman resultados historicos reprocesados.

Preservacion: [preservation.json](../validation/preservation.json), 184 archivos iguales. Backend read-only; cambios de esta etapa limitados a `web/frb-cinematic/`. El servidor temporal5175 de medicion se detuvo; dev5174 permanece activo. La preservacion del Explorer no presupone que su servidor5173 este activo. Sin commit ni push.
