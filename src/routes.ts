import { ACTS, STORY as recordedStory, type Sequence } from './story';
import { DEFAULT_METHODS, METHOD_SEQUENCES, detectionStages, classificationStages,
  type DetectionMethod, type ClassificationMethod } from './methods/catalog';
import { DEFAULT_OBSERVATION, type ObservationCaseId } from './observations';

export interface MethodChoice { detection: DetectionMethod; classification: ClassificationMethod }

const cosmic: Sequence[] = [
  { id: 'anfitriona', act: 1, kicker: '', title: 'La fuente vive en otra galaxia.',
    caption: 'El pulso abandona su anfitriona. Su plasma aporta parte de la dispersión observada.',
    input: 'Pulso', operation: 'Salida de anfitriona', output: 'Pulso extragaláctico', readout: 'event', requiresEvidence: false,
    provenance: 'ANFITRIONA ILUSTRATIVA · NO LOCALIZACIÓN MEDIDA',
    detail: 'Elegimos un ejemplo extragaláctico. El plasma de la anfitriona aporta DM observada reducida por 1+z. No todos los destellos similares son extragalácticos: FRB 20200428 procede de un magnetar galáctico. El fixture no fija anfitriona ni redshift.' },
  { id: 'galaxia', act: 1, kicker: '', title: 'Entramos en la Vía Láctea.',
    caption: 'Acompañamos la señal entre halo y estrellas. El trayecto nos acerca al Sistema Solar.',
    input: 'Llegadas dispersas', operation: 'Halo y disco', output: 'Frente galáctico', readout: 'event', requiresEvidence: false,
    provenance: 'VÍA LÁCTEA ILUSTRATIVA · DM POR COMPONENTES',
    detail: 'La DM observada combina disco y halo de la Vía Láctea, medio intergaláctico y anfitriona. La geometría, el recorrido y el presupuesto de componentes son educativos; no son una medición del evento sintético ni una escala galáctica exacta.' },
  { id: 'polarizacion', act: 1, kicker: '', title: 'El campo tiene orientación.',
    caption: 'La polarización sigue el campo transversal. El plasma magnetizado gira su orientación según la longitud de onda.',
    input: 'Frente galáctico', operation: 'Polarización y Faraday', output: 'Campo polarizado', readout: 'event', requiresEvidence: false,
    provenance: 'POLARIZACIÓN ILUSTRATIVA · RM DISTINTA DE DM',
    detail: 'Los parámetros de Stokes describen intensidad y polarización. La rotación de Faraday cambia el ángulo lineal como chi=chi0+RM lambda². RM integra densidad electrónica por campo magnético paralelo y puede tener signo; DM no. El fixture no contiene una medida de polarización.' },
  { id: 'tierra', act: 1, kicker: '', title: 'Descendemos hasta Chajnantor.',
    caption: 'Entramos con el pulso. La Tierra se acerca y Chajnantor revela su arreglo de antenas.',
    input: 'Campo polarizado', operation: 'Llegada a Tierra', output: 'Onda en observatorio', readout: 'event', requiresEvidence: false,
    provenance: 'CHAJNANTOR / ALMA · UBICACIÓN ILUSTRATIVA',
    detail: 'La cámara acompaña la llegada dispersa y polarizada hasta Chile y el llano de Chajnantor. Terreno y seis antenas son una reconstrucción educativa, no geometría medida del sitio. ALMA observa ondas milimétricas/submilimétricas: esta referencia visual no atribuye a ALMA el fixture LF de 1203–1597 MHz. La dedispersión ocurre después en datos.' },
];

export const isRecordedRoute = (choice: MethodChoice, observation: ObservationCaseId = DEFAULT_OBSERVATION) =>
  observation === 'arecibo-lf' && choice.detection === 'cnn' && choice.classification === 'resnet';

