# FRB Atlas: Evidencia Cientifica

FRB Atlas separa ilustraciones fisicas, **dos fixtures sinteticos** y metodos didacticos. LF/Arecibo conserva semilla `241032`, datos fijos e inferencia precalculada de checkpoints DRAFTS; solo CNN seguida de ResNet admite esa traza. HF/ALMA usa semilla `17452900`, un pulso galactico inspirado en un magnetar y busqueda SNR propia, sin inferencia entrenada. Ninguno representa una observacion ni un FRB confirmado. Alternativas y caso HF no heredan scores o logits LF. Configuracion, instrumentos, reglas y fuentes: [OBSERVING_CASES.md](OBSERVING_CASES.md).

## Relato Global Y Rutas

`src/routes.ts` compone rutas por caso y metodo. LF inicia con CNN/ResNet, 27 fases; Boxcar/inspeccion radio es opcional, 23. HF conserva 18 fases propias y banco boxcar: no pasa por Bow Tie, CenterNet ni clasificacion entrenada. El catalogo original de 24 operadores es referencia, no posiciones globales. La procedencia se asocia a caso e IDs.

LF incorpora anfitriona, IGM, entrada en la Via Lactea, polarizacion y llegada al Arecibo historico. HF nace dentro de la Via Lactea y llega a ALMA: no inventa anfitriona extragalactica, IGM ni redshift. Galaxias, progenitores, distancia y polarimetria no se infieren de los fixtures. La categoria FRB no impone un origen exclusivamente extragalactico; tampoco convierte un pulso de magnetar en FRB. Fuentes y convenciones: [COSMIC_SOURCES.md](COSMIC_SOURCES.md).

En LF, `metodos` distingue deteccion y clasificacion. Boxcar, inspeccion radio, arboles y Transformers visuales usan ejemplos fijos publicados. CNN mantiene CenterNet registrado. ResNet conserva su traza solo tras el mismo detector e input verificado; despues de otro detector muestra un residual didactico. Los otros pares terminan en `candidate-didactic`, sin score entrenado ni confirmacion. En HF, `hf-candidato` presenta su propio resultado SNR, DM no resuelta y ausencia de clasificacion entrenada. Contratos: [METHODS.md](METHODS.md).

El avance fino y la velocidad del transporte controlan la animacion, no el tiempo de viaje, la duracion de una muestra ni latencia computacional. Un toque cambia 0.0125 fases; mantener una flecha aplica la velocidad elegida en fases/s tras 250 ms. Scroll horizontal acumula un destino continuo con respuesta exponencial de constante 65 ms, sin sobrepasarlo; 65 ms no es la duracion total de una transicion. Invertir direccion descarta el impulso pendiente. Scroll vertical, entrada tactil, controles de posicion, cambio de ruta, apertura de evidencia, perdida de foco y pestaña oculta cancelan ese avance. El barrido de DM y los terminos matematicos permanecen ligados al mismo progreso reversible de presentacion.

La camara LF entra desde el halo al disco y a la vecindad solar; HF situa su origen galactico sin una entrada desde el IGM. `tierra` desciende hacia Puerto Rico/Arecibo o Chile/Chajnantor segun caso. `cameraAt(operation)` interpola posiciones y objetivos con smoothstep dentro del recorrido horizontal; retroceder recupera el encuadre. No reconstruye distancias astronomicas. Movimiento reducido fija la salida sin viaje de camara.

## Operadores Registrados

El catalogo original separa 24 fases: `faro, pulso, vuelo, plasma, antenas, fase, suma, receptor, fft, potencia, matriz, bloques, alineacion, perfil, bowtie, rgb, backbone, upsampling, cabezas, centernet, recorte, resnet, decision, candidato`. Cada operador termina antes de la entrega horizontal a la siguiente representacion. Las escenas cosmicas y las ramas de metodos se intercalan por ID. Scroll controla tiempo de presentacion, **no tiempo fisico ni ejecucion de inferencia**.

En el catalogo original, fases 1-10 son ilustrativas y 11-24 presentan evidencia LF fija. Las numeraciones no se aplican a las rutas actuales. La frontera `potencia` -> `matriz` no implica que voltajes/ADC/FFT produjeran el waterfall. LF no incluye `fase`/`suma`: Arecibo es un reflector, no un arreglo de siete platos. En HF esas fases explican phasing de ALMA y suma coherente de campo, no dedispersion ni suma de intensidades. LF `perfil`/`bowtie` conservan media por exposicion valida; `cabezas` y `decision` mantienen valores exactos de la traza LF. Interfaces: [STORYBOARD.md](STORYBOARD.md).

