import type { MathTerm, StageMath } from '../math/model';
import { ATTENTION_SOURCE, FOREST_SOURCE, PRESTO_SOURCE, VIT_SOURCE } from './catalog';

const term = (id: string, symbol: string, label: string, unit: string, meaning: string, visual: string): MathTerm =>
  ({ id, symbol, label, unit, meaning, visual });

export const METHOD_MATH: StageMath[] = [
  { id: 'metodos', formula: String.raw`@{input}\xrightarrow{@{detection}}\mathcal C\xrightarrow{@{classification}}\mathrm{inspeccion}`,
    terms: [term('input', 'X', 'Datos', 'u.a.', 'Perfil o mapa del mismo evento.', 'La matriz conecta con tres ramas.'),
      term('detection', String.raw`\mathcal D`, 'Deteccion', 'operacion', 'Propone tiempos, anchuras o cajas.', 'Primera bifurcacion del recorrido.'),
      term('classification', String.raw`\mathcal F`, 'Clasificacion', 'operacion', 'Ordena o revisa candidatos; no confirma su origen.', 'Ramas convergen hacia inspeccion.')],
    relation: 'La estrategia cambia las operaciones; el evento conserva su identidad y procedencia.',
    units: 'Deteccion y clasificacion son operadores distintos. No toda ruta posee una inferencia registrada.', source: PRESTO_SOURCE },
  { id: 'boxcar', formula: String.raw`@{snr}_W[n]=\frac{\sum_{k=0}^{@{width}-1}(@{sample}[n+k]-\mu)}{@{noise}\sqrt{@{width}}}`,
    terms: [term('sample', 'x', 'Perfil', 'u.a.', 'Muestras del perfil tras dedispersion y estimacion de fondo.', 'Curva de entrada y celdas de la ventana.'),
      term('width', 'W', 'Anchura', 'muestras', 'Numero de muestras completas dentro de la ventana.', 'Rectangulo que recorre el perfil.'),
      term('noise', String.raw`\sigma`, 'Ruido de una muestra', 'u.a.', 'Desviacion tipica del fondo; ejemplo sin ruido correlacionado.', 'Escala normalizadora del filtro.'),
      term('snr', String.raw`\rho`, 'SNR filtrada', 'adimensional', 'Suma sobre ruido esperado; no significancia tras multiples ensayos.', 'Curva escrita al completar cada ventana.')],
    relation: 'Un filtro adaptado a la anchura acumula senal y normaliza el ruido esperado.',
    units: 'W en muestras; duracion W Delta t en s. Supuesto: ruido blanco independiente.', source: PRESTO_SOURCE },
  { id: 'boxcar-bank', formula: String.raw`@{best}[n]=\max_{@{width}\in\mathcal W}@{snr}_W[n],\quad\mathcal W=\{1,2,4,8,14,20\}`,
    terms: [term('width', 'W', 'Banco de anchuras', 'muestras', 'Se prueban seis duraciones sobre el mismo perfil.', 'Seis curvas se construyen una tras otra.'),
      term('snr', String.raw`\rho`, 'SNR por anchura', 'adimensional', 'Cada salida divide por su propia raiz de anchura.', 'Filas coloreadas del banco.'),
      term('best', String.raw`\rho_{\max}`, 'Maximo del banco', 'adimensional', 'El mejor filtro depende de la forma del pulso.', 'Comparacion de las curvas disponibles.')],
    relation: 'La anchura adecuada concentra el pulso sin integrar demasiado ruido.',
    units: 'Con Delta t=1 ms, W=14 ocupa 14 ms. Banco pedagogico, no configuracion completa de PRESTO.', source: PRESTO_SOURCE },
  { id: 'boxcar-threshold', formula: String.raw`@{candidate}=\left\{(@{time},W):@{snr}_W[n]>@{threshold}\right\}`,
    terms: [term('snr', String.raw`\rho`, 'SNR', 'adimensional', 'Respuesta normalizada del filtro, con salidas solapadas.', 'Curva que cruza la linea de umbral.'),
      term('threshold', String.raw`\eta`, 'Umbral', 'adimensional', 'Nivel ilustrativo seis; no controla falsos positivos por si solo.', 'Linea amarilla horizontal.'),
      term('time', String.raw`n\Delta t`, 'Tiempo', 's', 'Inicio de una ventana completa del ejemplo.', 'Marcas temporales bajo cada pico.'),
      term('candidate', String.raw`\mathcal C`, 'Propuestas', 'conjunto', 'Ventanas seleccionadas para agrupar e inspeccionar despues.', 'Marcas propuestas; no confirmaciones.')],
    relation: 'Cruzar un umbral crea propuestas, no una confirmacion ni una probabilidad astrofisica.',
    units: 'SNR y umbral adimensionales; tiempo en s. Ensayos y correlaciones requieren control adicional.', source: PRESTO_SOURCE },
  { id: 'vit-patches', formula: String.raw`@{token}_i=@{patch}_i@{projection}+@{position}_i`,
    terms: [term('patch', String.raw`x_i`, 'Parche', '16 valores', 'Una region cuatro por cuatro se aplana en orden de filas.', 'Cada bloque de la imagen se separa.'),
      term('projection', 'E', 'Proyeccion', '16 x 4', 'Matriz analitica publicada; no son pesos aprendidos.', 'Los productos producen cuatro componentes.'),
      term('position', String.raw`p_i`, 'Posicion', '4 valores', 'Codigo fijo de fila y columna para distinguir parches.', 'Indice y lugar de cada token.'),
      term('token', String.raw`z_i`, 'Token', '4 valores', 'Vector que conserva contenido y posicion del parche.', 'Secuencia de dieciseis vectores.')],
    relation: 'Los parches conectan coordenadas de una imagen con vectores que puede relacionar la atencion.',
    units: 'Imagen reducida 16 x 16, P=4, N=16, d=4. Valores normalizados adimensionales.', source: VIT_SOURCE },
  { id: 'vit-detection', formula: String.raw`\begin{aligned}@{weights}&=\mathrm{softmax}_{\rm fila}\left(\frac{@{query}@{key}^{\!T}}{\sqrt{4}}\right)\\@{output}&=@{weights}@{value}\end{aligned}`,
    terms: [term('query', 'Q', 'Consultas', '16 x 4', 'Cada token pregunta por relacion con los restantes.', 'Fila activa y productos de consulta.'),
      term('key', 'K', 'Claves', '16 x 4', 'Vectores comparados con cada consulta mediante producto escalar.', 'Columnas que aportan productos.'),
      term('weights', 'A', 'Pesos de atencion', '16 x 16', 'Softmax por fila; cada fila suma uno.', 'Matriz escrita producto por producto.'),
      term('value', 'V', 'Valores', '16 x 4', 'Contenido que cada fila pondera y combina.', 'Vectores a la derecha de los pesos.'),
      term('output', 'Y', 'Salida contextual', '16 x 4', 'Combinacion convexa de valores para cada consulta.', 'Vectores de salida al completar filas.')],
    relation: 'Consultas y claves construyen pesos; los pesos combinan valores, no determinan una caja por si solos.',
    units: 'Una cabeza con d=4. Matrices y softmax adimensionales; todos los pesos son didacticos.', source: ATTENTION_SOURCE },
  { id: 'vit-proposals', formula: String.raw`(@{center},@{extent})=@{head}(@{token})`,
    terms: [term('token', 'Y', 'Tokens', '16 x 4', 'La atencion aporta representaciones, no coordenadas fisicas directas.', 'Secuencia antes de la cabeza esquematica.'),
      term('head', String.raw`g_\theta`, 'Cabeza de deteccion', 'operador', 'Debe entrenarse y calibrarse para localizar eventos.', 'Contrato del bloque, sin calculo aprendido.'),
      term('center', String.raw`\hat c`, 'Centro propuesto', 'px de ejemplo', 'Coordenadas dibujadas a mano sin conversion a tiempo o DM.', 'Centro coral dentro de la caja ilustrativa.'),
      term('extent', String.raw`\hat w`, 'Extension propuesta', 'px de ejemplo', 'Caja esquematica, no prediccion de un modelo.', 'Rectangulo alrededor de una region.')],
    relation: 'ViT describe representaciones; detectar FRBs exige una cabeza y entrenamiento especificos, ausentes en este ejemplo.',
    units: 'Cajas en coordenadas graficas; sin puntuacion, pesos entrenados ni inferencia de DM.', source: VIT_SOURCE },
  { id: 'radio-checks', formula: String.raw`@{delay}(\nu)\propto\nu^{-2},\quad @{excess}=@{observed}-@{galactic}`,
    terms: [term('delay', String.raw`\Delta t`, 'Ley dispersiva', 's', 'El plasma frio retrasa mas las frecuencias bajas.', 'Curvas que se concentran al corregir dispersion.'),
      term('observed', String.raw`\mathrm{DM}_{obs}`, 'DM observada', 'pc cm^-3', 'Parametro ajustado de los retardos, con incertidumbre.', 'Pico del barrido de prueba.'),
      term('galactic', String.raw`\mathrm{DM}_{MW}`, 'Modelo galactico', 'pc cm^-3', 'Contribucion esperada; depende de direccion y modelo electronico.', 'Referencia esquematica, no valor estimado aqui.'),
      term('excess', String.raw`\mathrm{DM}_{exc}`, 'Exceso de DM', 'pc cm^-3', 'Contexto compatible con electrones adicionales; no distancia ni confirmacion unica.', 'Separacion entre parametro y referencia.')],
    relation: 'Las relaciones fisicas guian inspeccion, pero localizacion e interferencia siguen siendo indispensables.',
    units: 'No se calcula DM galactica ni distancia. Los criterios de esta escena son esquematicos.',
    source: { title: 'NRAO: pulsars, dispersion and searches', url: 'https://www.cv.nrao.edu/~sransom/web/Ch6.html' } },
  { id: 'forest-features', formula: String.raw`@{features}=\left(@{snr},@{width},@{dm},@{occupancy}\right)`,
    terms: [term('snr', String.raw`\rho`, 'SNR', 'adimensional', 'Rasgo ilustrativo ocho; no score del detector seleccionado.', 'Primera barra del vector.'),
      term('width', 'w', 'Anchura', 'ms', 'Duracion ilustrativa seis milisegundos.', 'Segunda barra con unidad ms.'),
      term('dm', String.raw`\mathrm{DM}`, 'DM', 'pc cm^-3', 'Valor ilustrativo quinientos, no una medicion nueva.', 'Tercera barra con unidad de columna electronica.'),
      term('occupancy', String.raw`f_B`, 'Ocupacion de banda', 'fraccion', 'Fraccion ilustrativa 0.75 de canales con senal.', 'Cuarta barra entre cero y uno.'),
      term('features', String.raw`\mathbf f`, 'Vector', '4 rasgos', 'Rasgos con unidades diferentes; escalado grafico no normaliza un modelo.', 'Cuatro componentes juntas antes del bosque.')],
    relation: 'Un vector resume rasgos medibles; cada componente conserva su definicion y unidad.',
    units: 'Ejemplo fijo [8, 6 ms, 500 pc cm^-3, 0.75]. No se extrae del evento registrado.', source: FOREST_SOURCE },
  { id: 'forest', formula: String.raw`@{vote}_c=\frac{1}{@{count}}\sum_{j=1}^{@{count}}\mathbf 1\left[@{tree}_j(@{features})=c\right]`,
    terms: [term('features', String.raw`\mathbf f`, 'Rasgos', '4 valores', 'Cada comparacion consulta un rasgo concreto del vector.', 'Vector que alimenta los tres arboles.'),
      term('tree', 'T', 'Arbol', 'reglas', 'Reglas escritas a mano; no bootstrap ni entrenamiento.', 'Rama amarilla que conduce a una hoja.'),
      term('count', 'M', 'Numero de arboles', '3', 'Tres arboles del ejemplo aportan un voto cada uno.', 'Las tres hojas completadas.'),
      term('vote', String.raw`v`, 'Fraccion de votos', 'adimensional', 'Resumen de reglas; no probabilidad calibrada ni confirmacion.', 'Acumulacion de votos hacia la salida.')],
    relation: 'Los arboles separan espacios de rasgos; sus votos combinan decisiones distintas.',
    units: 'Umbrales de SNR, ms, pc cm^-3 y fraccion publicados. Bosque de juguete, no entrenado.', source: FOREST_SOURCE },
  { id: 'vit-classification', formula: String.raw`\begin{aligned}@{pool}&=\frac{1}{16}\sum_i @{token}_i\\@{logit}&=@{pool}W+b\\@{probability}&=\mathrm{softmax}(@{logit})\end{aligned}`,
    terms: [term('token', 'Y', 'Tokens', '16 x 4', 'Parches del recorte ilustrativo tras una cabeza de atencion.', 'Tokens escritos antes de la agregacion.'),
      term('pool', 'h', 'Agregacion', '4 valores', 'Media de tokens; variante sin token CLS.', 'Cuatro componentes al terminar la suma.'),
      term('logit', String.raw`\ell`, 'Logits', '2 valores', 'Proyeccion lineal fija publicada, no aprendida.', 'Dos barras antes de normalizar.'),
      term('probability', 'p', 'Softmax didactica', 'adimensional', 'Dos salidas normalizadas; no probabilidades astrofisicas.', 'Ultimas barras, etiquetadas como ejemplo.')],
    relation: 'La agregacion convierte tokens en logits; normalizarlos no transforma un ejemplo en confirmacion astrofisica.',
    units: '16 tokens, dimension 4, cabeza 4 x 2. Recorte, pesos y salidas son ilustrativos.', source: VIT_SOURCE },
  { id: 'resnet-didactic', formula: String.raw`@{output}=\mathrm{ReLU}\left(@{identity}+@{convolution}(@{identity})\right)`,
    terms: [term('identity', 'x', 'Identidad', '8 valores', 'Vector fijo que atraviesa el camino directo.', 'Camino coral que evita la convolucion.'),
      term('convolution', 'F', 'Convolucion', '8 valores', 'Kernel fijo de tres valores; padding cero y paso uno.', 'Camino cian con productos y suma.'),
      term('output', 'y', 'Suma residual', '8 valores', 'ReLU de la suma de caminos con dimensiones identicas.', 'Cada barra aparece al sumar ambos caminos.')],
    relation: 'Un residual suma dos caminos compatibles; no reemplaza pesos entrenados ni clasifica este evento.',
    units: 'Valores normalizados adimensionales. Kernel [0.25,0.5,0.25]; ocho posiciones, padding cero.',
    source: { title: 'He et al.: Deep Residual Learning', url: 'https://arxiv.org/abs/1512.03385' } },
  { id: 'candidate-didactic', formula: String.raw`@{proposal}\ne@{confirmation},\qquad @{inspection}(@{proposal},\mathrm{contexto})`,
    terms: [term('proposal', String.raw`\mathcal C`, 'Propuesta', 'sin score entrenado', 'Salida ilustrativa que aun requiere datos observacionales.', 'Caja abierta, sin sello de confirmacion.'),
      term('inspection', String.raw`\mathcal I`, 'Inspeccion', 'proceso', 'Control de interferencia, unidades, coordenadas y procedencia.', 'Tres caminos aportan contexto a la propuesta.'),
      term('confirmation', String.raw`\mathrm{FRB}_{confirmado}`, 'Confirmacion', 'evidencia independiente', 'No se obtiene de una animacion, voto o softmax.', 'Limite explicito de la ficha ilustrativa.')],
    relation: 'Las propuestas guian investigacion; la confirmacion exige evidencia independiente del metodo y de esta animacion.',
    units: 'Ruta didactica: sin score, logits aprendidos, DM estimada ni probabilidad astrofisica.',
    source: { title: 'NRAO: pulsars and radio observations', url: 'https://www.cv.nrao.edu/~sransom/web/Ch6.html' } },
];

