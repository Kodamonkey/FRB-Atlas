# FRB Atlas: Storyboard Cinematografico

Del cosmos a una propuesta: **dos casos**, rutas dinamicas y camara continua. LF/Arecibo inicia con CNN/ResNet: 27 fases; Boxcar/radio opcional: 23; HF/ALMA clasico: 18. Cada fase pregunta, opera y conserva salida antes del avance horizontal. Texto breve; detalle en evidencia, [SCIENCE](SCIENCE.md), [COSMIC_SOURCES](COSMIC_SOURCES.md), [METHODS](METHODS.md) y [OBSERVING_CASES](OBSERVING_CASES.md).

## Contrato De Continuidad

- `faro` a `potencia`: fuente, campo, propagacion, polarizacion, Tierra e instrumento **ilustrativos**. LF incluye anfitriona/IGM y reflector unico Arecibo; HF nace en la Via Lactea y usa ALMA/phasing/suma. No reconstruyen observaciones ni voltajes de los fixtures. ADC/FFT siguen siendo ejemplos separados.
- `matriz` a `bowtie`: **un evento LF sintetico**, semilla 241032 y arrays exactos. El perfil sigue siendo media expuesta, no SNR. La identidad visual no cambia la procedencia de los siguientes ejemplos.
- Ruta **LF** CNN: CenterNet conserva activaciones precalculadas. Solo ResNet sobre su recorte exacto llega a la ficha registrada; verdad inyectada no reemplaza estimacion. Otros pares terminan con propuesta didactica, sin heredar scores/logits.
- `metodos` LF bifurca detector/clasificador; sus alternativas usan ejemplos publicados independientes. HF sigue `hf-resolution` a `hf-candidato`: residual 128x32, SNR y banco anchura-tiempo propios, DM no resuelta y sin clase entrenada.
- Frontera `potencia` -> `matriz`: **continuidad visual, no cadena instrumental simulada**. ADC/FFT de ejemplo no produjeron el waterfall sintetico.
- Scroll reversible presenta operaciones preparadas; no reejecuta busqueda, inferencia ni entrenamiento. Pausar movimiento ambiental no bloquea scroll.
- `stageTiming(local)` separa operacion y entrega: `operation=smoothclamp((local-0.08)/0.48)`, `handoff=smoothclamp((local-0.72)/0.28)`. Operador terminado en 0.56; salida sostenida 0.56-0.72; entrega horizontal 0.72-1. `smoothclamp` es smoothstep limitado a [0,1].
- Entradas/salidas visibles tienen 1-4 palabras. Continuidad literal de rotulos no equivale a continuidad instrumental entre ejemplo y dataset. La camara mantiene el resultado durante operacion y sosten, y acompana la entrega sin abandonar calculos incompletos.
- `galaxia` y `tierra` incorporan `cameraAt(operation)`. LF entra al disco y desciende a Puerto Rico/Arecibo; HF inicia dentro de la Galaxia y desciende a Chile/Chajnantor. Smoothstep y retroceso recuperan el encuadre, sin inferir distancia/tiempo fisicos.
- El cierre construye tres plots Canvas; ecuacion/unidades permanecen en evidencia. Tiempo y fila DM en LF, o anchura en HF, mueven marcadores vinculados sin nueva dedispersion o clasificacion.

## Actos Por Caso

| Acto | Fases | Cambio de representacion |
| --- | --- | --- |
| Origen | `faro`, `pulso` | Fuente compacta -> paquete de campo |
| Viaje | `anfitriona`, `vuelo`, `plasma`, `galaxia`, `polarizacion`, `tierra` | Anfitriona -> medio cosmico -> Via Lactea -> Tierra |
| Captura LF | `antenas`, `receptor`, `fft`, `potencia` | Reflector Arecibo/ALFA -> ADC -> FFT -> potencia de ejemplo; sin phasing de arreglo |
| Datos | `matriz`, `bloques` | Evento sintetico -> matriz -> bloques validos |
| Busqueda | `alineacion`, `perfil`, `bowtie` | Alineacion de prueba -> media expuesta -> DM-tiempo |
| Metodos LF | `metodos`, detector, clasificador, final | Operadores elegidos -> salida registrada o propuesta didactica |