`perfil` muestra 2048 valores de la fila 47 del primer plano DM-tiempo, a una hipotesis DM 494.7368469 fijada para ilustrar la busqueda. No es SNR ni transforma el recorte localizado en entrada del detector. Los shifts se derivan de esa DM, los centros de canal y el dt; no se leen del recorte de una etapa posterior. La coincidencia con la estimacion final no adelanta su seleccion. El asset `profile.f32` permanece como evidencia distinta: 512 valores SNR del recorte candidato, apropiados para comprobar la ficha final, no para generar el mapa DM-tiempo.

El extremo del perfil corresponde a su ultima muestra: `(2048-1)*0.001 = 2.047 s`. La duracion de la ventana es distinta: `2048*0.001 = 2.048 s`. No se rotula el borde de la ventana como si fuera el centro de su ultima muestra.

En plasma, todos los paquetes usan un reloj comun menos su retardo fisico. La salida sostenida mantiene las frecuencias bajas detras de las altas; no colapsa las posiciones por saturar relojes independientes. Desplazamiento, distancia, escala y velocidad de la escena siguen siendo cinematograficos.

Temporalidad de presentacion: operador 0.08-0.56 del tramo local, salida sostenida 0.56-0.72, entrega 0.72-1; smoothstep limitado. Retardo de plasma, instante candidato, indice del perfil y anchuras de filtro conservan sus unidades cientificas independientes de ese reloj visual.

En LF, ADC/FFT/potencia usan arrays ilustrativos exportados y `requiresEvidence` comienza en `receptor`; la precarga empieza en antenas. Un error no permite sustituir otro ejemplo por evidencia verificada. HF no carga esos resultados como traza cientifica propia. Su suma coherente usa seis ramas normalizadas v/6 y salida v, no una ganancia fisica de seis ni visibilidades sumadas.

## Ecuaciones Y Escena

Todas las escenas de cada ruta tienen ecuaciones accesibles y unidades. Antes del cierre, la seleccion de terminos usa IDs compartidos entre catalogo matematico y escena; modifica su foco grafico, no su entrada ni resultado. Los terminos automaticos siguen la operacion normalizada. Un foco manual se mantiene hasta restaurar el modo automatico o cambiar de fase. En el cierre, los plots reemplazan el panel matematico izquierdo; la ecuacion completa y sus unidades siguen disponibles en el dialogo accesible de evidencia. La repeticion de ocho segundos es un reloj de presentacion, no un tiempo de vuelo, integracion o inferencia.

Las formulas dentro de la escena son sprites de texturas Canvas con integrales, fracciones, indices, exponentes y conjugacion colocados tipograficamente. `src/cinema/formulaSprite.ts` define un vocabulario finito, no un parser TeX ni texto ASCII que pretenda una formula. Cada sprite conserva su expresion TeX de referencia. Las ecuaciones accesibles del panel y dialogo usan KaTeX; el raster 3D no sustituye esa representacion semantica.