function finite(values: ArrayLike<number>) {
  for (let index = 0; index < values.length; index++) if (!Number.isFinite(values[index])) throw new RangeError('Values must be finite');
}

export function boxcarFilter(values: ArrayLike<number>, width: number, mean = 0, sigma = 1): Float64Array {
  if (!Number.isInteger(width) || width < 1 || width > values.length) throw new RangeError('Invalid boxcar width');
  if (!Number.isFinite(mean) || !Number.isFinite(sigma) || sigma <= 0) throw new RangeError('Invalid noise normalization');
  finite(values);
  const result = new Float64Array(values.length - width + 1), scale = sigma * Math.sqrt(width);
  let sum = 0;
  for (let i = 0; i < width; i++) sum += values[i] - mean;
  for (let n = 0; n < result.length; n++) {
    result[n] = sum / scale;
    if (n + width < values.length) sum += values[n + width] - values[n];
  }
  return result;
}

export function stableSoftmax(values: ArrayLike<number>): Float64Array {
  if (!values.length) throw new RangeError('Softmax requires values');
  finite(values);
  let maximum = -Infinity;
  for (let i = 0; i < values.length; i++) maximum = Math.max(maximum, values[i]);
  const output = Float64Array.from(values, value => Math.exp(value - maximum));
  const sum = output.reduce((total, value) => total + value, 0);
  for (let i = 0; i < output.length; i++) output[i] /= sum;
  return output;
}