La tabla anterior corresponde a LF. HF conserva seis grupos de navegacion, sin IGM ni seleccion de metodos LF; el ultimo presenta comprobacion clasica:

| Acto HF | Fases | Cambio de representacion |
| --- | --- | --- |
| Origen | `faro`, `pulso` | Magnetar galactico ilustrativo -> pulso, no FRB observado |
| Viaje | `galaxia`, `vuelo`, `plasma`, `polarizacion`, `tierra` | Interior galactico -> plasma -> Tierra/Chajnantor |
| Captura | `antenas`, `fase`, `suma`, `receptor`, `fft`, `potencia` | ALMA -> voltajes alineados/correlador paralelo -> suma -> adquisicion ilustrativa |
| Datos | `hf-resolution`, `hf-matriz` | Resolucion nativa/efectiva -> residual sintetico 128x32 |
| Busqueda | `hf-profile`, `hf-boxcar` | Integracion ponderada -> SNR/banco anchuras |
| Metodos | `hf-candidato` | Comprobacion clasica -> propuesta, DM no resuelta; sin selector neuronal |

Orden y navegacion provienen de [routes.ts](../src/routes.ts), con catalogos [story.ts](../src/story.ts) y [methods/catalog.ts](../src/methods/catalog.ts). Los inicios de actos se calculan sobre la ruta actual; no son indices fijos del catalogo original. Las tablas transcriben interfaces y criterios observables; no presuponen gates ejecutados.

## Catalogo Registrado Original

Los numeros pertenecen al catalogo original de 24 operadores, no a las posiciones actuales. Sus fases de datos/red son LF; `fase`/`suma` solo se incorporan al caso ALMA HF. Las nuevas escenas se intercalan por ID. Las filas instrumentales siguientes explicitan ambos casos para no atribuir el fixture LF a ALMA.

