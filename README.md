# FRB Atlas

Experiencia independiente de `web/frb-explorer`. Dos casos conectan fuente, propagacion, instrumento y candidato sin confundir sus regimenes cientificos. LF/Arecibo inicia con CNN/ResNet, 27 fases; Boxcar/radio es opcional, 23 fases. HF/ALMA tiene 18 fases de busqueda temporal clasica. Trayectoria hacia la derecha, avance fino reversible y sin audio. El laboratorio anterior no se modifica.

## Ejecutar

Requiere Node.js 22.12 o posterior y npm. Desde esta carpeta:

```powershell
npm ci
npm run dev -- --port 5174 --strictPort
```

Abrir `http://127.0.0.1:5174/`. El laboratorio enlazado usa `http://127.0.0.1:5173/`; `VITE_LAB_URL` permite cambiarlo antes del build. No hay servicios externos de inferencia ni fuentes tipograficas remotas. Referencias cientificas abren sus fuentes originales; texturas y datos se sirven localmente.

```powershell
npm run build
npm run serve -- --port=5175
```

`dist/` contiene la entrega estatica completa. El servidor incluido escucha solo en localhost, comprime respuestas con gzip y respeta ETag. Para publicar, servir `dist/` por HTTP(S) con compresion habilitada. No abrir `index.html` mediante `file://`: modulos y verificacion SHA-256 requieren HTTP local o HTTPS.

## Relato

El selector **Caso de observacion** permanece disponible desde la primera vista. Cambiar de caso cancela carga y avance pendientes, elimina resultados incompatibles y vuelve al origen. La URL admite `?observation=arecibo-lf` o `?observation=alma-hf`. Metodos LF se conservan al regresar; no se aplican sus scores ni checkpoints al ejemplo HF.

- **Arecibo / LF:** fuente extragalactica ilustrativa y curva dispersiva resuelta. Reflector historico de 305 m, tres torres y receptor suspendido. Arecibo descubrio FRB 121102 con ALFA cerca de 1.4 GHz. La demo conserva su fixture sintetico DM500, no los datos de ese FRB real (DM557.4).
- **ALMA / HF:** pulso galactico sintetico inspirado en PSR J1745-2900, Band 3, 32 canales. Muestreo nativo 32 us; suma temporal ilustrativa x128 produce 4.096 ms efectivos. El retardo entre centros es 44.333157 us: existe fisicamente, pero ocupa solo 0.010823525 muestras efectivas. No muestra una falsa curva ni una DM medida.

El backend elige HF cuando `R=Delta_t(DMmax)/dt_eff < 2`; igualdad pertenece a LF. Para este HF, DMmax3000 da R0.018344957. Sin downsampling, el mismo caso da R2.348155 y el backend escogería LF. ALMA no implica siempre dispersion no resuelta; otras bandas y resoluciones cambian el regimen. El articulo de referencia detecta ocho pulsos del magnetar, no FRBs. Detalles y fuentes: [OBSERVING_CASES](docs/OBSERVING_CASES.md).

Recorrido LF:
1. Origen: fuente compacta ilustrativa, campo y envolvente; no se identifica un progenitor universal.
2. Viaje: anfitriona, expansion cosmologica, plasma intergalactico, entrada al halo y disco de la Via Lactea, polarizacion/Faraday, Tierra y llegada a Arecibo.
3. Captura: enfoque de un reflector, receptor, ADC, FFT, potencia e integracion. ALFA tiene siete haces, no siete platos para suma coherente.
4. Datos: waterfall, bloques, contexto y region valida.
5. Busqueda: dedispersion, perfil de intensidad media expuesta y barrido DM-tiempo.
6. Metodos y candidato: detector Boxcar, CNN o Transformer visual; inspeccion radio, Random Forest, ResNet o Transformer para clasificacion.

Un canvas y una camara continuos conectan las etapas sobre un eje espacial positivo. Cada operacion termina al 56% de su tramo; su resultado permanece hasta el 72%. El 28% restante transfiere la salida a la siguiente entrada. La identidad visual conserva el enlace, incluso al retroceder. Un identificador del fixture no atribuye sus datos a la fuente ni a los ejemplos alternativos. Los tramos ocupan 185svh en escritorio y 175svh en movil, equivalentes a 1.85 y 1.75 alturas del viewport.

Texto principal por fase: maximo 18 palabras. Un toque de flecha o teclado avanza 0.0125 fases, no salta al siguiente operador. Mantener una flecha continua tras 250 ms a velocidad regulable de 0.10 a 1.00 fases/s; valor inicial 0.12 fases/s. La barra horizontal permite situarse dentro de cualquier operacion. Scroll horizontal aporta cambios pequenos; el vertical mantiene recorrido nativo. Soltar, perder foco o cambiar pestaña detiene avance sostenido. Navegacion por actos y reinicio siguen disponibles, con foco accesible.