export type NumericMatrix = readonly (readonly number[])[];
function shape(matrix: NumericMatrix): [number, number] {
  const columns = matrix[0]?.length ?? 0;
  if (!matrix.length || !columns || matrix.some(row => row.length !== columns)) throw new RangeError('Matrix must be nonempty and rectangular');
  matrix.forEach(finite);
  return [matrix.length, columns];
}

export function scaledDotAttention(query: NumericMatrix, key: NumericMatrix, value: NumericMatrix) {
  const [rows, depth] = shape(query), [keys, keyDepth] = shape(key), [valueRows, valueDepth] = shape(value);
  if (depth !== keyDepth || keys !== valueRows) throw new RangeError('Attention dimensions mismatch');
  const scores: number[][] = [], weights: number[][] = [], output: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row = Array.from({ length: keys }, (_, j) => query[i].reduce((sum, q, d) => sum + q * key[j][d], 0) / Math.sqrt(depth));
    const normalized = Array.from(stableSoftmax(row));
    scores.push(row); weights.push(normalized);
    output.push(Array.from({ length: valueDepth }, (_, d) => normalized.reduce((sum, a, j) => sum + a * value[j][d], 0)));
  }
  return { scores, weights, output };
}

export function patchify(values: ArrayLike<number>, width: number, height: number, patch: number): number[][] {
  if (![width, height, patch].every(value => Number.isInteger(value) && value > 0)
    || width % patch || height % patch || values.length !== width * height) throw new RangeError('Invalid patch dimensions');
  finite(values);
  const result: number[][] = [];
  for (let row = 0; row < height; row += patch) for (let column = 0; column < width; column += patch) {
    const output: number[] = [];
    for (let y = 0; y < patch; y++) for (let x = 0; x < patch; x++) output.push(values[(row + y) * width + column + x]);
    result.push(output);
  }
  return result;
}