| Fase | Pregunta | Entrada | Operacion | Salida | Animacion | Interaccion | Fuente | Comprobacion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 `faro` | Que puede emitir radio? | Fuente | Emision | Campo | Rotacion, dipolo y haces como modelo visual | Scroll reversible; pausa; evidencia | [Escena fisica](../src/cinema/physicalStages.ts), [NRAO][nrao] | No identificar progenitor observado; fuente ilustrativa |
| 02 `pulso` | Que sale de la fuente? | Campo | Envolvente | Pulso | Portadora dentro de paquete; entrega tras sostenerlo | Scroll; evidencia | [Escena fisica](../src/cinema/physicalStages.ts), [Ciencia](SCIENCE.md) | Envolvente de campo no es intensidad; FWHM sintetica LF6 ms o HF20 ms |
| 03 `vuelo` | Que seguimos? | Pulso | Propagacion | Frente de onda | Paquete conserva identidad; fuente queda atras | Scroll reversible; pausa | [Guion](../src/story.ts), [escena fisica](../src/cinema/physicalStages.ts) | Distancia/duracion cinematograficas no infieren velocidad ni distancia astronomica |
| 04 `plasma` | Por que cambian las llegadas? | Frente de onda | Dispersion | Llegadas dispersas | Frecuencias bajas se retrasan respecto al maximo centro | Scroll; evidencia de unidades | [NRAO][nrao], [physics.py][physics] | Segundos con MHz; centros 1203.125-1596.875; referencia de retardo cero; sin factor 1000 adicional |
| 05 `antenas` | Como recibir? | Llegadas dispersas | Recepcion | Voltaje(s) | LF reflector unico/plataforma; HF seis platos didacticos | Scroll; calidad; pausa | [Instrumentos](OBSERVING_CASES.md), [Escena fisica](../src/cinema/physicalStages.ts) | ALFA7 haces no son7 platos; ALMA12m/focal primaria4.8m no produjo el fixture |
| 06 `fase` HF | Como hacer coincidir fases? | Voltajes por antena | Compensacion | Voltajes alineados | Oscilaciones se alinean; correlador forma rama paralela | Scroll; evidencia | [Escena fisica](../src/cinema/physicalStages.ts), [Ciencia](SCIENCE.md) | Solo ALMA; fase no es DM; correlacion no alimenta serialmente la suma |
| 07 `suma` HF | Que aporta combinar? | Voltajes alineados | Suma coherente | Voltaje combinado | Seis ramas normalizadas v/6 convergen a v | Scroll; pausa | [Escena fisica](../src/cinema/physicalStages.ts), [Ciencia](SCIENCE.md) | Solo ALMA; campo antes de potencia, sin visibilidades/intensidades sumadas |
| 08 `receptor` | Como digitalizar? | Voltaje recibido | Muestreo y ADC | Muestras | 64 valores, ADC4bit y saturacion[-1,1] | Scroll; evidencia | [Ciencia](SCIENCE.md), [escena fisica](../src/cinema/physicalStages.ts) | Ilustrativo separado; no cuantizacion real de ALMA ni voltajes del fixture |
| 09 `fft` | Como separar frecuencias? | Muestras | Ventana y FFT | Canales complejos | Vector temporal cambia a bins espectrales mediante Hann y FFT 64 | Scroll; evidencia | [fft.js][fft], [Ciencia](SCIENCE.md) | Bins ilustrativos no son centros MHz de banda LF; operadores/export reales |
| 10 `potencia` | Que representa intensidad? | Canales complejos | Potencia y acumulacion | Intensidad | Barras (Re^2+Im^2)/64^2 conservan resultado; acumulacion ilustrativa | Scroll; evidencia de frontera | [fft.js][fft], [Ciencia](SCIENCE.md) | No afirmar que el ejemplo genera el waterfall siguiente |
| 11 `matriz` | Donde queda el evento? | Intensidad | Indexacion | Waterfall | Nuevo dataset sintetico declarado; celdas con valores reales | Scroll; evidencia; actos | [Escena de datos](../src/cinema/dataStages.ts), [Ciencia](SCIENCE.md) | Frontera declarada; hash 4509c6...; 2048x64; dt 1 ms; row-major [tiempo,frecuencia] |
| 12 `bloques` | Que vecinos conservar? | Waterfall | Streaming | Bloque con contexto | Nucleos y vecinos distintos antes de entrega | Scroll; evidencia | [Dedispersion][dedispersion], [Ciencia](SCIENCE.md) | Contexto 1269=1239+30, no 160; ventanas semiabiertas; cobertura una vez; no lector FITS/FIL |
| 13 `alineacion` | Que DM concentra? | Bloque con contexto | Desplazamientos DM | Canales dedispersados | Tiras se desplazan a hipotesis DM 494.7368469 con shifts 0..613 | Scroll reversible; evidencia | [Dedispersion][dedispersion], [Ciencia](SCIENCE.md) | Sin wrap, ties-to-even; DM fijada para ilustrar, no seleccion anticipada ni verdad 500 |
| 14 `perfil` | Que deja esa hipotesis? | Canales dedispersados | Media expuesta | Perfil | Aparece vector de 2048 valores de fila 47 | Scroll; evidencia de primer plano | [Dedispersion][dedispersion], [Ciencia](SCIENCE.md) | Exactamente fila 47 de DM-map; no SNR, boxcar ni perfil del crop 512; mismas unidades |
| 15 `bowtie` | Que revela barrer DM? | Perfil | Barrido DM | Mapa DM-tiempo | Cada prueba aporta una fila; 96 DM entre 0 y 1000 | Scroll; evidencia | [Dedispersion][dedispersion], [extractor][extractor] | Forma 96x2048; primer plano cientifico, no heatmap CNN; exposicion valida |
| 16 `rgb` | Que consume CenterNet? | Mapa DM-tiempo | Preparacion RGB | Tensor RGB | Normalizar, resize, clipping, mako e ImageNet offline; entrada 512x512 | Scroll; evidencia del input | [Preprocesado][preprocess], [Ciencia](SCIENCE.md) | RGB no son tres planos cientificos; u8 visualiza input float32 NCHW verificado |
| 17 `backbone` | Como extraer rasgos? | Tensor RGB | Backbone | Caracteristicas | Formas y miniatura real presentan ResNet18 del detector | Scroll; evidencia | [ResNet][resnet], [CenterNet][centernet], [Ciencia](SCIENCE.md) | Miniaturas son medias espaciales, no tensores completos; shapes/checkpoint conservados |
| 18 `upsampling` | Como recuperar resolucion? | Caracteristicas | Upsampling | Cuadricula 128 x 128 | Tres etapas bilinear x2, Conv/BN/ReLU; snapshot up3 real | Scroll; evidencia | [Modelo concreto][model], [Ciencia](SCIENCE.md) | up3=[1,256,128,128]; thumbnail 24x24; no ConvTranspose ni activaciones intermedias inventadas |
| 19 `cabezas` | Que predice cada cabeza? | Cuadricula 128 x 128 | Cabezas | Centro, tamano, offset | Heatmap real y vectores WH/offset se distinguen | Scroll; evidencia | [CenterNet][centernet], [Ciencia](SCIENCE.md) | Sigmoid real; WH/offset locales del decode, no mapas completos inventados |
| 20 `centernet` | Que caja conservar? | Centro, tamano, offset | Decode y NMS | Caja y coordenadas | Decode y NMS IoU 0.3 precalculados; caja exacta conserva coordenadas | Scroll; evidencia | [Extractor][extractor], [CenterNet][centernet] | >0.3 estricto; score 0.8045120835; 551.221573 ms/sample 551; DM fila 47; decode original |
| 21 `recorte` | Que recibe el clasificador? | Caja y coordenadas | Recorte y preparacion | Tensor de intensidad | Copia dedispersada 512x64 y prep_patch reales | Scroll; evidencia del hash | [Dedispersion][dedispersion], [SNR][snr], [Modelo concreto][model] | Inicio 295, sin padding, DM estimada; input [1,1,512,64]; hash 5edba...; SNR del crop no es mapa DM |
| 22 `resnet` | Como comparar rasgos? | Tensor de intensidad | Bloques residuales | Caracteristicas finales | ResNet18 clasificador; residual compatible y layer4 real 16x2 canal 0 | Scroll; evidencia | [ResNet][resnet], [Modelo concreto][model] | Shape [1,512,16,2]; no cuadrado ni 512 canales ficticios desde miniatura |
| 23 `decision` | Que salida da la red? | Caracteristicas finales | GAP y clasificacion | Puntuacion | Vector GAP 512 exacto precede a Linear 2 y softmax 2 | Scroll; evidencia | [ResNet][resnet], [Ciencia](SCIENCE.md) | GAP pre-hook real; logits [-29.1538563,28.7564430]; clase 1=1.0 float32; no sigmoid unico/calibracion |
| 24 `candidato` | Que conservar? | Puntuacion | Seleccion | Ficha y plots vinculados | Perfil SNR 512, Bow Tie recortado y frecuencia-tiempo dedispersado se escriben; clase aparece despues | Click/arrastre temporal; flechas; fila DM; restaurar; evidencia | [DRAFTS][drafts], [Cierre numerico](SCIENCE.md) | Limites raster 0.2945..0.8065 s; W14 soporte 0.5465..0.5605 s; CenterNet 0.551221573 s distinto del pico SNR 0.554 s; sin confirmacion |

