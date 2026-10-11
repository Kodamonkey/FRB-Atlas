# FRB Atlas: Reutilizacion Y Contratos

Referencia del backend y trazas: `04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3`. Ningun archivo del Explorer original ni del backend Python cambia para esta version; la rama del checkout no redefine esa referencia cientifica.

FRB Atlas amplia la app cinematografica, no las trazas entrenadas de DRAFTS. LF/Arecibo usa ejemplos publicados y conserva CNN/ResNet solo para su entrada exacta. HF/ALMA agrega un fixture sintetico galactico independiente y reutiliza el SNR del Explorer read-only; no importa inferencia HF entrenada. Los contratos distinguen codigo, referencia matematica y assets. Una cita no implica ejecutar su implementacion. Casos y fuentes: [OBSERVING_CASES](OBSERVING_CASES.md).

| Fuente | Uso | Contrato conservado | Validacion |
| --- | --- | --- | --- |
| `../frb-explorer/src/science/physics.ts` | Helper puro importado por la escena del plasma | MHz, segundos, centros reales, constante 4148.808 | Centros y retardos comparados con evidencia; no factor 1000 adicional |
| `../frb-explorer/src/science/index.ts` | Exportacion offline del evento | Semilla, estado, orden `[tiempo,frecuencia]`, float32, dedispersion y exposicion | SHA-256 del waterfall contra la entrada de la inferencia |
| `../frb-explorer/src/science/acquisition.ts` | Exportacion de ADC/FFT ilustrativos | Saturacion, cuantizacion, Hann y fft.js; no voltajes recuperados | Valores incluidos con procedencia separada del evento LF |
| `../frb-explorer/src/science/pipeline.ts` | Ventanas educativas offline | Region valida semiabierta y contexto lateral | Reconstruccion completa/chunks en tres DM, cada muestra una vez |
| `../frb-explorer/src/science/pipeline.ts` | Importacion directa HF de `computeSNR` y `channelShifts` | Pesos robustos, convolucion same float32, ties-to-even, sin wrap | Contrato HF: reproducibilidad y correspondencia exacta banco/perfil; resultados del gate en VALIDATION |
| `src/core/pipeline_parameters.py` | Referencia de seleccion, no ejecucion Python en browser | R a DM_max dividido por dt efectivo; HF estrictamente R<2, igualdad LF | Casos a ambos lados y efecto de downsampling; no decidir por nombre ALMA/Band 1 |
| `src/core/high_freq_pipeline.py` | Referencia de cubo y DM no resuelta | Cube-skip con intervalo DM y ratio<1, distinto de HF<2; NaN/unresolved_high_freq | UI null/dmResolved=false; DM conocida no se convierte en medida |
| `src/preprocessing/data_downsampler.py` | Referencia del reductor | Suma temporal; promedio frecuencia/polarizacion; descartar colas incompletas | Fixture HF modela suma128 analiticamente, no lectura de datos nativos |
| `src/analysis/snr_utils.py` | Exportador Python | SNR del recorte real, widths y pico real | Perfil512, SNR67.82168579101562, maximo en259 |
| `src/visualization/visualization_unified.py` | Exportador Python | Input RGB real, resize, clipping, mako y ImageNet | Hash NCHW y RGB desnormalizado; RGB no es el cubo cientifico |
| `../frb-explorer/public/traces/manifest.json` | Inferencia fija | Candidate decode, umbrales, checkpoint hashes, logits y formas | Ejes DM/tiempo diferenciados; softmax2 y hash del input |
| `../frb-explorer/public/traces/crops/candidate.json` | Recorte original y preparado | Inicio295,512x64, delays ties-to-even, sin wrap, padding | Comparacion de todas las celdas contra waterfall |
| `../frb-explorer/public/traces/layers/*.json` | Miniaturas de activacion reales | Canal0, media espacial, forma original y hooks clonados | Ocho snapshots validados; no tensores completos inventados |
| `../frb-explorer/public/traces/operators/classifier-base_model-fc-1.json` | Vector GAP real |512 componentes a entrada de Linear2 | Vector exacto, no expansion de la miniatura1x1 |
| `src/story.ts` | Catalogo original y tiempos de presentacion | IDs originales, `operation/handoff`, salida sostenida | Ruta dinamica usa IDs, nunca asume indices antiguos |
| `src/observations.ts` | Configuracion de dos casos | Banda/centros, dt nativo/efectivo, DM conocida y maxima, origen e instrumento | LF CNN/ResNet default 27, Boxcar/radio opcional 23; HF 18; razones 1239.191965647 y 0.018344957066 |
| `src/routes.ts` | Composicion por caso y metodos LF | LF sin fase/suma; HF sin host/IGM/Bow Tie/CNN; final segun procedencia | Solo LF CNN/ResNet conserva final registrado; HF no hereda outputs LF |
| `src/navigation/transport.ts` | Transporte fino puro | Paso 0.0125 fases, espera 250 ms, velocidad en fases/s, limites y cancelacion | Reloj del usuario separado de propagacion fisica y muestras |
| `src/navigation/transport.ts` | Amortiguacion horizontal | Impulsos acumulados, respuesta exponencial 65 ms, sin overshoot; reversa cancela pendiente | Reloj simulado, extremos, callbacks obsoletos y cancelacion |
| `src/math/cosmicMath.ts` | Operadores pequenos nuevos | Marcos fuente/observador, Stokes firmado, Faraday, unidades | Inventario DM y rotacion conservan convenciones documentadas |
| `src/cinema/cosmicStages.ts` | Escenas ilustrativas por caso | LF anfitriona/IGM/entrada; HF origen galactico; polarizacion y Tierra | No infiere distancia, host, redshift o polarimetria de los fixtures |
| `src/cinema/travelCamera.ts` | Poses locales de acercamiento | Vectores reutilizados copiados por World; mismo progreso de operacion | Continuidad, reversibilidad y encuadre desktop/movil |
| Three.js `OrbitControls`, `src/cinema/plotInspection.ts` | Inspeccion opcional de datos 3D | Rotar/pan/zoom, vistas de camara, progreso quieto; lateral/superior con componente z de 0.35 | Relieve GPU 0..3 (u.a.) no cambia arrays/ejes; salir restaura vista/relieve y desactiva controles |
| `src/cinema/observatory.ts` | Destinos historico Arecibo y ALMA | Arecibo 305m esferico, R265.176m, ALFA7 haces; ALMA12m/focal primaria4.8m | Geometria optica de referencia, no CAD/layout/topografia medidos; instrumentos separados |
| `src/cinema/formulaSprite.ts` | Composicion matematica Canvas | Integral, scripts y fracciones del vocabulario finito; TeX canonico adjunto | Identidades KaTeX, nodos matematicos y foco; no parser TeX propio |
| `src/finale/model.ts` | Vista enlazada de evidencia | Perfil SNR512, mapa/recorte con tiempos absolutos, limites en bordes de muestras | Pico0.554s distinto de centroCNN; ventana14ms; sin scores incompatibles |
| `src/finale/FinalePanel.tsx` | Tres plots LF progresivos centrados | Max 1120 px sin sidebar, raster por entrada, cursor compartido, menu Ruta | Candidato detectado no confirmado; data-confirmation not-confirmed y nota de evidencia independiente |
| `src/hf/model.ts` | Nuevo fixture HF determinista | Semilla 17452900, residual 128x32, dt4.096ms, SNR propio y seis anchuras | SNR 9.6916513443, t249.856ms, W20.48ms calculados; no resultado observado ni score CNN |
| `src/hf/math.ts`, `src/hf/stages.ts` | Operadores HF y construccion | R_search distinto de q_known; waterfall/perfil/banco, sin filas DM ficticias | Formas, unidades, foco y revelado reversible; no inferencia entrenada |
| `src/hf/HFFinalePanel.tsx` | Cierre HF independiente diferido | Perfil128, banco anchura-tiempo6x128 y waterfall32x128; cursor compartido | Seleccion completa SNR>=6, DM no resuelta y salida no confirmada |
| [PRESTO single_pulse_search.py](https://github.com/scottransom/presto/blob/master/bin/single_pulse_search.py) | Referencia matematica, no importacion | Suma sobre `sigma sqrt(W)` y distincion de filtrado frente a pipeline completo | Operador propio pequeno; ventanas completas y pruebas independientes |
| [Attention Is All You Need](https://arxiv.org/abs/1706.03762) y [ViT](https://arxiv.org/abs/2010.11929) | Referencia matematica, no pesos ni checkpoints | Parches/proyeccion, `softmax_rows(QK^T/sqrt(d))V` y dimensiones | Proyecciones analiticas publicadas, sumas de filas y productos probados |
| [Random Forests](https://www.stat.berkeley.edu/~breiman/randomforest2001.pdf) | Referencia de evaluacion y votos | Fraccion de votos de arboles; no entrenamiento reclamado | Reglas manuales y empates publicados, sin probabilidad calibrada |
| `src/methods/math.ts` | Ejemplos propios pequenos | Perfil64, mapa/crop16x16, tokens16x4, cabeza4x2 y residual8 | Valores publicados y deterministas; nunca scores del fixture |
| `src/cinema/methodStages.ts` | Escritura progresiva y foco | Commits enteros, transformaciones/cantidad visible, foco de variables | Datos preparados una vez; volver atras conserva mismos arrays |
| `public/media/earth-blue-marble.png` | Raster NASA local no modificado | Mosaico optico equirectangular1024x512 | SHA-256 y atribucion en [COSMIC_SOURCES](COSMIC_SOURCES.md); no brillo de radio |

Rutas `src/...py` relativas a la raiz del repositorio. Rutas `../frb-explorer/...` relativas a esta nueva app. Las citas locales se muestran como procedencia, no como enlaces HTTP que un deploy aislado no puede servir.

## Adaptadores Explicitos

- Layout de texturas cambia la organizacion grafica, no los valores ni ejes cientificos. Los recortes y activaciones se muestrean por fragmento; no se interpolan cuatro esquinas.
- Waterfall y DM-tiempo usan una tira por fila, hasta256 segmentos. Solo la altura grafica se interpola; la textura mantiene todas las celdas y el color consulta los valores nativos por fragmento. No se interpola retardo entre canales.
- El maximo contexto es1269 muestras, no el overlap160 del preset. Deriva del mayor delay1239 mas boxcar30. Las ventanas extremas se recortan, sin wrap ni padding invisible.
- DM de verdad500, DM detectada494.7368469238281 y pico SNR554ms permanecen distintos. CenterNet estima551.2215728759766ms; no se fuerza coincidencia.
- La trayectoria y velocidad de camara son cinematograficas. No codifican distancia cosmologica o tiempo de vuelo fisico.
- El perfil de busqueda es la fila 47 nativa del mapa de media expuesta, no el perfil SNR del recorte posterior. La hipotesis DM fija explica desplazamientos sin anticipar una nueva inferencia.
- El catalogo original separa operaciones de renderizado; las nuevas escenas no agregan capas o activaciones a checkpoints. Upsampling intermedio y caminos residuales de la ruta registrada son arquitectura ilustrativa; miniaturas y valores finales conservan su origen real.
- No se portan entrenamiento, lecturas FITS/FIL ni inferencia entrenada interactiva. La evidencia entrenada LF fija se bloquea cuando un asset falla; HF tiene un generador determinista separado, no un fallback de sus trazas. Cambiar caso retira resultados incompatibles. Alternativas LF permanecen toy independientes.
- `src/math/model.ts` separa identidades fisicas y operadores de las unidades graficas. Los ejemplos de voltaje/FFT son normalizados: no se inventan V, Jy ni una frecuencia de muestreo calibrada.
- El foco matematico modifica materiales, guias y uniforms, nunca valores cientificos. Sus IDs se comprueban contra escenas originales, cosmicas y de metodos.
- La construccion progresiva reproduce escrituras preparadas. LF acumula exposicion y escribe ensayos DM/tiempo; HF integra por ruido y escribe anchuras/tiempo. Ningun cursor es una nueva muestra observada ni una nueva inferencia.
- Solo ALMA HF usa correlador paralelo de producto conjugado/promedio y suma coherente de voltajes alineados. Arecibo LF es un reflector con siete haces, sin esas dos fases del arreglo.
- El inventario cosmico LF [host observado100, IGM280, halo50, disco70] suma500 por eleccion didactica. No convierte DM en distancia. Host local130 usa `1/(1+0.3)` una vez; IGM ya es observado. HF conocida1770 no recibe esos terminos extragalacticos.
- Polarizacion de Jones, Stokes y RM es ilustrativa e independiente del waterfall. La convencion de V y el signo de campo paralelo se explicitan. RM gira orientacion, no sustituye retardo de DM.
- Elegir clasificador LF noResNet no invalida retrospectivamente los datos comunes LF. Cambia la rama posterior y su final. Nunca atribuir votos, atencion o softmax didacticos a CenterNet/ResNet. Cambiar a HF reemplaza tambien el fixture y el recorrido.
- Seleccionar ResNet despues de Boxcar/Transformer no permite mostrar la traza registrada: su recorte exacto no existe para esa ruta. `resnet-didactic` muestra una suma residual de longitud8 con pesos publicados, sin logits entrenados.
- Transformadores de ejemplo no son detectores FRB entrenados: sus cajas son esquematicas, sin score y sin transformacion DM-tiempo. Random Forest es evaluacion de tres arboles manuales, no bosque ajustado con bootstrap.
- El perfil sinusoidal Boxcar usa normalizacion simbolica sigma1; no simula ruido blanco independiente y no produce significancia estadistica calibrada. El banco6 no replica todas las anchuras, DM, mascaras ni agrupamiento PRESTO.
- `candidate-didactic` LF omite scores y propiedades astrofisicas nuevas. Solo LF CNN/ResNet conserva `candidato`, recorte/hash, decode y logits exactos. HF final usa SNR propio, umbral>=6 y DM no resuelta, nunca aquellos logits.
- El movimiento fino controla la fraccion de escena y su escritura, no dt, velocidad de luz, tiempo de vuelo ni latencia de inferencia. Cambiar ritmo no cambia entrada, salida o unidades.

Guion de nuevas rutas: [STORYBOARD](STORYBOARD.md). Limites completos: [METHODS](METHODS.md), [COSMIC_SOURCES](COSMIC_SOURCES.md), [SCIENCE](SCIENCE.md).

Cambios visuales requieren regenerar posters. Cambios en evidencia requieren reexportar, validar hashes y repetir las pruebas antes de servir la nueva entrega.