const hf: Sequence[] = [
  { id: 'hf-resolution', act: 3, kicker: '', title: 'Dispersión presente, curva no resuelta.',
    caption: 'El retardo ocupa 0,011 muestras efectivas. La señal llega sin una curva dispersiva visible.',
    input: 'Intensidad', operation: 'Resolución temporal', output: 'Régimen HF', readout: 'event', requiresEvidence: false,
    provenance: '32 µs × 128 = 4,096 ms · ELECCIÓN ILUSTRATIVA',
    detail: 'R=Δt(DMmax)/dt efectivo=0.018344957, menor que 2: ruta HF del backend. La igualdad 2 pertenece a LF. El retardo físico de DM1770 es 44.333157 µs entre centros. Equivale a 1.385411 muestras nativas de 32 µs, pero solo 0.010823525 muestras tras downsampling temporal ×128. HF no es una frecuencia fija ni ausencia de plasma. ALMA Band 1 o mayor resolución pueden resolver otros casos.' },
  { id: 'hf-matriz', act: 3, kicker: '', title: 'Buscamos el pulso, no una curva.',
    caption: 'Las columnas reciben los canales casi juntos. Conservamos tiempo y frecuencia; la polarización requiere evidencia independiente.',
    input: 'Régimen HF', operation: 'Waterfall original', output: 'Intensidad por canal', readout: 'waterfall', requiresEvidence: false,
    provenance: 'PULSO HF SINTÉTICO · NO OBSERVACIÓN DE FRB',
    detail: 'Fixture determinista inspirado en el régimen de PSR J1745−2900 con ALMA Band 3. No son los datos observados del artículo ni activaciones del modelo LF. El máximo de DM no se puede recuperar de una matriz sin curvatura resuelta; el placeholder de cubo del backend no es un mapa calculado.' },
  { id: 'hf-profile', act: 4, kicker: '', title: 'Integramos sin buscar DM.',
    caption: 'La suma de canales conserva el pico temporal. El ruido establece la escala de significancia.',
    input: 'Intensidad por canal', operation: 'Integración y ruido', output: 'Serie temporal', readout: 'profile', requiresEvidence: false,
    provenance: 'OPERADOR NUMÉRICO HF · DATOS SINTÉTICOS',
    detail: 'El backend HF integra intensidad con pesos de ruido MAD, elimina tendencias y busca SNR. La demostración usa canales sintéticos de ruido estacionario y muestra su integración y normalización, no una ejecución del pipeline completo. La validación polarizada y los artefactos instrumentales siguen siendo comprobaciones independientes.' },
  { id: 'hf-boxcar', act: 4, kicker: '', title: 'Cada ancho prueba una duración.',
    caption: 'Los filtros boxcar recorren el perfil. El plano ancho–tiempo marca dónde supera el umbral.',
    input: 'Serie temporal', operation: 'Banco de boxcars', output: 'Pico SNR', readout: 'profile', requiresEvidence: false,
    provenance: 'ANCHO × TIEMPO · NO ES BOW TIE DM × TIEMPO',
    detail: 'Los filtros acumulan muestras contiguas y normalizan por raíz del ancho y ruido. La ventana seleccionada pertenece al eje temporal original. Este mapa usa ancho de filtro, no DM. El código original busca picos SNR antes de cualquier clasificación ResNet HF; CenterNet no se ejecuta en esta ruta.' },
  { id: 'hf-candidato', act: 5, kicker: '', title: 'Un candidato sin DM medida.',
    caption: 'Pico, ancho y waterfall coinciden. Detectar un pulso no confirma su origen ni resuelve su DM.',
    input: 'Pico SNR', operation: 'Comprobación clásica', output: 'Candidato HF', readout: 'profile', requiresEvidence: false,
    provenance: 'DM NO RESUELTA · SIN INFERENCIA NEURONAL',
    detail: 'DM1770 es conocida e inyectada, no estimada por este filtro. El backend conserva DM NaN y unresolved_high_freq cuando el cubo es plano. Usar cero para una corrección no resuelta no significa medir DM=0. Clasificación astrofísica requiere evidencia externa, polarización, repetición y rechazo de interferencia. ALMA sí detectó pulsos del magnetar galáctico; esta demo no afirma una detección de FRB.' },
];