// Analytic demonstration weights. None were learned or loaded from a checkpoint.
export const TOY_PROJECTION: number[][] = Array.from({ length: 16 }, (_, i) =>
  Array.from({ length: 4 }, (_, j) => Math.cos((i + 1) * (j + 1)) / 4));
export const TOY_Q: number[][] = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
export const TOY_K: number[][] = [[.8,0,.2,0],[0,.8,0,.2],[.2,0,.8,0],[0,.2,0,.8]];
export const TOY_V: number[][] = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
export const TOY_HEAD: number[][] = [[.6,-.6],[-.3,.3],[.4,-.4],[-.2,.2]];
export const TOY_BIAS = [0,0] as const;

export const TOY_PROFILE: readonly number[] = Array.from({ length: 64 }, (_, n) =>
  (Math.sin(1.7 * n) + .7 * Math.cos(.47 * n)) / Math.sqrt(.745) + 4 * Math.exp(-.5 * ((n - 31) / 2.5) ** 2));
export const TOY_MAP: readonly number[] = Array.from({ length: 256 }, (_, n) => {
  const y = Math.floor(n / 16), x = n % 16, width = .6 + Math.abs(y - 7.5) * .24;
  return .05 * Math.sin(n * 1.31) + Math.exp(-.5 * ((x - 7.5) / width) ** 2) * Math.exp(-.5 * ((y - 7.5) / 4) ** 2);
});
export const TOY_CROP: readonly number[] = Array.from({ length: 256 }, (_, n) =>
  .05 * Math.sin(n * 1.31) + Math.exp(-.5 * ((n % 16 - 7.5) / 1.2) ** 2));
