import type { Sequence } from '../story';

export type DetectionMethod = 'boxcar' | 'cnn' | 'transformer';
export type ClassificationMethod = 'radio' | 'forest' | 'resnet' | 'transformer';
export interface MethodSelection { detection: DetectionMethod; classification: ClassificationMethod }
export const DEFAULT_METHODS: MethodSelection = { detection: 'cnn', classification: 'resnet' };

interface MethodOption<T> {
  id: T;
  label: string;
  description: string;
  provenance: 'recorded' | 'didactic';
  source: { title: string; url: string };
  input: string;
  output: string;
  stages: readonly string[];
}

export const PRESTO_SOURCE = {
  title: 'PRESTO: single_pulse_search.py',
  url: 'https://github.com/scottransom/presto/blob/master/bin/single_pulse_search.py',
};
export const ATTENTION_SOURCE = { title: 'Vaswani et al.: Scaled Dot-Product Attention', url: 'https://arxiv.org/abs/1706.03762' };
export const VIT_SOURCE = { title: 'Dosovitskiy et al.: Vision Transformer', url: 'https://arxiv.org/abs/2010.11929' };
export const FOREST_SOURCE = { title: 'Breiman: Random Forests (2001)', url: 'https://www.stat.berkeley.edu/~breiman/randomforest2001.pdf' };

export const DETECTION_METHODS: readonly MethodOption<DetectionMethod>[] = [
  { id: 'boxcar', label: 'Boxcar / PRESTO', description: 'Integra perfiles dedispersados con varias anchuras y compara una SNR normalizada.',
    provenance: 'didactic', source: PRESTO_SOURCE, input: 'Perfil dedispersado', output: 'Picos de SNR y anchura',
    stages: ['boxcar', 'boxcar-bank', 'boxcar-threshold'] },
  { id: 'cnn', label: 'CNN / CenterNet', description: 'Localiza centros y cajas sobre el mapa DM-tiempo; traza CPU precalculada.',
    provenance: 'recorded', source: { title: 'DRAFTS: detector convolucional', url: 'https://arxiv.org/abs/2410.03200' },
    input: 'Mapa DM-tiempo preparado como RGB', output: 'Caja con centro DM-tiempo',
    stages: ['rgb', 'backbone', 'upsampling', 'cabezas', 'centernet'] },
  { id: 'transformer', label: 'Transformer visual', description: 'Relaciona parches mediante atencion; propuestas esquematicas, sin detector entrenado.',
    provenance: 'didactic', source: VIT_SOURCE, input: 'Parches del mapa DM-tiempo', output: 'Propuestas ilustrativas',
    stages: ['vit-patches', 'vit-detection', 'vit-proposals'] },
];

export const CLASSIFICATION_METHODS: readonly MethodOption<ClassificationMethod>[] = [
  { id: 'radio', label: 'Inspeccion radio', description: 'Compara dispersion, anchura, ocupacion y contexto; ningun criterio confirma por si solo.',
    provenance: 'didactic', source: { title: 'NRAO: dispersion y busqueda de pulsos', url: 'https://www.cv.nrao.edu/~sransom/web/Ch6.html' },
    input: 'Perfil, mapa y contexto del candidato', output: 'Criterios para inspeccion', stages: ['radio-checks'] },
  { id: 'forest', label: 'Random Forest', description: 'Arboles combinan caracteristicas; reglas publicadas y didacticas, no un bosque entrenado.',
    provenance: 'didactic', source: FOREST_SOURCE, input: 'SNR, anchura, DM y ocupacion', output: 'Votos ilustrativos',
    stages: ['forest-features', 'forest'] },
  { id: 'resnet', label: 'CNN / ResNet', description: 'Clasifica el recorte rectangular; traza real solo para su entrada exacta.',
    provenance: 'recorded', source: { title: 'He et al.: Deep Residual Learning', url: 'https://arxiv.org/abs/1512.03385' },
    input: 'Intensidad dedispersada: 1 x 512 x 64', output: 'Dos logits registrados', stages: ['recorte', 'resnet', 'decision'] },
  { id: 'transformer', label: 'Transformer visual', description: 'Atencion, agregacion y logits didacticos; sin entrenamiento ni probabilidad astrofisica.',
    provenance: 'didactic', source: VIT_SOURCE, input: 'Parches del recorte ilustrativo', output: 'Dos salidas ilustrativas',
    stages: ['vit-classification'] },
];

export function detectionStages(method: DetectionMethod): string[] {
  return [...DETECTION_METHODS.find(option => option.id === method)!.stages];
}
export function classificationStages(method: ClassificationMethod, detection: DetectionMethod = 'cnn'): string[] {
  if (method === 'resnet' && detection !== 'cnn') return ['resnet-didactic'];
  return [...CLASSIFICATION_METHODS.find(option => option.id === method)!.stages];
}
export function hasRecordedInference(methods: MethodSelection): boolean {
  return methods.detection === 'cnn' && methods.classification === 'resnet';
}

function sequence(id: string, title: string, caption: string, input: string, operation: string, output: string,
  detail: string, readout: Sequence['readout'] = 'network'): Sequence {
  return { id, act: 5, kicker: 'METODO / EJEMPLO', title, caption, input, operation, output, readout,
    provenance: 'EJEMPLO DIDACTICO / SIN MODELO ENTRENADO', detail, requiresEvidence: false };
}

