export interface Sequence {
  id: string;
  act: number;
  kicker: string;
  title: string;
  caption: string;
  provenance: string;
  detail: string;
  input: string;
  operation: string;
  output: string;
  readout: 'event' | 'acquisition' | 'waterfall' | 'profile' | 'map' | 'network';
  requiresEvidence: boolean;
}

export const ACTS = ['Origen', 'Viaje', 'Captura', 'Datos', 'Búsqueda', 'Métodos'];
export const GUIDED_DM_ROW = 47;
type DraftSequence = Omit<Sequence, 'kicker' | 'requiresEvidence'>;
const steps: DraftSequence[] = [
  { id: 'faro', act: 0, title: 'Todo comienza con un pulso.',
    caption: 'Un faro de radio. Elegimos una emisión y seguimos su recorrido.', provenance: 'FUENTE ILUSTRATIVA',
    input: 'Fuente', operation: 'Emisión', output: 'Campo', readout: 'event',
    detail: 'Púlsar ilustrativo: eje de rotación, oblicuidad y haces polares. No demuestra el origen astrofísico del candidato sintético.' },
  { id: 'pulso', act: 0, title: 'Una señal abandona la estrella.',
    caption: 'La portadora oscila. La envolvente delimita el evento que seguimos.', provenance: 'CAMPO Y ENVOLVENTE · ESCALA COMPRIMIDA',
    input: 'Campo', operation: 'Envolvente', output: 'Pulso', readout: 'event',
    detail: 'La portadora representa campo eléctrico; su envolvente no es intensidad. El evento LF sintético tiene FWHM de intensidad de 6 ms.' },
  { id: 'vuelo', act: 1, title: 'La fuente queda atrás.',
    caption: 'El mismo paquete atraviesa el espacio. La fuente no viaja con él.', provenance: 'DISTANCIA ILUSTRATIVA',
    input: 'Pulso', operation: 'Propagación', output: 'Frente de onda', readout: 'event',
    detail: 'Distancia y duración son cinematográficas. El desplazamiento gráfico no permite medir distancia astrofísica ni velocidad física.' },
  { id: 'plasma', act: 1, title: 'El plasma separa las llegadas.',
    caption: 'Las frecuencias altas adelantan a las bajas. El evento conserva su identidad.', provenance: 'PLASMA FRÍO · DM SINTÉTICA',
    input: 'Frente de onda', operation: 'Dispersión', output: 'Llegadas dispersas', readout: 'event',
    detail: 'Los retardos siguen 4148.808 DM (ν⁻² − νref⁻²), en segundos con frecuencias en MHz. La referencia utiliza centros de canal.' },
  { id: 'antenas', act: 2, title: 'Un frente. Varias antenas.',
    caption: 'La misma onda alcanza cada antena con un retardo geométrico diferente.', provenance: 'ARREGLO ILUSTRATIVO',
    input: 'Llegadas dispersas', operation: 'Recepción', output: 'Voltajes por antena', readout: 'event',
    detail: 'Seis antenas ilustran recepción y retardos geométricos. No representan una observación real ni atribuyen el evento LF a ALMA.' },
  { id: 'fase', act: 2, title: 'Alineamos antes de sumar.',
    caption: 'Compensamos retardos y fases. Las oscilaciones quedan listas para combinarse.', provenance: 'RETARDOS Y FASES ILUSTRATIVOS',
    input: 'Voltajes por antena', operation: 'Compensación', output: 'Voltajes alineados', readout: 'event',
    detail: 'El arreglo ilustra compensación geométrica y fase para una dirección de observación. Esta alineación instrumental no es dedispersión del plasma.' },
  { id: 'suma', act: 2, title: 'Una salida coherente.',
    caption: 'Los voltajes alineados se suman. Seguimos la salida común del arreglo.', provenance: 'SUMA COHERENTE ILUSTRATIVA',
    input: 'Voltajes alineados', operation: 'Suma coherente', output: 'Voltaje combinado', readout: 'event',
    detail: 'Se suman campos o voltajes complejos antes de obtener potencia. No equivale a sumar potencias independientes ni al promedio de canales.' },
  { id: 'receptor', act: 2, title: 'El voltaje se vuelve discreto.',
    caption: 'El ADC fija instantes y niveles. Cada muestra conserva su posición temporal.', provenance: 'ADC · EJEMPLO DE 4 BITS',
    input: 'Voltaje combinado', operation: 'Muestreo y ADC', output: 'Muestras', readout: 'acquisition',
    detail: 'Ejemplo ilustrativo de 64 voltajes, saturación en [−1,1] y ADC de 4 bits. El waterfall sintético no se genera desde estos voltajes.' },
  { id: 'fft', act: 2, title: 'Abrimos el eje de frecuencia.',
    caption: 'Una ventana de muestras entra a la FFT. Salen amplitudes complejas por frecuencia.', provenance: 'HANN · FFT DE 64 MUESTRAS',
    input: 'Muestras', operation: 'Ventana y FFT', output: 'Canales complejos', readout: 'acquisition',
    detail: 'El ejemplo aplica ventana Hann y fft.js. La potencia guardada corresponde a |FFT|²/64². La FFT separa componentes; no mide DM.' },
  { id: 'potencia', act: 2, title: 'Del campo a la intensidad.',
    caption: 'El módulo al cuadrado produce potencia. Acumular ventanas construye tiempo por frecuencia.', provenance: 'POTENCIA E INTEGRACIÓN ILUSTRATIVAS',
    input: 'Canales complejos', operation: 'Potencia y acumulación', output: 'Intensidad', readout: 'acquisition',
    detail: 'Potencia e integración son ilustrativas. La siguiente escena introduce un waterfall sintético independiente con semilla y procedencia verificables.' },
  { id: 'matriz', act: 3, title: 'El evento ocupa celdas.',
    caption: 'La curva dispersa atraviesa tiempo y frecuencia. Su marcador conserva el enlace.', provenance: 'INTENSIDAD SINTÉTICA · LF 241032',
    input: 'Intensidad', operation: 'Indexación', output: 'Waterfall', readout: 'waterfall',
    detail: 'Aquí comienza el dato científico exacto: float32, 2048 muestras × 64 canales, ejes tiempo por frecuencia. Color de celdas reales; relieve gráfico aproximado.' },
  { id: 'bloques', act: 3, title: 'Cortamos sin perder contexto.',
    caption: 'El bloque incluye vecinos. Su región válida evita contar el mismo evento dos veces.', provenance: 'CHUNK · CONTEXTO · REGIÓN VÁLIDA',
    input: 'Waterfall', operation: 'Streaming', output: 'Bloque con contexto', readout: 'waterfall',
    detail: 'Contexto de 1269 muestras: máximo shift DM, 1239, más máximo boxcar, 30. Los intervalos válidos semiabiertos cubren la observación una vez.' },
  { id: 'alineacion', act: 4, title: 'Probamos una DM.',
    caption: 'Cada canal se desplaza según su frecuencia. El evento disperso vuelve a concentrarse.', provenance: 'DEDISPERSIÓN · SIN WRAP',
    input: 'Bloque con contexto', operation: 'Desplazamientos DM', output: 'Canales dedispersados', readout: 'waterfall',
    detail: 'Shifts ties-to-even y bordes sin wrap. Ejemplo guiado con DM de prueba fija 494.7368469 pc cm⁻³; no se infiere aquí. DM inyectada 500.' },
  { id: 'perfil', act: 4, title: 'Los canales dejan un perfil.',
    caption: 'La media de canales válidos deja una curva. Cada instante conserva su exposición.', provenance: 'PERFIL DE INTENSIDAD · MEDIA EXPUESTA',
    input: 'Canales dedispersados', operation: 'Media expuesta', output: 'Perfil', readout: 'profile',
    detail: 'Perfil exacto: fila 47 del mapa DM–tiempo, 2048 valores de media expuesta a DM de prueba 494.7368469. No es SNR ni usa boxcars.' },
  { id: 'bowtie', act: 4, title: 'Repetimos para muchas DM.',
    caption: 'Cada prueba añade una fila. El conjunto forma el mapa DM–tiempo.', provenance: 'MAPA CIENTÍFICO · PRIMER PLANO DEL CUBO',
    input: 'Perfil', operation: 'Barrido DM', output: 'Mapa DM–tiempo', readout: 'map',
    detail: 'Cada fila conserva un perfil de media expuesta del waterfall completo: 96 DM × 2048 muestras. No es SNR ni heatmap de CenterNet. Otros planos: canal medio y diferencia.' },
  { id: 'rgb', act: 5, title: 'Preparamos la entrada de la red.',
    caption: 'El mapa se transforma en RGB. Su preparación conserva la correspondencia de coordenadas.', provenance: 'CENTERNET · RGB 3 × 512 × 512',
    input: 'Mapa DM–tiempo', operation: 'Preparación RGB', output: 'Tensor RGB', readout: 'network',
    detail: 'Preparación RGB real para CenterNet, entrada NCHW 1×3×512×512. RGB no representa los tres planos científicos. La miniatura cuantiza solo para visualizar.' },
  { id: 'backbone', act: 5, title: 'La red extrae estructura.',
    caption: 'Convoluciones transforman la imagen. Seguimos activaciones del mismo ejemplo, no una predicción nueva.', provenance: 'BACKBONE · ACTIVACIONES CPU REALES',
    input: 'Tensor RGB', operation: 'Backbone', output: 'Características', readout: 'network',
    detail: 'Miniatura conv1: canal 0 resumido a 24×24 del tensor 64×256×256. Traza precalculada con checkpoint real, eval() y entrada fija.' },
  { id: 'upsampling', act: 5, title: 'Recuperamos resolución espacial.',
    caption: 'Tres etapas de upsampling preparan características para localizar centros sobre una cuadrícula.', provenance: 'CENTERNET · TRES UPSAMPLING',
    input: 'Características', operation: 'Upsampling', output: 'Cuadrícula 128 × 128', readout: 'network',
    detail: 'Se ilustra la arquitectura de tres upsampling. Solo el canal 0 resumido del tercer tensor, 256×128×128, tiene activación exportada real.' },
  { id: 'cabezas', act: 5, title: 'Centro, tamaño y ajuste.',
    caption: 'Tres cabezas describen dónde está el evento y cuánto abarca su caja.', provenance: 'HEATMAP · TAMAÑO · OFFSET',
    input: 'Cuadrícula 128 × 128', operation: 'Cabezas', output: 'Centro, tamaño, offset', readout: 'network',
    detail: 'Heatmap sigmoid real resumido. WH y offset muestran valores reales del pico elegido, no mapas completos inventados. Pico [63,34].' },
  { id: 'centernet', act: 5, title: 'Una caja recupera coordenadas.',
    caption: 'Decodificamos el pico, filtramos solapamientos y regresamos al tiempo y la DM.', provenance: 'DECODE · NMS · COORDENADAS',
    input: 'Centro, tamaño, offset', operation: 'Decode y NMS', output: 'Caja y coordenadas', readout: 'network',
    detail: 'Score 0.8045121; umbral estricto >0.3 e IoU NMS 0.3. DM usa H−1; tiempo usa longitud/W. Tiempo continuo 551.2215729 ms, índice truncado 551.' },
  { id: 'recorte', act: 5, title: 'Volvemos al dato original.',
    caption: 'La caja guía un recorte dedispersado. ResNet recibe datos, no la imagen RGB.', provenance: 'RECORTE 512 × 64 · ENTRADA 1 × 512 × 64',
    input: 'Caja y coordenadas', operation: 'Recorte y preparación', output: 'Tensor de intensidad', readout: 'network',
    detail: 'Recorte original rectangular, inicio 295, candidato local 256. Entrada NCHW 1×1×512×64, preparada y verificada por hash.' },
  { id: 'resnet', act: 5, title: 'La información atraviesa ResNet.',
    caption: 'Convoluciones y caminos residuales transforman el recorte. La suma conserva ambos caminos.', provenance: 'RESNET · BLOQUES RESIDUALES',
    input: 'Tensor de intensidad', operation: 'Bloques residuales', output: 'Características finales', readout: 'network',
    detail: 'Convolución, BatchNorm, ReLU, pooling y bloques residuales se ilustran. Conv1 y layer4 muestran resúmenes reales; layer4 tiene forma 512×16×2.' },
  { id: 'decision', act: 5, title: 'De características a puntuación.',
    caption: 'Agregación global produce 512 valores. Dos logits y softmax cierran la clasificación.', provenance: 'GAP 512 · LOGITS · SOFTMAX',
    input: 'Características finales', operation: 'GAP y clasificación', output: 'Puntuación', readout: 'network',
    detail: 'Vector GAP completo y logits reales [−29.1538563,28.7564430]. Softmax clase 1 es 1 en precisión float32; no representa certeza astrofísica.' },
  { id: 'candidato', act: 5, title: 'Un candidato. No una confirmación.',
    caption: 'El evento conserva su ruta: recorte, caja, mapa, bloque y observación.', provenance: 'TRAZA VERIFICADA · EVENTO SINTÉTICO',
    input: 'Puntuación', operation: 'Selección', output: 'Ficha rastreable', readout: 'network',
    detail: 'Checkpoint real, inferencia CPU precalculada, datos sintéticos. Detección, puntuación y confirmación astrofísica son diferentes. La ficha vuelve a cada representación.' },
];

export const STORY: Sequence[] = steps.map((step, index) => ({ ...step,
  kicker: `${String(index + 1).padStart(2, '0')} / ${ACTS[step.act].toLocaleUpperCase('es')}`,
  requiresEvidence: index >= 7,
}));
export const ACT_STARTS = ACTS.map((_, act) => STORY.findIndex(step => step.act === act));
export const EVIDENCE_PREFETCH = STORY.findIndex(step => step.act === 2);

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

// Finish the operation, hold its output, then carry that output into the next scene.
export function stageTiming(local: number) {
  return { operation: smooth((local - .08) / .48), handoff: smooth((local - .72) / .28) };
}

export function splitProgress(value: number, count = STORY.length) {
  const global = Math.min(count - .000001, Math.max(0, Number.isFinite(value) ? value : 0));
  const sequence = Math.floor(global);
  return { sequence, local: global - sequence, global };
}

export function scrollSegments(starts: number[], maxScroll: number): number[] {
  return starts.map((start, index) => Math.max(1, (starts[index + 1] ?? maxScroll) - start));
}