export function storyFor(choice: MethodChoice = DEFAULT_METHODS, observation: ObservationCaseId = DEFAULT_OBSERVATION): Sequence[] {
  if (observation === 'alma-hf') {
    const catalog = new Map([...recordedStory, ...cosmic, ...hf].map(stage => [stage.id, stage]));
    const ids = ['faro', 'pulso', 'galaxia', 'vuelo', 'plasma', 'polarizacion', 'tierra', 'antenas', 'fase', 'suma',
      'receptor', 'fft', 'potencia', 'hf-resolution', 'hf-matriz', 'hf-profile', 'hf-boxcar', 'hf-candidato'];
    const overrides: Record<string, Partial<Sequence>> = {
      faro: { title: 'Un pulso dentro de nuestra galaxia.', caption: 'Seguimos un magnetar galáctico ilustrativo. No confundimos este caso HF con un FRB extragaláctico.',
        detail: 'Pulso sintético inspirado en PSR J1745−2900. El artículo de phased ALMA detecta ocho pulsos galácticos, no FRBs. El modelo de fuente y el terreno son educativos.' },
      pulso: { detail: 'Envolvente y campo ilustrativos. El pulso de intensidad sintético HF tiene ancho intrínseco de 20 ms; no es el fixture LF ni una observación del magnetar.' },
      galaxia: { title: 'Partimos del interior de la Vía Láctea.',
        caption: 'La señal atraviesa plasma galáctico. El ejemplo no añade anfitriona extragaláctica ni medio intergaláctico.',
        input: 'Pulso galáctico', operation: 'Trayectoria galáctica', output: 'Frente de onda',
        provenance: 'MAGNETAR GALÁCTICO ILUSTRATIVO · NO FRB',
        detail: 'La trayectoria ilustrativa parte del interior de la galaxia. DM1770 es referencia conocida del magnetar e inyección del fixture, no un reparto medido de halo y disco ni una estimación de la búsqueda.' },
      plasma: { title: 'El plasma retrasa también estas ondas.',
        caption: 'A 86 GHz, el retardo entre canales es pequeño. La dispersión existe aunque no dibuje una curva.',
        input: 'Frente de onda', output: 'Llegadas casi coincidentes', provenance: 'DM CONOCIDA / INYECTADA 1770 pc cm⁻³',
        detail: hf[0].detail },
      tierra: { title: 'Descendemos hasta Chajnantor.',
        detail: 'Recorrido ilustrativo hasta Chile y el llano de Chajnantor. ALMA observa en banda milimétrica: aquí usamos Band 3, 85.268–87.268 GHz. Seis antenas representan esquemáticamente un arreglo mayor; no son su configuración observada de 37 antenas.' },
      antenas: { provenance: 'ALMA BAND 3 · SEIS ANTENAS ILUSTRATIVAS',
        detail: 'Recepción, retardos geométricos y suma coherente ilustran phased ALMA. Los platos son de 12 m en un arreglo reducido para el dibujo, no las 37 antenas de la observación de 2017. Este caso usa un pulso sintético galáctico, no un FRB observado.' },
      receptor: { detail: 'Ejemplo didáctico de ADC de 4 bits, independiente del waterfall. La grabación phased ALMA del artículo usa 2 bits y PSRFITS de 32 canales a 32 µs. La resolución efectiva del caso educativo es 4.096 ms tras suma temporal ×128.' },
    };
    return ids.map((id, index) => {
      const stage = catalog.get(id)!;
      return { ...stage, ...overrides[id], requiresEvidence: false,
        kicker: `${String(index + 1).padStart(2, '0')} / ${ACTS[stage.act].toLocaleUpperCase('es')}` };
    });
  }
  const catalog = new Map([...recordedStory, ...cosmic, ...METHOD_SEQUENCES].map(stage => [stage.id, stage]));
  const common = ['faro', 'pulso', 'anfitriona', 'vuelo', 'plasma', 'galaxia', 'polarizacion', 'tierra',
    'antenas', 'receptor', 'fft', 'potencia', 'matriz', 'bloques', 'alineacion', 'perfil', 'bowtie', 'metodos'];
  const ids = [...common, ...detectionStages(choice.detection), ...classificationStages(choice.classification, choice.detection),
    isRecordedRoute(choice) ? 'candidato' : 'candidate-didactic'];
  return ids.map((id, index) => {
    const stage = catalog.get(id);
    if (!stage) throw new RangeError(`Missing narrative stage: ${id}`);
    const contextual = id === 'faro' ? { ...stage, title: 'Un destello fuera de nuestra galaxia.',
      caption: 'Elegimos un pulso extragaláctico. Su origen compacto es ilustrativo, no una identificación del progenitor.',
      detail: 'Fuente compacta ilustrativa y emisión aislada. El giro orienta el campo; no implica que los FRBs sean pulsos periódicos. Este recorrido extragaláctico no representa una distancia, anfitriona o progenitor medidos.' }
      : id === 'plasma' ? { ...stage, input: 'Pulso extragaláctico', output: 'Llegadas dispersas',
        provenance: 'HOST + IGM · DM PREVIA ILUSTRATIVA 380 pc cm⁻³',
        detail: 'El pulso ya trae 100 pc cm⁻³ de la anfitriona observada. El medio intergaláctico añade 280: DM previa 380 y retardo extremo 0.470892947 s. Halo y disco galácticos añadirán después 120 hasta la DM total 500 del fixture. El reparto es ilustrativo; la integral cosmológica usa densidad y longitud propias con factor 1/(1+z).' }
      : id === 'tierra' ? { ...stage, title: 'Llegamos al Arecibo histórico.',
        caption: 'La señal llega a Puerto Rico. Un reflector fijo concentra el campo sobre su receptor suspendido.',
        provenance: 'ARECIBO 305 m · RECONSTRUCCIÓN HISTÓRICA',
        detail: 'Arecibo descubrió FRB 121102 el 2 de noviembre de 2012 con el receptor ALFA, a frecuencias de radio cercanas a 1.4 GHz. El observatorio se reconstruye en su época operativa, no en su estado actual. El waterfall de esta página es el fixture sintético LF500, no datos del FRB121102 real: DM557.4, ancho3 ms, muestreo65.5 µs.' }
      : id === 'antenas' ? { ...stage, title: 'Un gran reflector. Un receptor.',
        caption: 'El campo ilumina el plato esférico de 305 metros. El receptor suspendido recoge la señal enfocada.',
        input: 'Onda en observatorio', operation: 'Enfoque del reflector', output: 'Voltaje del receptor',
        provenance: 'ARECIBO / ALFA · NO ARREGLO INTERFEROMÉTRICO',
        detail: 'Arecibo era un reflector esférico fijo de 305 m, con plataforma de recepción suspendida por tres torres. ALFA tenía siete haces, no siete antenas independientes. Este trayecto no realiza suma coherente entre platos: esa operación aparece únicamente en el caso ALMA HF.' }
      : id === 'receptor' ? { ...stage, input: 'Voltaje del receptor' } : stage;
    return { ...contextual, kicker: `${String(index + 1).padStart(2, '0')} / ${ACTS[stage.act].toLocaleUpperCase('es')}` };
  });
}

export const actStartsFor = (story: Sequence[]) => ACTS.map((_, act) => story.findIndex(stage => stage.act === act));
export const DEFAULT_STORY = storyFor();