El scroll horizontal acumula impulsos y responde mediante una amortiguacion exponencial de 65 ms, sin overshoot. Invertir direccion descarta el impulso anterior pendiente; teclado, barra, salto de acto, modal, blur y pestaña oculta cancelan la amortiguacion. No se añade una inercia larga ni se modifica el tiempo fisico del evento.

Recargar conserva la posicion mediante un checkpoint en el historial de esta entrada, no datos ni puntuaciones. Solo se restaura durante recarga, con version, caso, firma de ruta y rango validos. Cambiar caso o metodo no recupera una posicion incompatible. El checkpoint se guarda antes de salir y no sobrescribe otros campos ni estados no planos del historial.

LF entra desde el halo al disco y la vecindad solar; en Tierra desciende hacia Puerto Rico y el Arecibo historico. HF parte dentro de la Via Lactea, atraviesa plasma galactico y llega al llano de Chajnantor. Solo HF muestra compensacion de fases, correlador paralelo y suma coherente de seis antenas ALMA ilustrativas. Los terrenos no son topografia medida ni los voltajes una captura de hardware real.

Movimiento reducido conserva escenas WebGL quietas, con focos seleccionables y sin transiciones. Perdida de WebGL usa composiciones locales por ID de escena, sin texto HTML incrustado. Las escenas con evidencia no aparecen hasta verificarla. Los resultados de un metodo incompatible no permanecen visibles al cambiar de ruta.

## Elegir Metodos

La bifurcacion `metodos`, despues del mapa DM-tiempo, ofrece dos selectores independientes. Ruta inicial LF: **CNN/CenterNet y ResNet**. Boxcar/PRESTO con inspeccion radio permanece como alternativa. Opciones completas y contratos: [METHODS](docs/METHODS.md).

Esta bifurcacion pertenece a LF. HF muestra integracion temporal y banco boxcar sin barrido dispersivo; no aplica CenterNet. El codigo raiz admite despues clasificacion ResNet I/L, pero esta demostracion HF no exporta una nueva inferencia ni reutiliza la traza LF.

- Boxcar explica suma normalizada, banco de anchuras y umbral; no reproduce el pipeline completo de PRESTO.
- CNN conserva la preparacion RGB, backbone, tres upsampling, cabezas y decode/NMS registrados de CenterNet.
- Transformer visual explica parches, proyecciones y atencion `softmax(QK^T/sqrt(d))V`; sus cajas son esquematicas, sin detector entrenado.
- Inspeccion radio conecta ley dispersiva y contexto; Random Forest combina reglas publicadas; Transformer clasifica un ejemplo fijo.
- CNN seguida de ResNet conserva el recorte y la inferencia CPU exactos. ResNet elegida tras otro detector muestra solo un residual didactico compatible, no la traza de una entrada diferente.

Las alternativas usan perfiles, mapas, recortes, pesos analiticos y reglas fijos publicados. Sus animaciones son explicativas, no nuevas predicciones ni puntuaciones astrofisicas. Solo el par CNN/ResNet acaba con la ficha registrada. Las demas combinaciones terminan como propuestas ilustrativas sin score entrenado. La URL permite abrir esa ruta registrada: `?detector=cnn&classifier=resnet`.

El cierre centrado, de hasta 1120 px y sin sidebar, titula **Candidato detectado** y construye tres plots vinculados: perfil SNR, mapa DM-tiempo y frecuencia-tiempo. Click, arrastre y teclado mantienen los cursores. La ruta registrada usa recorte/perfil exactos y separa pico SNR 0.554 s de centro CenterNet aproximadamente 0.551 s; el mapa es media expuesta, no SNR. Alternativas usan arrays TOY independientes. El menu Ruta permite regresar a fases anteriores. Los selectores siguen en Metodos; el cierre movil prioriza plots.

El cierre HF usa su propio perfil SNR, plano ancho-tiempo y waterfall frecuencia-tiempo. El plano de filtros no es un bow tie DM-tiempo. El umbral filtra candidatos sin regenerar los arrays. DM1770 es referencia conocida e inyectada; el resultado permanece `unresolved_high_freq`, no DM0. Ambos cierres conservan `data-confirmation="not-confirmed"` y la nota fija: **Para confirmar: descartar RFI y contrastar evidencia astronómica independiente.** Detectar o clasificar no confirma un origen astrofisico.

## Inspeccion 3D