## Nuevas Fases Cosmicas

| Fase | Pregunta | Entrada | Operacion | Salida | Animacion | Interaccion | Fuente | Comprobacion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `anfitriona` | De donde llega el pulso? | Pulso | Salida de anfitriona | Pulso extragalactico | La fuente queda dentro de otra galaxia; el paquete sale hacia la derecha | Avance fino; foco host/z/frecuencia/duracion | [Inventario y fuentes](COSMIC_SOURCES.md) | Host observado 130/1.3=100; z ilustrativo, no estimado del fixture |
| `galaxia` LF | Que aporta nuestra galaxia? | Llegadas dispersas | Halo y disco | Frente galactico | Camara entra al disco y vecindad solar; paquetes separados | Foco halo/disco/IGM/total; retroceso | [Inventario DM](COSMIC_SOURCES.md), [Camara](../src/cinema/travelCamera.ts) | Columna380->500 pc cm^-3 por reparto ilustrativo, no medicion |
| `galaxia` HF | Desde donde partimos? | Pulso galactico | Trayectoria galactica | Frente de onda | Fuente situada dentro de la Via Lactea | Foco DM/medio; retroceso | [Caso HF](OBSERVING_CASES.md) | Sin host extragalactico, IGM ni redshift; DM1770 conocida, no estimada |
| `polarizacion` | Como oscila el campo? | Frente galactico | Polarizacion y Faraday | Campo polarizado | Campo transversal y elipse; Stokes y orientaciones por longitud de onda | Foco campo/Stokes/RM/lambda/angulo | [NRAO y convenciones](COSMIC_SOURCES.md) | I,V invariantes bajo pantalla externa; Q,U giran 2chi; RM no es DM |
| `tierra` | Que recibe el observatorio? | Campo polarizado | Llegada terrestre | Onda en observatorio | Tierra NASA recibe frentes; LF baja a Arecibo, HF a Chajnantor | Foco frecuencia/retardo/campo/feed; retroceso | [NASA](COSMIC_SOURCES.md), [Destinos](OBSERVING_CASES.md) | LF18.34422,-66.7527 grados; HF-23.029,-67.755 grados/5000m; terrenos y escalas ilustrativos |

