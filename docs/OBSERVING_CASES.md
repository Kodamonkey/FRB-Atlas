# Dos Casos, Dos Regimenes

FRB Atlas compara una ilustracion extragalactica LF recibida en el **Arecibo historico** con un pulso **galactico sintetico HF** inspirado en el magnetar PSR J1745-2900 y recibido en ALMA. Ninguno es una observacion astronomica nueva. El selector cambia fuente, destino, resolucion, recorrido y datos; no cambia solamente el decorado. Configuracion: [observations.ts](../src/observations.ts).

## Configuracion Reproducible

| Cantidad | LF: `arecibo-lf` | HF: `alma-hf` |
| --- | --- | --- |
| Evento y semilla | `LF-241032`, 241032 | `HF-17452900`, 17452900 |
| Origen ilustrado | Extragalactico: anfitriona, IGM, halo/disco de la Via Lactea | Galactico: sin anfitriona extragalactica, IGM ni correccion cosmologica |
| Datos | Fixture fijo existente, `[2048,64]` tiempo/frecuencia | Nuevo fixture determinista, `[128,32]` tiempo/frecuencia |
| Bordes de banda | 1200-1600 MHz | 85268-87268 MHz, o 85.268-87.268 GHz |
| Centros extremos | 1203.125-1596.875 MHz | 85299.25-87236.75 MHz |
| Muestreo nativo | 1 ms | 32 microsegundos |
| Suma temporal | Factor 1 | Factor 128 |
| Muestreo efectivo | 1 ms | 4.096 ms |
| FWHM intrinseca inyectada | 6 ms | 20 ms |
| DM conocida/inyectada | 500 pc cm^-3 | 1770 pc cm^-3 |
| DM maxima de configuracion | 1000 pc cm^-3 | 3000 pc cm^-3 |
| Retardo a DM conocida, entre centros extremos | 0.619595983 s | 44.333157 microsegundos |
| Retardo HF en muestras | No aplica | 1.385411 nativas; 0.010823525 efectivas |
| Resolucion a DM maxima | R = 1239.191965647 | R = 0.018344957066 |
| Producto de busqueda | Mapa DM-tiempo y perfil de media expuesta | Perfil SNR y banco anchura-tiempo, no Bow Tie DM-tiempo |
| DM del candidato | Solo CNN/ResNet: estimada 494.7368469; otras ramas toy no la estiman | No resuelta; valor conocido 1770 conservado aparte |
| Inferencia entrenada disponible | Solo el par CNN/ResNet sobre su entrada LF exacta | Ninguna; no se reutilizan activaciones, logits ni scores LF |

El waterfall HF representa **intensidad residual, fondo sustraido**: el ruido puede ser negativo. No tiene calibracion en Jy ni representa intensidad absoluta negativa. El generador integra analiticamente una gaussiana y modela suma temporal: amplitud multiplicada por 128 y desviacion de ruido independiente multiplicada por `sqrt(128)`. No reconstruye 16384 muestras de voltaje ni un archivo real de ALMA. Implementacion: [hf/model.ts](../src/hf/model.ts).

## Regla Del Backend

Con frecuencias en MHz y DM en pc cm^-3:

`Delta t_s = 4148.808 DM abs(nu_low^-2 - nu_high^-2)`.

`Delta t_effective = Delta t_native * down_time_rate` y `R = Delta t(DM_max) / Delta t_effective`.

Se usan **centros de canal**, no bordes de banda. El nombre historico Python `K_DM_MS` no cambia la unidad: el helper de segundos devuelve segundos; el helper de milisegundos multiplica por 1000. [physics.py](../../../src/domain/physics.py) y [pipeline_parameters.py](../../../src/core/pipeline_parameters.py), referencia `04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3`.

El criterio fisico de `should_use_hf_pipeline` es **HF si R < 2**; la igualdad pertenece a LF. La configuracion de auto-seleccion puede deshabilitarlo; no se deduce una ruta solo del nombre del instrumento. Sin la suma temporal de factor 128, este mismo ejemplo ALMA tiene `R = 2.348155`, por lo que el criterio seleccionaria LF. Tampoco Band 1 implica HF universal: importan banda, DM maxima y muestreo efectivo.

Una segunda regla, independiente, evita construir el cubo DM cuando `Delta t(DM_max-DM_min)/Delta t_effective < 1`. El placeholder interno no es un Bow Tie informativo ni permite inventar una DM medida. [high_freq_pipeline.py](../../../src/core/high_freq_pipeline.py) conserva esa distincion. `resolve_candidate_dm` puede devolver `NaN` con estado `unresolved_high_freq`; el modelo de presentacion HF utiliza `null` y `dmResolved=false`. Emplear cero para una correccion no resoluble no significa medir DM cero. Un prior catalogado o el punto medio de un intervalo tampoco se convierte en medicion.

## Instrumentos Correctos