export const TOY_RESIDUAL_INPUT = [.2,-.8,.4,1.5,.9,-.2,.1,.4] as const;
export const TOY_RESIDUAL_KERNEL = [.25,.5,.25] as const;
export function toyResidual(values: readonly number[] = TOY_RESIDUAL_INPUT) {
  finite(values);
  const convolution = values.map((_, n) => TOY_RESIDUAL_KERNEL.reduce((sum, weight, k) => sum + weight * (values[n + k - 1] ?? 0), 0));
  return { input: [...values], convolution, output: values.map((value, n) => Math.max(0, value + convolution[n])) };
}

export function multiplyMatrices(left: NumericMatrix, right: NumericMatrix): number[][] {
  const [rows, common] = shape(left), [rightRows, columns] = shape(right);
  if (common !== rightRows) throw new RangeError('Matrix product dimensions mismatch');
  return Array.from({ length: rows }, (_, i) => Array.from({ length: columns }, (_, j) =>
    left[i].reduce((sum, value, k) => sum + value * right[k][j], 0)));
}

export function toyTokens(values: ArrayLike<number>): number[][] {
  return multiplyMatrices(patchify(values, 16, 16, 4), TOY_PROJECTION).map((token, index) =>
    token.map((value, d) => value + (d % 2 === 0 ? Math.floor(index / 4) : index % 4) / 30));
}
export function toyTransformer(values: ArrayLike<number>) {
  const tokens = toyTokens(values), query = multiplyMatrices(tokens, TOY_Q), key = multiplyMatrices(tokens, TOY_K),
    value = multiplyMatrices(tokens, TOY_V), attention = scaledDotAttention(query, key, value);
  const pool = Array.from({ length: 4 }, (_, d) => attention.output.reduce((sum, token) => sum + token[d], 0) / 16);
  const logits = multiplyMatrices([pool], TOY_HEAD)[0].map((value, i) => value + TOY_BIAS[i]);
  return { tokens, query, key, value, ...attention, pool, logits, probabilities: Array.from(stableSoftmax(logits)) };
}