DM integra densidad electronica por distancia (`pc cm^-3`). El plasma ilustra contribuciones de columna y retrasos relativos proporcionales a `DM * (nu^-2 - nu_ref^-2)`. El helper mantiene MHz y segundos, con constante 4148.808. Las escalas visuales no establecen una densidad medida ni una distancia del evento sintetico. Fuente primaria: [NRAO, pulsars and dispersion](https://www.cv.nrao.edu/~sransom/web/Ch6.html).

Solo LF usa el inventario `DM_MW,disk + DM_MW,halo + DM_IGM + DM_host,rest/(1+z)`. La ilustracion fija `z=0.3`, anfitriona local `130`, IGM `280`, halo `50` y disco `70 pc cm^-3`: anfitriona observada `100`, columna pregalactica `380` y total `500`. Entre centros extremos, los retardos son `0.470892947 s` antes de la Via Lactea y `0.619595983 s` en Tierra. No es una medicion ni una distancia inferida. IGM ya esta en marco observado; la integral usa `n_e/(1+z)` y longitud propia, sin doble correccion. HF conserva DM conocida/inyectada `1770 pc cm^-3` dentro de un trayecto galactico, sin inventar esa descomposicion ni aplicar redshift. Fuentes LF: [Niu et al. 2022](https://www.nature.com/articles/s41586-022-04755-5), [Ioka 2003](https://arxiv.org/abs/astro-ph/0309200), [COSMIC_SOURCES](COSMIC_SOURCES.md).

El campo viaja en `+x` y oscila en el plano transversal `y,z`. El vector de Jones ilustrativo `(1,-0.32i)` produce Stokes normalizados con `V=2 Im(E_y conj(E_z))`; su intensidad `1.1024` no mide flujo en Jy. La pantalla externa usa `chi=chi0+RM lambda^2`, `chi0=0.16 rad` y `RM=24 rad m^-2`. Preserva `I,V` y rota `Q,U` por el doble del angulo. RM integra densidad electronica y campo paralelo, puede tener signo y no es DM ni controla retrasos de llegada. Ningun Stokes, RM o angulo se atribuye al fixture. Convencion y unidades: [NRAO, polarization](https://www.cv.nrao.edu/~sransom/web/Ch2.html#Ch2.S3), [Faraday](https://www.cv.nrao.edu/~sransom/web/A4.html).

La Tierra conserva llegadas ordenadas por frecuencia y orientacion transversal. NASA Blue Marble muestra geografia optica, no brillo de radio. LF desciende al Arecibo historico: un reflector esferico de `305 m`, radio `265.176 m`, plataforma suspendida y siete haces ALFA, en `18.34422,-66.7527` grados. HF desciende a Chajnantor en `-23.029,-67.755` grados y unos `5000 m`: seis platos didacticos de `12 m`, focal primaria `4.8 m`. No son siete antenas Arecibo ni una replica medida de ALMA. Terrenos, escala y layout son ilustrativos; los fixtures no fueron adquiridos por ese hardware. Fuentes y limites opticos: [OBSERVING_CASES](OBSERVING_CASES.md); atribucion NASA: [COSMIC_SOURCES](COSMIC_SOURCES.md).

El arreglo ALMA HF asocia baseline/direccion con `tau = b dot s / c`: `b=r_j-r_i`, propagacion `s` hacia la derecha y `tau=t_j-t_i`. El correlador `V_ij = mean(v_i * conj(v_j))` es una rama paralela; la suma coherente recibe voltajes alineados, no visibilidades ni intensidades. Los voltajes son analiticos normalizados, no IQ del fixture; el producto no se rotula Jy. El signo depende de convencion de baseline/direccion. Esta arquitectura no se aplica al reflector unico Arecibo LF.

ADC, Hann y FFT usan 64 muestras y 4 bits. Sin una frecuencia de muestreo calibrada en metadata, se muestran indice de bin y ciclos por muestra, no Hz absolutos. Las bases resaltadas son los bins 5 y 13 del ejemplo exportado; Hann y cuantizacion introducen otras componentes. La potencia exportada conserva `abs(FFT)^2 / 64^2`, en unidades normalizadas. Tampoco se presentan voltios fisicos o un flujo calibrado.

La construccion de plots reproduce valores preparados de forma reversible. Cursores marcan escrituras discretas, no adquisicion. En LF, perfil de busqueda 2048 y mapa DM conservan media por exposicion; SNR final 512 pertenece al recorte ya localizado. En HF, perfil SNR 128 y banco anchura-tiempo provienen de su fixture propio: no se fabrican filas DM. La seleccion matematica no cambia logits ni entrada. Alternativas LF usan `src/methods/math.ts`, independientes de ambos fixtures.

## Cierre Con Plots Vinculados

El cierre se centra en un ancho maximo de 1120 px, sin sidebar. El titulo **Candidato detectado** describe deteccion, no confirmacion; ambos casos conservan `data-confirmation="not-confirmed"` y la nota **Para confirmar: descartar RFI y contrastar evidencia astronómica independiente.** El menu Ruta permite volver a fases anteriores sin alterar datos o procedencia.

`src/finale/FinalePanel.tsx` para LF y `src/hf/HFFinalePanel.tsx` para HF construyen tres Canvas: perfil SNR con ventana, mapa de busqueda y frecuencia-tiempo. LF registrado usa Bow Tie/recorte; LF alternativo, arrays toy; HF, banco **anchura-tiempo** y waterfall residual propio. Progreso publica puntos/celdas; retroceder retira las mismas escrituras. La salida aparece desde `operation=0.88`, sin inventar clase entrenada HF. Arrays y rasters se preparan una vez por modelo.

Solo **LF CNN/ResNet** usa `profile.f32`, el recorte original dedispersado y un slice temporal de `dm-map.f32`. Las 512 muestras tienen centros absolutos `0.295..0.806 s`; limites de bins `0.2945..0.8065 s`. Ambos rasters usan esos limites y cursor en el centro correcto. Mapa: 96 DM; recorte: 64 centros MHz. Pico SNR `0.554 s` y centro CenterNet `0.5512215728759766 s` tienen marcadores distintos. `W=14` cubre muestras `0.547..0.560 s`, soporte `0.5465..0.5605 s`. `np.convolve(..., mode="same")` para anchura par incluye siete muestras previas y seis posteriores; indice no equivale al centro geometrico.

Click y arrastre comparten un cursor temporal entre los tres plots. LF permite elegir fila DM; HF elige fila de anchura, con unidades ms. Flechas izquierda/derecha mueven una posicion del perfil; arriba/abajo cambian fila; Home y restaurar recuperan la seleccion inicial. Elegir otra fila no recalcula SNR ni dedispersa: los valores mantienen su procedencia. La seleccion busca la coordenada temporal mas cercana, sin presuponer indices uniformes.

Otros pares de metodos **LF** muestran `TOY_PROFILE`, `TOY_MAP` y `TOY_CROP`, ejemplos publicados independientes. El banco toy utiliza ventanas completas y conserva el centro de la anchura ganadora: centros enteros con anchura impar y medio bin con anchura par. Por ello sus tiempos pueden variar en pasos de `0.5`, `1` o `1.5 ms`; el cursor usa esos tiempos efectivos. Su maximo tiene `W=8`, centro `30.5 ms` y soporte `26.5..34.5 ms`. Mapa y recorte toy tienen 16 columnas, centros `2..62 ms` y limites `0..64 ms`; sus coordenadas DM y canales son ilustrativas. Votos forest usan su vector fijo, softmax Transformer usa `TOY_CROP` y el residual no infiere clase. Los selectores estan en `metodos`, no en el cierre. Ninguno de estos arrays sustituye el fixture HF.

## Regimen Y Busqueda HF

`src/observations.ts` aplica el criterio del backend: `R_search=Delta t(DM_max)/dt_effective`; HF si `R_search < 2`, igualdad LF. La configuracion HF usa `DM_max=3000`, centros `85.29925..87.23675 GHz`, `dt_native=32 microsegundos` y suma temporal 128, de modo que `dt_effective=4.096 ms` y `R_search=0.018344957066`. El retardo del pulso conocido a DM 1770 es otra cantidad: `44.333157 microsegundos`, o `q_known=0.010823525` muestras efectivas. No usar DM conocida en lugar de DM maxima para justificar la ruta. Sin downsampling, `R_search=2.348155` seleccionaria LF.

El backend omite el cubo DM con el criterio distinto `Delta t(DM_max-DM_min)/dt_effective < 1`. Un cubo placeholder no demuestra un Bow Tie. Aqui todos los shifts efectivos redondeados son cero: el detector HF no estima DM. El estado backend `NaN/unresolved_high_freq` se representa con `null`, `dmResolved=false` y el valor conocido separado; nunca se llama DM cero a la falta de resolucion. Referencias y limites: [OBSERVING_CASES](OBSERVING_CASES.md).

`src/hf/model.ts` construye una sola vez un waterfall residual `[128,32]`, semilla 17452900, FWHM intrinseca 20 ms e intensidad normalizada sin fondo. Importa read-only `computeSNR`, `channelShifts` y helpers fisicos del Explorer. El SNR usa pesos, detrending y normalizacion robusta del port existente. Banco `[1,2,3,5,8,15]` muestras, convolucion `same`, coeficientes float32 y ceros de borde; anchuras pares conservan su asimetria original, no el centro geometrico del banco toy LF.

El maximo sintetico HF es `9.6916513443` en `249.856 ms`, `W=5` o `20.48 ms`. La seleccion exige ventana completa y `SNR >= 6`; igualdad acepta. Los centros temporales son `0..0.520192 s`, limites de bins `-0.002048..0.522240 s`. El banco es anchura-tiempo `[6,128]`, no DM-tiempo. Tres plots conservan este dominio, datos y marcadores al retroceder. No existe score CNN, logits, clase entrenada ni confirmacion astrofisica HF; el backend podria clasificar por ResNet, pero la app no dispone de una traza HF compatible.

## Inspeccion Grafica 3D

Rotate3D activa OrbitControls en escenas de datos compatibles: matrices, perfiles, Bow Tie, recortes, tensores y operadores HF. El canvas se centra; progreso y movimiento ambiental quedan quietos. Rotacion, pan y zoom inspeccionan la misma representacion, con mouse/touch y foco de teclado. Las vistas frontal/lateral/superior/perspectiva cambian camara, no ejes cientificos ni entradas. Lateral y superior usan componente z de 0.35 para conservar visibilidad cuando el relieve es cero.

`Relieve normalizado (u.a.)`, limitado a 0..3, cambia exclusivamente el uniform GPU `uLift`. No calibra amplitud, reconstruye un tensor ni altera arrays, hashes, seleccion o inferencia. Restaurar en la UI recupera perspectiva y relieve 1 u.a.; salir restaura valores visuales narrativos. Escape, cambio de fase/caso o perdida de WebGL cierran inspeccion. Los tres plots finales permanecen 2D y mantienen sus vinculos. Contrato: `src/cinema/plotInspection.ts` y `src/cinema/World.ts`.

## Alternativas Didacticas LF

Boxcar usa `rho_W[n]=sum(x[n+k]-mu)/(sigma sqrt(W))` sobre ventanas completas, sin wrap. El denominador corresponde a muestras de ruido blanco independiente; el fondo sinusoidal fijo del ejemplo solo ilustra fluctuaciones, no una realizacion de ese supuesto. No se presenta su SNR como significancia calibrada. El banco de seis anchuras, el umbral y los picos explican pasos de busqueda. No implementan detrending, mascaras, normalizacion por chunk, todas las DM ni agrupamiento de [PRESTO](https://github.com/scottransom/presto/blob/master/bin/single_pulse_search.py).

Los Transformers usan parches 4x4 de mapas/recortes esquematicos 16x16, 16 tokens y dimension 4. La atencion real `softmax_rows(QK^T/sqrt(4))V` se calcula con proyecciones analiticas publicadas, no pesos aprendidos. Cada fila softmax suma uno. La cabeza de deteccion es solo un contrato con cajas dibujadas a mano, sin score ni conversion DM-tiempo. El clasificador de ejemplo aplica media, cabeza fija 4x2 y dos salidas softmax; ninguna es probabilidad astrofisica. ViT original no define por si mismo un detector de FRBs ni prueba que atencion sea explicacion causal.

La opcion Random Forest ilustra evaluacion de tres arboles y fraccion de votos con reglas escritas a mano. No afirma entrenamiento con bootstrap o seleccion aleatoria de rasgos. Cada caracteristica conserva unidades; el vector fijo `[8,6 ms,500 pc cm^-3,0.75]` no se extrae del candidato real. Inspeccion radio enlaza ley dispersiva y contexto, sin estimar una DM galactica desde un dibujo. ResNet tras un detector incompatible muestra solo `ReLU(x+F(x))` de longitud ocho con kernel publicado. La ruta no usa logits registrados ni inventa checkpoint.

Fuentes, formulas completas, arrays y pruebas de operadores: [METHODS.md](METHODS.md). Los datos y hashes de las secciones siguientes corresponden **solo a la evidencia registrada LF**, no a las alternativas ni al fixture HF.

## Evento Y Candidato LF Registrados

| Cantidad | Verdad inyectada | Resultado del pipeline |
| --- | --- | --- |
| DM, pc cm^-3 | 500 | 494.7368469238281, fila 47 de la grilla real |
| Tiempo, s | 0.550 | CenterNet: 0.5512215728759766; muestra truncada 551 |
| Anchura | Pulso gaussiano: FWHM 6 ms | Boxcar maximo SNR: 14 ms, no estimacion directa de FWHM |
| SNR | No se impone | 67.82168579101562, calculado en el recorte candidato |
| Score del detector | No se impone | 0.804512083530426 |
| Logits del clasificador | No se imponen | [-29.15385627746582,28.75644302368164] |
| Softmax clase 1 | No se impone | 1.0 en la precision de esta inferencia; no probabilidad calibrada de origen astronomico |

El candidato procede de la caja de CenterNet con mayor puntuacion sobre el umbral estricto `>0.3`, tras NMS IoU 0.3. Su DM **no se reemplaza por la verdad** del generador. Se exportan `peak`, `offset`, `size`, `centerCNN` y `boxCNN` originales: no se reconstruye una caja desde DM redondeada.

El perfil de 512 muestras es la salida real `compute_snr_profile(originalCrop)`: SNR maximo sobre las anchuras `[1,2,4,6,9,14,20,30]` ms, no una curva de intensidad ni el perfil a DM 500. Su pico esta en el indice 259 del recorte, tiempo global `(295+259)*0.001=0.554` s. El pico SNR y la estimacion de CenterNet pueden diferir; no se alinean artificialmente.

## Unidades Y Operadores LF

- Waterfall:2048 muestras efectivas por64 canales, orden row-major `[tiempo,frecuencia]`, `dt=0.001s`. Banda con bordes1200-1600MHz; centros reales1203.125-1596.875MHz. La llegada de referencia del generador y del dedispersor usa el maximo **centro**, no el borde superior.
- Dispersion fria: `delay_s=4.148808e3 * DM * (nu_MHz^-2 - nu_ref_MHz^-2)`. Indices por redondeo ties-to-even, sin wraparound. El nombre historico Python `K_DM_MS` produce segundos con MHz; no se introduce otro factor1000.
- El cubo original es `[3,96,2048]`. Se exporta solo su primer plano, media de canales con exposicion valida. Los otros planos originales son canal posicional intermedio y diferencia, no tres bandas fisicas. La grilla tiene96 DM float32 entre0 y1000.
- El generador integra cada muestra temporal y aproxima el ensanchamiento intracanales por una gaussiana de igual varianza; no simula voltajes nativos completos. Amplitud8 y ruido sigma1 describen bins efectivos. La convencion del reductor original suma tiempo y promedia polarizacion/frecuencia, descartando colas incompletas. Aqui los factores son1.
- Recorte dedispersado real:512x64, DM494.7368469, inicio295, retardos de0 a613 muestras, sin padding. Cada celda corresponde exactamente a `waterfall[start+t+delay[channel],channel]`.
- Preprocesado clasificador: recorte preparado `[1,512,64]`; input real del modelo `[1,1,512,64]`. No se fuerza un cuadrado ni un sigmoid binario unico: ResNet18, GAP512, Linear2 y softmax2.
- Preprocesado detector: plano DM-tiempo normalizado, resize512x512, clipping percentiles0.1/99.9, cmapmako RGB y normalizacion ImageNet. `rgb.u8` deshace la normalizacion del tensor float32 real, conserva RGB y cuantiza al entero8bit mas cercano. Es una visualizacion, no el tensor flotante que consumio la red. Las tres etapas Up usadas aqui aplican bilinear `align_corners=True`, seguido de Conv2d/BatchNorm/ReLU; no ConvTranspose. Los shortcuts residuales pertenecen a BasicBlocks compatibles, con proyeccion cuando cambia forma, no a un bypass global entre tensores64 y512 canales.
- Coordenadas del detector: mapa128x128, imagen512x512. DM se selecciona sobre la grilla con denominador `H-1`; tiempo usa `slice_len/W` y trunca para el indice. La caja float32 almacenada puede diferir unos pocos micro-pixeles de recalcular offsets con aritmetica float64.

## Streaming LF Y Adquisicion Ilustrativa

La resolucion cientifica se conserva completa en texturas nearest y colores muestreados por fragmento. Solo el relieve 3D usa256 segmentos por fila: la altura entre vertices se interpola con fines graficos, no representa un nuevo dato ni downsampling cientifico. Cada fila mantiene su propio retardo sin interpolar entre canales. El waterfall y mapa pasan de524288/786432 a32896/49344 vertices, respectivamente; los arrays, hashes y outputs de redes permanecen intactos.

El contexto exportado es `1239+30=1269` muestras: maximo desplazamiento cuantizado a DM1000 mas la mayor anchura boxcar. No se reutiliza el overlap160 del preset, insuficiente para dedispersion completa. Ventanas validas semiabiertas `[start,end)` cubren cada muestra exactamente una vez; bloques incorporan contexto lateral y se recortan en los extremos de la observacion. El contexto es conservador: se incluye la anchura completa, no solo medio kernel.

Esta secuencia muestra ventanas de **un array precalculado**; no afirma ejecutar lectura de archivos FITS/FIL en el navegador. La igualdad de estimadores de ruido normalizados por chunk no se presupone: la normalizacion depende del bloque.

Voltajes/ADC/FFT son una muestra **ilustrativa separada**:64 valores, ADC4bit saturado a[-1,1], ventanaHann y FFT real con `fft.js`; potencia `(|Re|^2+|Im|^2)/64^2`. No son voltajes recuperados del waterfall, una simulacion de hardware ni una observacion adicional. Las etapas de fuente/propagacion representan mecanismos fisicos, no identifican el progenitor de un FRB observado.

## Activaciones Reales LF

| Snapshot | Tensor original | Valores mostrados |
| --- | --- | --- |
| detector-base_model-0-1 | [1,64,256,256] | Canal0, media espacial24x24 |
| detector-up3-1 | [1,256,128,128] | Canal0, media espacial24x24 |
| detector-sigmoid | [1,1,128,128] | Heatmap real final, media espacial24x24 |
| classifier-base_model-conv1-1 | [1,64,256,32] | Canal0, media espacial24x24 |
| classifier-base_model-layer4-1 | [1,512,16,2] | Canal0 completo16x2 |
| classifier-base_model-avgpool-1 | [1,512,1,1] | Canal0, un valor |
| classifier-base_model-fc-1 | [1,2] | Dos logits completos |
| classifier-gap-vector | [1,512] | Todos512 valores exactos a la entrada de Linear |

Los hooks CPU clonan valores antes de operadores in-place. Las miniaturas usan `adaptive_avg_pool2d` y no son tensores intermedios completos ni permiten ejecutar la red. El vectorGAP procede del pre-hook de Linear, no de ampliar una miniatura1x1. Las tres cabezas del detector se representan como arquitectura; sus valores locales de la deteccion provienen del decode real, sin inventar mapas WH/offset completos.

## Archivos Y Hashes LF

Commit del codigo Python y de las trazas: `04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3`.

| Asset | Forma y tipo | Bytes | SHA-256 |
| --- | --- | --- | --- |
| waterfall.f32 | [2048,64], float32LE | 524288 | 4509c6a07c7c8eaddba285b1c5167a585926d70e188d6c001515bcd5037fe90f |
| dm-map.f32 | [96,2048], float32LE | 786432 | 12d42a1c9c347f584e72bf691a0406f9917adcc32de2b3fbea3d22fe42640fa5 |
| original-crop.f32 | [512,64], float32LE | 131072 | df81abd1d76a9c89a5b53794ad952d7d2b156d4db8783c469572abcaf3bd8432 |
| prepared-crop.f32 | [1,512,64], float32LE | 131072 | 5edba0a4c3eed7c93ab23126517cf7055cff27ed1ed5f565b60fc082b0532e92 |
| profile.f32 | [512], float32LE | 2048 | 3f8ca4e6cb9131455331be08152e9c7f7a4b45652b544babe17b8f52b8c32f0d |
| rgb.u8 | [512,512,3], uint8RGB | 786432 | 97e626091d3a877041b0685a15a0586269567eae6f45c738505fdf7ee1d81ced |

Binarios:2361344bytes. Metadata `event.json`:69691bytes en este export. No se copian el JSON de input15MB ni checkpoints a esta app. Hash del tensor real del detector `[1,3,512,512]`: `7939f4876d300683aad71ae5e9ed595bb429926518aa65bca076ebb94b903996`; el preprocesado Python regenerado lo verifica antes de exportarRGB. Hash de la entrada real del clasificador igual a `prepared-crop.f32`, ya que agregar el batch de dimension1 no cambia bytes.

Pesos originales, solo usados en la inferencia precalculada: detector `85c97ce654222410ff1f581e80302ebddfe3479f65bcb03a867068c9806d650f`; clasificador `2c9c6b4b990596bd07ddfb5527c21cd689247d5026b2815bd1b6ce5294e66cc6`.

## Regeneracion Y Carga LF

Desde `web/frb-cinematic`, ejecutar `npm ci` y `npm run export:evidence`. El exportador importa **solo offline, read-only** los operadores del Explorer original; necesita `npm ci` previamente en `web/frb-explorer`. El build incorpora su helper puro de dispersion sin editarlo ni importar la UI anterior. La entrega estatica compilada no necesita servir ni instalar el Explorer.

Python por defecto: `web/frb-explorer/.venv-traces/Scripts/python.exe`, o variable `DRAFTS_EVIDENCE_PYTHON`. Entorno verificado:Python3.12.10, NumPy2.4.6, PyYAML6.0.3, OpenCV4.13.0.92, Matplotlib3.10.8 y Seaborn0.13.2, con dependencias transitivas. No se requieren Torch ni checkpoints **para este nuevo export**, que lee las trazas reales existentes; regenerar esas trazas completas requiere su entorno original de inferencia. El auxiliar importa `compute_snr_profile` y `preprocess_img` reales, sin mocks y sin modificar backend ni Explorer.

`loadEvidenceMetadata` carga y valida metadata sin descargar tensores. `loadEvidenceArrays` descarga los seis binarios cuando la experiencia los necesita; `loadEvidence` combina ambas operaciones. Se validan formas, dtypes, bytes, hashesSHA-256, valores finitos, coordenadas, softmax, cobertura/contexto y procedencia. Los float32 se decodifican explicitamente little-endian. Un error o abort rechaza la carga; fallar un asset cancela solicitudes hermanas. El consumidor debe desechar respuestas de una carga antigua, nunca conservar arrays de otro evento como si fueran actuales.

Pruebas de evidencia: `npm test -- tests/evidence.test.ts`. Incluyen hashes, endian, copia completa del recorte, decode, perfil SNR, snapshots/vectorGAP, contexto y reconstruccion completa/chunks en tres DM, metadata diferida, archivos corruptos/truncados, NaN, HTTP y abort. Los gates globales de interfaz/rendimiento pertenecen a la validacion final; no se deducen de estas pruebas.

## Fuentes Primarias

- Plasma frio, retraso y dispersion intracanales: [NRAO, Essential Radio Astronomy, capitulo6](https://www.cv.nrao.edu/~sransom/web/Ch6.html).
- Contexto FRB, dispersion y diversidad temporal: [Petroff, Hessels y Lorimer2019, seccion2](https://ned.ipac.caltech.edu/level5/March19/Petroff/Petroff2.html).
- Operadores del pipeline: [physics.py](https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/domain/physics.py), [dedispersion.py](https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/preprocessing/dedispersion.py), [snr_utils.py](https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/analysis/snr_utils.py), [dm_candidate_extractor.py](https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/preprocessing/dm_candidate_extractor.py).
- Modelos usados: [DRAFTS, Zhang et al.2024](https://arxiv.org/abs/2410.03200), [CenterNet:Objects as Points](https://arxiv.org/abs/1904.07850), [ResNet:Deep Residual Learning](https://arxiv.org/abs/1512.03385). La arquitectura concreta y los checkpoints de este fork mandan sobre diagramas historicos o cambios del upstream.
- Preprocesado concreto: [preprocess_img](https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/visualization/visualization_unified.py#L38), [model_interface.py](https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/detection/model_interface.py).
- Promedio espacial y softmax: [PyTorch2.11 adaptive_avg_pool2d](https://docs.pytorch.org/docs/2.11/generated/torch.nn.functional.adaptive_avg_pool2d.html), [Softmax](https://docs.pytorch.org/docs/2.11/generated/torch.nn.Softmax.html). FFT ilustrativa: [fft.js del autor](https://github.com/indutny/fft.js).
- Rutas extragalacticas, inventario DM, Faraday y geografia terrestre: [COSMIC_SOURCES.md](COSMIC_SOURCES.md), con fuentes primarias y atribucion NASA.
- Boxcar/PRESTO, atencion escalada, Vision Transformer y arboles: [METHODS.md](METHODS.md), con fuentes primarias y limites de cada ejemplo.

Ningun fixture reutiliza datos observados de FETCH, CHIME, ALMA o FAST. Los articulos y geometria instrumental aportan referencias, no nuevos archivos adquiridos. PDFs privados y `ResultsThesis/Data` no se suministraron; no se atribuyen lectura, tasas reproducidas ni inferencias HF a esos archivos. La experiencia no cambia el Explorer original ni modulos Python. Fuentes observacionales y criterios backend: [OBSERVING_CASES.md](OBSERVING_CASES.md).