**Arecibo LF:** un reflector esferico fijo de 305 m, radio de curvatura de referencia 265.176 m y plataforma receptora suspendida. ALFA tiene siete **haces** de recepcion, no siete platos independientes. Esta ruta no incluye `fase` ni `suma`: no presenta phasing interferometrico entre antenas de Arecibo. Latitud 18.34422 grados y longitud -66.7527 grados. Es una recreacion de su epoca operativa, no una afirmacion sobre su estado actual. Fuentes: [NASA PDS, contexto Arecibo 305 m](https://pds.nasa.gov/ds-view/pds/viewContext.jsp?identifier=urn:nasa:pds:context:telescope:arecibo.305m), [NAIC, geometria de referencia del reflector](https://www.naic.edu/arecibo/phil/hardware/laserscanner/200311/analyzingtheerrors.html).

**ALMA HF:** reflector primario de 12 m y distancia focal primaria de 4.8 m; no confundir esta ultima con la focal efectiva Cassegrain. Las seis antenas visibles reducen el arreglo para explicar retardos geometricos, phasing y suma coherente de voltajes. El correlador es una rama paralela de productos conjugados, no la entrada serial de la suma. Chajnantor: latitud -23.029 grados, longitud -67.755 grados, altitud aproximada 5000 m. Geometria y terreno no son CAD mecanico, configuracion medida ni topografia. Fuentes: [ALMA Technical Handbook](https://almascience.hq.eso.org/documents-and-tools/latest/alma-technical-handbook), [sitio ALMA](https://almascience.eso.org/about-alma/alma-site).

ADC de 4 bits, Hann/FFT de 64 valores y voltajes normalizados son operadores ilustrativos independientes. No describen el hardware completo ni producen causalmente los fixtures. En particular, no se atribuye su cuantizacion a la grabacion phased ALMA de la referencia.

## Observaciones De Referencia, No Fixtures

[Spitler et al. 2014](https://arxiv.org/abs/1404.2934) describe el descubrimiento de FRB 121102 en Arecibo: DM central `557.4 pc cm^-3`, anchura `3 +/- 0.5 ms` cerca de 1.4 GHz y muestras de 65.5 microsegundos. El abstract y la Tabla 1 discrepan sobre la incertidumbre de DM (3 frente a 2); aqui se conserva solo el valor central. Esos numeros historicos **no** son la verdad inyectada del fixture LF de DM 500 y dt 1 ms.

[Vera-Casanova et al., version 4 de 2025](https://arxiv.org/html/2504.06234v4) detecta ocho pulsos del magnetar galactico PSR J1745-2900 en datos phased ALMA de 2017, con 37 antenas de 12 m y 32 canales de 62.5 MHz. No son ocho FRBs extragalacticos ni datos que esta app haya reprocesado. La banda y el muestreo inspiran la configuracion HF; semilla, pulso, ruido y resultados de Atlas son nuevos ejemplos sinteticos. El retardo continuo del ejemplo usa centros extremos y la constante publicada del backend, no el retardo aproximado entre bordes citado en la tabla del articulo.

[Liu et al. 2021](https://arxiv.org/abs/2104.08986) no encontro **nuevos pulsares** en su busqueda galactica; no debe citarse ese resultado como una busqueda FRB negativa. No se afirma una ausencia universal de FRBs observados por ALMA a fecha de 2026.

No estan disponibles aqui los datos privados `ResultsThesis/Data` ni los PDFs privados mencionados anteriormente. No se presentan tasas historicas, predicciones de eventos, inferencias HF entrenadas o resultados negativos como si se hubieran reproducido con esos archivos.

## Salidas Y Limites

La ruta LF por defecto CNN/ResNet tiene 27 fases; Boxcar/radio es opcional, 23. Sus alternativas usan arrays toy independientes. HF mantiene 18 fases clasicas y su propio waterfall, integracion ponderada y banco de seis anchuras `[1,2,3,5,8,15]` muestras: `[4.096,8.192,12.288,20.480,32.768,61.440] ms`.

`computeSNR` y `channelShifts` se importan read-only del Explorer original; su port conserva el contrato de [compute_snr_profile](../../../src/analysis/snr_utils.py): pesos por ruido de canal, detrending, normalizacion robusta y convolucion `same` con kernels float32. El banco HF conserva ceros de borde y la asimetria de anchuras pares. La seleccion exige exposicion completa y `SNR >= umbral`; igualdad acepta, a diferencia del umbral estricto del detector CNN LF.

Para la semilla HF publicada, el maximo calculado es SNR `9.6916513443`, en `249.856 ms`, con `W=5` muestras o `20.48 ms`. Es una salida de este nuevo fixture, no un resultado historico ni score neuronal. DM continua no resuelta, clase entrenada ausente y confirmacion falsa. El backend general puede clasificar candidatos HF con ResNet, pero Atlas no dispone de una traza entrenada HF compatible y no la inventa.

Los plots revelan y retiran escrituras preparadas al avanzar o retroceder. LF puede mostrar DM-tiempo; HF muestra anchura-tiempo y nunca relabela sus filas como DM. Click/teclado mueve un cursor compartido, no vuelve a estimar DM ni clasifica otra entrada.

El commit `04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3` identifica la referencia de exportacion/ports, no el HEAD actual. Al reconsultar el checkout en esta etapa, HEAD y `dev` son `a0277fb37919f9c10e2b525021d67acaaf0403b9`; no se cambia Git ni se redefine la procedencia de las trazas. Explorer y backend permanecen read-only para esta entrega. Pruebas y mediciones se registran en [VALIDATION.md](VALIDATION.md), sin presuponer aqui nuevos gates completados.