export interface ToyTreeNode { feature?: number; threshold?: number; below?: ToyTreeNode; above?: ToyTreeNode; vote?: 0 | 1 }
export const TOY_FEATURES = [8,6,500,.75] as const;
export const TOY_TREES: ToyTreeNode[] = [
  { feature: 0, threshold: 6, below: { vote: 0 }, above: { feature: 2, threshold: 10, below: { vote: 0 }, above: { vote: 1 } } },
  { feature: 1, threshold: 30, above: { vote: 0 }, below: { feature: 3, threshold: .2, below: { vote: 0 }, above: { vote: 1 } } },
  { feature: 2, threshold: 20, below: { vote: 0 }, above: { feature: 3, threshold: .35, below: { vote: 0 }, above: { vote: 1 } } },
];
export function toyForest(features: readonly number[]) {
  if (features.length !== 4) throw new RangeError('Forest expects four features');
  finite(features);
  const paths: { feature: number; threshold: number; direction: 'below' | 'above' }[][] = [];
  const votes = TOY_TREES.map(tree => {
    const path: typeof paths[number] = [];
    let node = tree;
    while (node.vote === undefined) {
      const direction = features[node.feature!] < node.threshold! ? 'below' : 'above';
      path.push({ feature: node.feature!, threshold: node.threshold!, direction }); node = node[direction]!;
    }
    paths.push(path); return node.vote;
  });
  return { votes, paths, fraction: votes.reduce<number>((sum, vote) => sum + vote, 0) / votes.length };
}