El boton Rotate3D de la toolbar abre inspeccion en matrices, perfiles, Bow Tie, recortes, tensores y operadores HF compatibles. El canvas se centra y el progreso queda quieto; OrbitControls permite rotar, desplazar y acercar con mouse, touch y controles accesibles de teclado. Vistas frontal, lateral, superior y perspectiva cambian la camara, no el orden cientifico de ejes. Lateral/superior conservan componente z de 0.35 para no ocultar superficies planas.

**Relieve normalizado (u.a.)**, de 0 a 3, modifica solo un uniform GPU: no es amplitud calibrada ni altera arrays, hashes, datos o inferencia. Restaurar recupera perspectiva y relieve 1 u.a.; salir devuelve el encuadre narrativo y relieve originales. Escape, cambio de fase/caso y perdida de WebGL cierran el modo. Los plots finales siguen siendo 2D, con sus selecciones vinculadas.

## Matematica Vinculada

Cada operador contiene una ecuacion KaTeX accesible, unidades y terminos seleccionables. El cierre prioriza sus plots; su ecuacion completa sigue disponible en fuentes. El termino activo cambia con la misma progresion que mueve la escena; seleccionarlo mantiene el foco hasta volver al modo automatico o cambiar de fase. La seleccion resalta su objeto fisico, fila, eje u operador correspondiente. No introduce otro reloj cientifico.

La columna electronica hace visible la integral de DM y su relacion con los retrasos por frecuencia. Anfitriona, medio intergalactico y Via Lactea aportan un inventario didactico de DM observada. La Tierra recibe bandas con llegadas separadas y campo transversal. Polarizacion muestra Stokes y `chi=chi0+RM lambda^2`: RM gira orientacion, DM retrasa llegadas. El fixture no mide anfitriona, redshift ni polarizacion. Ecuaciones, convenciones y NASA Blue Marble: [COSMIC_SOURCES](docs/COSMIC_SOURCES.md).

Cada termino presenta su ecuacion relevante; el sistema completo permanece en el panel de fuentes. La fase instrumental muestra tambien la rama del correlador: producto de voltajes complejos conjugados y promedio. Visibilidad y suma coherente no se confunden ni se conectan como si fueran operaciones seriales.

Las ecuaciones dentro del espacio 3D tambien estan compuestas matematicamente: integral DM, fraccion cosmologica, subindices, conjugados y exponentes. Las texturas Canvas se preparan una vez, sin mostrar aproximaciones ASCII como `sum n_e dl` ni usar cargas asincronas de formulas.

Waterfall, perfil y mapa DM-tiempo avanzan mediante escrituras discretas y cursores. Los valores de esas escenas proceden del mismo fixture verificado; se reproduce su construccion, no se recalcula una observacion ni una inferencia en tiempo real. Los metodos alternativos escriben sus propios ejemplos publicados, con procedencia distinta. El control de repeticion recorre la operacion durante ocho segundos. Scroll manual interrumpe esa reproduccion. Con movimiento reducido, los terminos siguen disponibles y la salida se presenta sin animacion. Sin WebGL, el foco textual y matematico funciona sobre una composicion fija. En viewports cortos se conservan unidades del termino seleccionado; las unidades generales y cifras completas estan en fuentes.

## Limites Cientificos

Fixture LF fijo: semilla `241032`, 64 canales, 2048 muestras, 96 DM. DM inyectada 500; DM detectada 494.7368469238281 en la ruta registrada. El score CenterNet y los logits ResNet proceden de inferencia CPU real precalculada sobre esa misma entrada sintetica. HF usa otro fixture sintetico determinista de 128 muestras efectivas por 32 canales, con boxcars numericos y sin inferencia entrenada. No se ejecutan redes entrenadas ni se entrenan pesos en el navegador. Los pequenos operadores alternativos son demostraciones independientes, no transformaciones de la inferencia LF.

Fuente, distancia, galaxias, polarizacion, antenas y voltajes son ilustrativos. No se presentan como observacion real ni como cadena de hardware que genero el waterfall. LF elige un recorrido extragalactico; HF un magnetar galactico inspirado en el caso del backend. En busqueda LF, el perfil es exactamente la fila47 del mapa de media expuesta; no es SNR. El SNR de la ficha registrada procede del recorte elegido despues de CenterNet. La DM de prueba fija es una hipotesis guiada, no una deteccion anticipada. Candidato y puntuacion no implican confirmacion astrofisica.

Detalles, unidades, hashes y correcciones: [SCIENCE](docs/SCIENCE.md). Guion: [STORYBOARD](docs/STORYBOARD.md). Reutilizacion: [CODE_REUSE_MAP](docs/CODE_REUSE_MAP.md). Resultados: [VALIDATION](docs/VALIDATION.md).