export const METHOD_SEQUENCES: Sequence[] = [
  sequence('metodos', 'Un evento. Varias estrategias.', 'El perfil y el mapa permiten buscar y clasificar con operaciones diferentes.',
    'Perfil y mapa', 'Eleccion de metodo', 'Ruta de analisis',
    'Deteccion propone eventos; clasificacion ordena candidatos. Las alternativas ilustran operadores, no ejecutan modelos entrenados. Solo CNN seguida de ResNet conserva la traza exacta registrada.'),
  sequence('boxcar', 'Una ventana recoge el pulso.', 'El filtro suma muestras y divide por el ruido esperado para su anchura.',
    'Perfil dedispersado', 'Filtro normalizado', 'SNR por ventana',
    'SNR=sum(x-mu)/(sigma sqrt(W)): ruido blanco independiente y fondo estimado. Ventanas completas sin padding. Este ejemplo local no reproduce detrending, mascaras y agrupamiento de PRESTO.', 'profile'),
  sequence('boxcar-bank', 'Cada anchura hace otra pregunta.', 'Ventanas estrechas y amplias responden distinto al mismo pulso.',
    'Perfil', 'Banco de anchuras', 'SNR por tiempo y anchura',
    'Banco didactico de 1, 2, 4, 8, 14 y 20 muestras. Con dt=1 ms, anchuras numericas iguales en ms. No constituye un barrido completo sobre DM ni un catalogo de PRESTO.', 'profile'),
  sequence('boxcar-threshold', 'El umbral propone candidatos.', 'Los picos que cruzan el umbral pasan a inspeccion; los ensayos multiples importan.',
    'Banco SNR', 'Umbral', 'Propuestas de pulsos',
    'Umbral ilustrativo 6, adimensional. Las ventanas se solapan; sus salidas no son independientes. Superar el umbral no demuestra origen extragalactico ni reemplaza RFI, agrupamiento y seguimiento.', 'profile'),
  sequence('vit-patches', 'El mapa se vuelve una secuencia.', 'Parches conservan posiciones y producen vectores que la atencion relaciona.',
    'Mapa DM-tiempo', 'Parches y proyeccion', 'Tokens',
    'Vista reducida 16x16, parches 4x4 y 16 tokens de dimension 4. Proyecciones y posiciones analiticas publicadas, no aprendidas. El cambio de resolucion es grafico y no sustituye la matriz nativa.'),
  sequence('vit-detection', 'Cada parche consulta a los demas.', 'Productos entre consultas y claves construyen pesos; esos pesos combinan valores.',
    'Tokens', 'QK / softmax / V', 'Tokens contextualizados',
    'Atencion de una cabeza: QK^T/sqrt(4), softmax por fila y AV. Pesos fijados para explicar productos, no un ViT entrenado. Atencion no es una explicacion causal del modelo.'),
  sequence('vit-proposals', 'La atencion no es un detector.', 'Una cabeza entrenada podria producir cajas; aqui mostramos solo su contrato.',
    'Tokens contextualizados', 'Cabeza esquematica', 'Propuestas ilustrativas',
    'ViT original clasifica imagenes; no define por si solo un detector de FRBs. Cajas dibujadas a mano muestran una posible salida y se etiquetan como esquematicas, sin score ni conversion cientifica.'),
  sequence('radio-checks', 'Inspeccionamos relaciones, no etiquetas.', 'Dispersion, anchura y contexto aportan evidencia; ningun rasgo aislado confirma un FRB.',
    'Candidato y contexto', 'Criterios de radio', 'Inspeccion',
    'La ley nu^-2 y concentracion al dedispersar son pruebas fisicas utiles. DM superior a un modelo galactico aporta contexto, pero requiere incertidumbres, localizacion y descarte de interferencia.'),
  sequence('forest-features', 'Resumimos rasgos del candidato.', 'SNR, anchura, DM y ocupacion forman un vector con unidades explicitas.',
    'Perfil y contexto', 'Extraccion de rasgos', 'Vector de 4 rasgos',
    'Vector fijo ilustrativo [8, 6 ms, 500 pc cm^-3, 0.75]. No se extrae del recorte real ni se atribuye al detector elegido. La ocupacion es una fraccion de banda definida por el ejemplo.'),
  sequence('forest', 'Varios arboles emiten votos.', 'Cada rama compara un rasgo; la fraccion de votos resume reglas distintas.',
    'Vector de rasgos', 'Arboles y votos', 'Votos ilustrativos',
    'Tres arboles escritos a mano, con umbrales publicados; no se entrenaron con bootstrap ni seleccion aleatoria de rasgos. Ilustran evaluacion y votacion, no exactitud de un Random Forest real.'),
  sequence('vit-classification', 'Los tokens producen dos salidas.', 'La atencion mezcla el recorte; agregacion y proyeccion producen logits didacticos.',
    'Recorte ilustrativo', 'Atencion y agregacion', 'Logits ilustrativos',
    'Recorte sintetico fijo 16x16, parches 4x4, 16 tokens y cabeza lineal publicada 4x2. Agregacion media sin token CLS: variante didactica. Softmax no estima probabilidad astrofisica ni usa pesos aprendidos.'),
  sequence('resnet-didactic', 'Dos caminos vuelven a sumarse.', 'Una convolucion didactica y el camino identidad producen una suma residual.',
    'Vector ilustrativo', 'Convolucion y residual', 'Activacion ilustrativa',
    'Ejemplo fijo de ocho valores, kernel [0.25,0.5,0.25], padding cero, paso uno, identidad y ReLU. No reutiliza la traza ResNet registrada porque el detector alternativo no reproduce su entrada exacta.'),
  sequence('candidate-didactic', 'Una propuesta pide mas evidencia.', 'Deteccion propone; clasificacion orienta; observacion y contexto permiten investigar.',
    'Salida didactica', 'Inspeccion', 'Propuesta ilustrativa',
    'Esta ruta no tiene checkpoint ni puntuacion astrofisica. Todos los diagramas alternativos son ejemplos pedagogicos. Confirmar origen requiere datos calibrados, control de interferencia y evidencia observacional independiente.'),
];