## Fases De Busqueda HF

Este tramo recibe un fixture distinto del LF: intensidad residual, semilla 17452900, 128x32, dt 4.096 ms. No se usan datos observados del magnetar ni trazas neuronales LF.

| Fase | Pregunta | Entrada | Operacion | Salida | Animacion | Interaccion | Fuente | Comprobacion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hf-resolution` | Se resuelve el retardo? | Intensidad ilustrativa | Comparar retardo/muestra | Regimen HF | Escalas nativa y efectiva contrastan retardo con ancho de bin | Foco DMmax/dt/R y DM conocida | [Backend/caso](OBSERVING_CASES.md), [Math HF](../src/hf/math.ts) | R_search=0.018344957<2 usa DMmax3000; q_known=0.010823525 usa DM1770; igualdad2 LF |
| `hf-matriz` | Que conserva el receptor? | Regimen HF | Indexar residual | Waterfall | Columnas/celdas se escriben con frecuencia y tiempo | Foco canales/dt/celdas; retroceso | [Fixture](../src/hf/model.ts) | 128x32, centros85.29925..87.23675GHz; fondo sustraido noJy; sin curvaDM resuelta |
| `hf-profile` | Como integrar canales? | Waterfall HF | Pesos/detrending/ruido | Serie/SNR | Productos y acumulaciones construyen el perfil | Foco pesos/serie/ruido | [SNR](../src/hf/model.ts), [Backend][snr] | Operador Explorer read-only; SNR128 no perfilLF512 ni mediaDM2048 |
| `hf-boxcar` | Que duracion concentra? | Serie normalizada | Convolucion y maximo | Banco anchura-tiempo | Seis anchuras escriben filas y mantienen pico | Foco W/rho/umbral/tiempo | [Math HF](../src/hf/math.ts), [Caso](OBSERVING_CASES.md) | W1,2,3,5,8,15; same/float32/ceros; anchura no es ejeDM |
| `hf-candidato` | Que sabemos del pico? | Banco SNR | Umbral/exposicion | Propuesta HF | Perfil/banco/waterfall vinculados se escriben; salida aparece tras el banco | Click/arrastre; tiempo/anchura; teclado; restaurar; evidencia | [Cierre HF](../src/hf/HFFinalePanel.tsx), [Caso](OBSERVING_CASES.md) | SNR9.6916513443,t249.856ms,W20.48ms; >=6 y ventana completa; DM no resuelta, sin score/red/confirmacion |

## Fases Elegibles De Metodos

Estas fases se eligen **solo en LF**. No utilizan el score CenterNet ni logits ResNet de otra entrada. Valores y reglas: [METHODS.md](METHODS.md). HF conserva su ruta clasica propia.

| Fase | Pregunta | Entrada | Operacion | Salida | Animacion | Interaccion | Fuente | Comprobacion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `metodos` | Que estrategias comparar? | Perfil/mapa | Eleccion independiente | Ruta de analisis | Matriz se escribe; tres caminos de deteccion convergen hacia inspeccion | Selectores detector/clasificador; foco operadores | [Catalogo](../src/methods/catalog.ts), [Metodos](METHODS.md) | Default CNN/ResNet; Boxcar/radio opcional; ruta por ID, sin scores incompatibles |
| `boxcar` | Como recoger un pulso? | Perfil fijo 64 | Suma normalizada | SNR por ventana | Ventana de 8 muestras recorre entrada; salida se escribe al completar cada ventana | Foco x/W/sigma/rho; paso fino | [PRESTO](https://github.com/scottransom/presto/blob/master/bin/single_pulse_search.py) | sum(x-mu)/(sigma sqrt(W)); solo ventanas completas; ruido ilustrativo no calibrado |
| `boxcar-bank` | Que anchura concentra mejor? | Mismo perfil | Banco de anchuras | Seis curvas | Cada anchura construye su propia respuesta | Foco anchuras/SNR/maximo; retroceso | [Metodos](METHODS.md) | W=[1,2,4,8,14,20], dt=1 ms; no configuracion PRESTO completa |
| `boxcar-threshold` | Que pasa a inspeccion? | Banco SNR | Umbral ilustrativo | Propuestas | Curva se escribe y marcas aparecen al cruzar linea | Foco SNR/umbral/tiempo/propuesta | [Metodos](METHODS.md) | eta=6 adimensional; ventanas solapadas y multiples ensayos no son independientes |
| `vit-patches` | Como lee una imagen un Transformer? | Mapa esquematico 16x16 | Parches/proyeccion | 16 tokens | Parches 4x4 y vectores dimension 4 se construyen | Foco parche/E/posicion/token | [ViT](https://arxiv.org/abs/2010.11929) | Raster order, proyeccion 16x4 y posiciones publicadas; no aprendidas |
| `vit-detection` | Como se relacionan regiones? | Tokens | QK/softmax/V | Tokens contextualizados | Q,K,A,V,Y revelan productos, pesos y salidas en fases distintas | Foco matrices; avance fino | [Atencion](https://arxiv.org/abs/1706.03762) | sqrt(d)=2; cada fila A suma uno; Y=AV; sin inferencia entrenada |
| `vit-proposals` | Basta la atencion para detectar? | Tokens | Cabeza esquematica | Cajas ilustrativas | Contrato de cabeza y caja dibujada a mano | Foco tokens/cabeza/centro/extension | [ViT y limites](METHODS.md) | ViT original es clasificador; sin score ni conversion cientifica de cajas |
| `radio-checks` | Que evidencia falta? | Perfil/contexto | Relaciones fisicas | Inspeccion | Ley dispersiva, parametro y referencia galactica aportan contexto | Foco retardo/DM observada/modelo/exceso | [NRAO](https://www.cv.nrao.edu/~sransom/web/Ch6.html) | No se calcula DM galactica ni distancia; ningun criterio confirma por si solo |
| `forest-features` | Que resume el vector? | Ejemplo fijo | Rasgos con unidades | Vector de 4 | Componentes aparecen con SNR, ms, pc cm^-3 y fraccion | Foco rasgos/vector | [Breiman](https://www.stat.berkeley.edu/~breiman/randomforest2001.pdf) | [8,6,500,.75] no se extrae del candidato; altura grafica no es escalado de entrenamiento |
| `forest` | Como votan los arboles? | Vector fijo | Reglas y hojas | Votos | Ramas y hojas se completan antes de agregar votos | Foco vector/arbol/M/votos | [Reglas publicadas](METHODS.md) | Tres arboles manuales; igualdad en rama superior; voto no es probabilidad calibrada |
| `vit-classification` | Como producir dos logits? | Recorte esquematico | Atencion/media/cabeza | Salidas didacticas | Recorte y tokens se escriben; pool y logits aparecen despues | Foco tokens/media/logits/softmax | [ViT](https://arxiv.org/abs/2010.11929), [Pesos](METHODS.md) | 16x4, media sin CLS, cabeza fija 4x2; no certeza astrofisica |
| `resnet-didactic` | Que conserva un residual? | Vector de 8 | F(x)+x/ReLU | Vector de 8 | Caminos convolucional e identidad vuelven a sumarse | Foco identidad/convolucion/salida | [ResNet](https://arxiv.org/abs/1512.03385) | Kernel [.25,.5,.25], stride 1, padding cero; sin traza incompatible |
| `candidate-didactic` | Es una confirmacion? | Ejemplo de salida | Inspeccion/contexto | Propuesta y plots ilustrativos | Banco SNR toy, mapa y recorte fijos se escriben; salida didactica aparece despues | Click/arrastre; flechas; fila DM; restaurar; evidencia | [Limites](METHODS.md), [Cierre numerico](SCIENCE.md) | TOY_PROFILE/MAP/CROP independientes; W8 centro30.5 ms y soporte26.5..34.5 ms; sin scores heredados ni confirmacion |

## Direccion E Interaccion

Una superficie Three.js persiste. El objeto principal permanece durante operacion y sosten; la entrega horizontal mantiene identidad de color, indices y forma. La camara acompana la entrega, no abandona el operador a medio calculo. Retroceder reconstruye la misma representacion y no cambia datos.

Via Lactea y Tierra anaden trayectos de camara, no un segundo reloj. LF termina en Arecibo historico, con reflector unico/plataforma; HF en Chajnantor con seis platos didacticos ALMA. Coordenadas y optica identifican cada referencia, pero terreno/layout no son levantamientos. Nunca se atribuye la banda LF1.2-1.6GHz a ALMA.

En LF, DM de prueba494.7368469 es una hipotesis fijada de antemano, no seleccion anticipada. Perfil de busqueda2048 es media expuesta; SNR512 pertenece al recorte localizado. HF usa SNR128 y banco de anchuras propios: DM conocida1770 no se estima ni se fabrican filas DM a partir de SNR.

En escritorio, sujeto y texto separados; en movil, escena arriba y texto debajo. El cierre se centra, ancho maximo 1120 px y sin sidebar; prioriza tres plots vinculados. **Candidato detectado** no significa confirmado: ambos cierres conservan `data-confirmation="not-confirmed"` y **Para confirmar: descartar RFI y contrastar evidencia astronómica independiente.** El menu Ruta vuelve a fases anteriores. Matrices/recortes conservan proporcion; altura grafica no cambia unidades, resolucion o arrays.

Controles: scroll vertical nativo y horizontal fino, barra de posicion, flechas, navegacion por actos, pausa ambiental, calidad, evidencia, regreso y repeticion de operacion durante ocho segundos. Un toque de flecha cambia 0.0125 fases; mantenerla inicia continuidad tras 250 ms. Velocidad regulable 0.10-1.00 fases/s, inicial 0.12. Scroll horizontal acumula un destino con respuesta exponencial de constante 65 ms, sin sobrepasarlo; invertir direccion cancela el impulso pendiente. Scroll vertical, entrada tactil, posicion directa, cambio de ruta, apertura de evidencia, perdida de foco y pestaña oculta cancelan ese transporte. Soltar o cancelar pointer detiene avance sostenido. El foco de teclado de cada formula permanece accesible. Detector y clasificador se eligen en `metodos`; el cierre no repite selectores ni conserva una salida incompatible.

El cierre permite click/arrastre para elegir tiempo y fila DM en LF, o anchura en HF. Flechas izquierda/derecha mueven tiempo; arriba/abajo cambian fila; Home/restaurar recuperan seleccion inicial. Tres cursores comparten coordenadas sin recalcular SNR, clase o logits. No se promete elegir celdas de escenas previas, ajustar DM o entrenar redes. Movimiento reducido conserva foco estatico y plots completos; fallback conserva evidencia/Canvas. Cambiar caso retira outputs incompatibles; un asset LF fallido no habilita scores nuevos ni arrays antiguos.

Rotate3D de la toolbar abre inspeccion en matrices, perfiles, Bow Tie, recortes, tensores y HF compatibles. Canvas centrado y progreso quieto; OrbitControls permite rotar/pan/zoom con mouse/touch y teclado. Vistas frontal/lateral/superior/perspectiva cambian camara; lateral/superior mantienen componente z de 0.35. `Relieve normalizado (u.a.)` 0..3 afecta solo GPU, sin amplitud calibrada, cambios de arrays ni permutacion cientifica de ejes. Restaurar vuelve a perspectiva y relieve 1 u.a.; salir restablece la presentacion narrativa. Escape, cambio de fase/caso o perdida WebGL cierran inspeccion. Plots finales siguen 2D vinculados.

## Asociacion Matematica

`src/math/model.ts`, `src/math/cosmicMath.ts`, `src/methods/math.ts` y `src/hf/math.ts` fijan ecuaciones/terminos/unidades/fuentes por caso. Antes del cierre, MathPanel sigue el termino seleccionado; en el cierre los plots reemplazan ese panel y ecuaciones accesibles permanecen en evidencia. Foco automatico y escena comparten `operation`, sin reloj independiente.

Las formulas en el mundo 3D se rasterizan mediante `formulaSprite.ts`: integrales, fracciones, subindices, superindices y conjugacion tienen posicion tipografica real sobre Canvas. Son texturas locales reutilizables de un vocabulario finito, no un parser TeX. El equivalente accesible sigue en KaTeX. Sprite y ecuacion semantica conservan la misma identidad fisica, sin convertir texto grafico en un dato nuevo.

Plasma integra columna y conserva retardos por frecuencia. Solo LF aumenta el inventario host/IGM/halo/disco y aplica marco fuente/observador; HF conserva trayecto galactico. Jones/Stokes/Faraday ilustran orientacion independiente del fixture. Tierra recibe, no dedispersa. Arecibo enfoca un campo; ALMA HF distingue baseline/retardo, correlador paralelo y suma de voltajes. ADC/FFT distinguen unidades normalizadas, bits, bins y centros fisicos.

Waterfall escribe tiempo y canales; perfil acumula aportes validos antes de publicar cada media; mapa DM escribe filas de prueba y sus muestras. Cursores y commits son enteros, reversibles y usan datos nativos verificados. RGB y salidas neuronales se revelan como resultados precalculados, sin fingir una nueva inferencia. La seleccion de un termino cambia guias/materiales, no la ciencia.

El cierre registrado distingue perfil de busqueda de 2048 muestras y SNR del recorte de 512. Bow Tie se recorta al mismo dominio absoluto que frecuencia-tiempo: centros `0.295..0.806 s`, limites de bins `0.2945..0.8065 s`. El pico SNR `0.554 s` y centro CNN `0.5512215728759766 s` tienen marcadores distintos. La ventana `W=14` conserva soporte `0.5465..0.5605 s` y la convencion par del filtro original. Cambiar fila DM solo mueve el marcador: SNR y clasificacion siguen referidos a su recorte exacto.

El cierre alternativo publica ejemplos independientes, no una continuacion inferida del fixture. El banco toy conserva centro y anchura de la ventana ganadora; una anchura par ubica su centro medio bin despues de una posicion entera. La seleccion busca tiempos efectivos, incluso cuando sus incrementos son `0.5`, `1` o `1.5 ms`. Mapa y recorte toy conservan 16 columnas entre `0` y `64 ms`; coordenadas DM/canales y salidas de clasificador se rotulan didacticas. Forest usa reglas sobre su vector fijo; Transformer usa su recorte publicado; residual no infiere clase.

## Comprobacion

`tests/continuity.test.ts` conserva catalogo registrado, interfaces breves, IDs y temporalidad `operation/handoff`. Las pruebas de rutas, transporte, cosmicas y metodos fijan elecciones independientes, procedencia, unidades, operaciones y focos. Pruebas de evidencia cubren hashes, crop, SNR, decode, contexto y fallos. Pruebas numericas verifican DFT independiente, visibilidad compleja, Stokes/Faraday, normalizacion Boxcar, productos de atencion, votos y construccion discreta reversible. `tests/travel.test.ts` cubre keyframes/reversibilidad, proyeccion de Chile y layout ilustrativo; `tests/finale.test.ts` cubre limites raster, ventanas, procedencia y seleccion enlazada. Browser comprueba presentacion e interaccion de rutas, plots Canvas, encuadre desktop/mobile, movimiento reducido y fallback. Gates y mediciones se registran en validacion, no se presuponen aqui.

[nrao]: https://www.cv.nrao.edu/~sransom/web/Ch6.html
[physics]: https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/domain/physics.py
[dedispersion]: https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/preprocessing/dedispersion.py
[snr]: https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/analysis/snr_utils.py
[extractor]: https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/preprocessing/dm_candidate_extractor.py
[preprocess]: https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/visualization/visualization_unified.py#L38
[fft]: https://github.com/indutny/fft.js
[drafts]: https://arxiv.org/abs/2410.03200
[centernet]: https://arxiv.org/abs/1904.07850
[resnet]: https://arxiv.org/abs/1512.03385
[model]: https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/detection/model_interface.py