## Arquitectura

- `src/App.tsx`: scroll GSAP, estado de presentacion, carga cancelable y procedencia.
- `src/story.ts`: catalogo original de operadores, seis actos y tiempos de operacion/transferencia.
- `src/routes.ts`: relato cosmico y rutas dinamicas segun deteccion/clasificacion.
- `src/observations.ts`: instrumentos, unidades, procedencia y resolucion de ambos casos.
- `src/hf/`: fixture, operadores numericos, escenas y cierre HF sin dependencia de evidencia LF.
- `src/navigation/`: posicion continua, pasos finos, avance sostenido y velocidad regulable.
- `src/cinema/World.ts`: renderer persistente, camara, calidad y limpieza.
- `src/cinema/plotInspection.ts`: vistas de camara y relieve visual GPU sin cambios cientificos.
- `src/cinema/physicalStages.ts`: mecanismos ilustrativos y dispersion.
- `src/cinema/cosmicStages.ts`: anfitriona, Via Lactea, polarizacion y Tierra.
- `src/cinema/travelCamera.ts` y `observatory.ts`: poses reversibles, ALMA procedural y Arecibo historico.
- `src/cinema/formulaSprite.ts`: vocabulario matematico limitado, compuesto en texturas reutilizables.
- `src/cinema/dataStages.ts`: instancing, texturas, matrices y trazas precalculadas.
- `src/cinema/methodStages.ts`: diagramas incrementales de metodos didacticos.
- `src/methods/`: catalogo, unidades, ecuaciones y pesos/reglas publicados.
- `src/finale/`: ejes cientificos, rasterizacion cacheada y tres plots con seleccion compartida.
- `src/evidence/`: contratos, dimensiones, endian, hashes y validacion.
- `src/math/`: ecuaciones, unidades, ejemplos, fuentes y foco sincronizado.
- `public/evidence/`: seis binarios y metadata del unico evento.
- `public/posters/`: alternativa estatica desktop y movil.

Las matrices cientificas se calculan offline; las demostraciones pequenas se preparan una vez al crear sus escenas. Durante cada frame cambian transforms, uniforms y cantidad de elementos revelados, no los datos ni pesos. Solo dos etapas adyacentes se dibujan. Las escenas de datos y metodos usan render bajo demanda: al detener el scroll, no gastan frames GPU. Fuente y mecanismos fisicos conservan su presentacion ambiental donde corresponde; las nuevas etapas cosmicas siguen progreso del usuario. Pausa y pestaña oculta detienen el bucle. DPR limitado a 2; presupuesto de 2 millones de pixeles en calidad estandar y 3 millones en alta. La evidencia se descarga desde el acto de captura, no en la primera vista. Arrays float32, instancing y recursos reutilizados evitan recalculos y draw calls por celda. Renderer, texturas, geometria, observadores y listeners se liberan al desmontar.

El build incorpora el helper puro de dispersion del Explorer, sin editarlo ni importar su UI. Una vez compilado, `dist/` funciona sin el directorio original. El exportador offline si necesita los operadores y trazas originales.

## Regenerar Evidencia Y Composiciones

La evidencia y las composiciones ya estan incluidas. No hace falta Python ni checkpoints para ejecutar o compilar.

Para regenerar evidencia, instalar primero las dependencias del Explorer y usar su entorno Python de trazas, o establecer `DRAFTS_EVIDENCE_PYTHON`. Ver versiones y contrato en SCIENCE.

```powershell
npm run export:evidence
```

Esto lee trazas CPU existentes y llama al SNR/preprocesado Python real. No reejecuta la inferencia completa. Regenerar checkpoints/activaciones pertenece al exportador del laboratorio original.

Con esta pagina ejecutandose en 5174, regenerar composiciones por ID para todas las rutas despues de cambios de escena:

```powershell
npx playwright install chromium
npm run export:posters
npm run build
```

`CINEMA_URL` cambia el servidor usado por `export:posters` y `measure`.

## Verificar

```powershell
npm test
npm run test:e2e
npm run build
```

Playwright prueba desktop y movil emulado con un solo worker. No equivale a medir una GPU movil real. Las capturas se guardan en `validation/screenshots/` y las trazas de fallo en `test-results/`, ambas ignoradas por Git.

Con `npm run serve` activo en 5175:

```powershell
npm run measure
```

Guarda `validation/performance.json`: transferencias iniciales comprimidas, oportunidades rAF, heap principal tras GC, tres recorridos, recursos y errores. Excluye memoria GPU/proceso y no promete FPS de dispositivos fisicos.
