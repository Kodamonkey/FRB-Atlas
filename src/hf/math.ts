import type { MathTerm, StageMath } from '../math/model';
import { OBSERVATIONS } from '../observations';

const SOURCE = OBSERVATIONS['alma-hf'].source;
const SNR = { title: 'DRAFTS-UC: SNR, normalización y boxcars originales',
  url: 'https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/analysis/snr_utils.py' };
const RESOLUTION = { title: 'DRAFTS-UC: criterio LF/HF con DM máxima de búsqueda',
  url: 'https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/src/core/pipeline_parameters.py#L22' };
const term = (id: string, symbol: string, label: string, unit: string, meaning: string, visual: string): MathTerm =>
  ({ id, symbol, label, unit, meaning, visual });

export const HF_MATH: StageMath[] = [
  { id: 'hf-resolution', formula: String.raw`\begin{aligned}@{delay}&=k_{\rm DM}@{known}(\nu_l^{-2}-\nu_h^{-2})\\@{ratio}&=\frac{k_{\rm DM}@{dm}(\nu_l^{-2}-\nu_h^{-2})}{@{sample}}<2\end{aligned}`,
    terms: [term('delay', String.raw`\Delta t_{conocida}`, 'Retardo físico del pulso', 'µs', 'El plasma retrasa frecuencias bajas; HF no elimina la dispersión.', 'Frentes separados 44.333157 µs para DM conocida.'),
      term('known', String.raw`\mathrm{DM}_{conocida}`, 'DM contextual/inyectada', 'pc cm⁻³', '1770 es conocido/inyectado; este ejemplo no lo estima.', 'Columna electrónica contextual y frentes físicos, no un pico DM ajustado.'),
      term('dm', String.raw`\mathrm{DM}_{max}`, 'DM máxima de búsqueda', 'pc cm⁻³', 'El backend decide LF/HF usando DM máxima 3000, no DM conocida 1770.', 'Criterio R_search de la ruta, separado del retardo del pulso.'),
      term('sample', String.raw`\Delta t_{ef}`, 'Resolución efectiva', 'ms', '32 µs por 128 da 4.096 ms; suma temporal, no promedio.', 'Celda temporal amplia que contiene los frentes.'),
      term('ratio', String.raw`R_{search}`, 'Criterio de ruta', 'adimensional', 'HF para R_search<2 calculado con DMmax; igualdad pertenece a LF.', 'R_search 0.018344957 decide HF; no es la DM estimada.')],
    relation: 'El retardo sigue existiendo, pero resulta menor que la resolución temporal efectiva.',
    units: 'Centros ν en MHz; k_DM=4148.808 s MHz²/(pc cm⁻³). DMmax=3000: R_search=0.018344957. DM conocida/inyectada=1770: Δt/Δt_ef=0.010823525. Ninguna DM estimada.', source: RESOLUTION },
  { id: 'hf-matriz', formula: String.raw`@{cell}[n,j]=\sum_{r=0}^{127}@{native}[128n+r,j],\quad @{time}=32\,\mu s\times128=4.096\,ms`,
    terms: [term('native', String.raw`\Delta I_{nat}`, 'Intensidad residual nativa', 'u.a.', 'Fondo sustraído antes de integrar 128 tiempos; residuos negativos son válidos.', '128 valores aportan una celda efectiva.'),
      term('cell', String.raw`\Delta I_{ef}`, 'Celda residual integrada', 'u.a.', 'Suma temporal; no media. Ruido independiente escala como raíz de 128.', 'Matriz frecuencia-tiempo casi vertical.'),
      term('time', String.raw`\Delta t_{ef}`, 'Duración de celda', 'ms', 'Frecuencias entre 85.268 y 87.268 GHz; centros conservados.', 'Columnas se escriben con tiempo y frecuencia reales.')],
    relation: 'La suma temporal conserva señal integrada; el retardo submuestra deja una banda casi vertical.',
    units: '32 canales, 128 tiempos efectivos, 4.096 ms/celda. ΔI sintética con fondo sustraído; sin calibración en Jy.', source: SOURCE },
  { id: 'hf-profile', formula: String.raw`@{profile}[n]=\sum_j @{weight}_j@{cell}[n,j],\quad\sum_j @{weight}_j=1`,
    terms: [term('cell', 'I', 'Canales', 'u.a.', 'Valores de cada canal a un mismo tiempo efectivo.', 'Columnas del waterfall alimentan la suma.'),
      term('weight', 'w', 'Peso inverso de varianza', 'adimensional', 'Pesos calculados mediante MAD de cada canal; suma uno.', 'Cada canal contribuye con su peso.'),
      term('profile', 'x', 'Perfil integrado', 'u.a.', 'La normalización por bloques se aplica después, antes de filtrar.', 'Perfil escrito muestra a muestra.')],
    relation: 'Canales aportan una serie temporal; pesos y ruido preparan la normalización para SNR.',
    units: 'Perfil de intensidad residual con fondo sustraído, distinto de SNR; normalización y boxcars reutilizan el operador original.', source: SNR },
  { id: 'hf-boxcar', formula: String.raw`@{snr}_W[n]=\frac{\sum_{k=0}^{@{width}-1}@{sample}[n+k-\lfloor W/2\rfloor]}{\sqrt{@{width}}},\quad @{best}[n]=\max_W@{snr}_W[n]`,
    terms: [term('sample', String.raw`x_{norm}`, 'Perfil normalizado', 'adimensional', 'Ruido normalizado por bloques, después de integrar canales.', 'Curva de entrada al banco.'),
      term('width', 'W', 'Anchura del filtro', 'muestras', 'Banco [1,2,3,5,8,15]; anchura física W por 4.096 ms.', 'Filas anchura-tiempo; no son DM.'),
      term('snr', String.raw`\rho`, 'SNR por filtro', 'adimensional', 'Convolución same original; ceros de borde, sin muestras inventadas.', 'Cada fila del banco se construye.'),
      term('best', String.raw`\rho_{max}`, 'Máximo de filtros', 'adimensional', 'Mayor respuesta sobre anchuras; no score neuronal.', 'Perfil SNR y pico resaltado.')],
    relation: 'Boxcars comparan duraciones del mismo pulso; el eje vertical representa anchura, no DM.',
    units: 'Anchuras 4.096, 8.192, 12.288, 20.48, 32.768, 61.44 ms. Salidas de borde usan padding cero.', source: SNR },
  { id: 'hf-candidato', formula: String.raw`@{candidate}=\mathbf1[@{snr}\ge@{threshold}],\quad @{dm}=\mathrm{no\ resuelta},\quad @{candidate}\ne\mathrm{confirmacion}`, 
    terms: [term('snr', String.raw`\rho_{max}`, 'SNR máxima', 'adimensional', 'Métrica calculada por integración y banco boxcar.', 'Pico coral enlazado al banco y waterfall.'),
      term('threshold', String.raw`\eta`, 'Umbral de propuesta', 'adimensional', 'El umbral selecciona sobre salidas cacheadas; no recalcula datos.', 'Línea horizontal que decide el estado.'),
      term('candidate', String.raw`\mathcal C`, 'Candidato clásico', 'propuesta', 'No hay logits, score ni clasificación neuronal HF.', 'Salida explícita pendiente de RFI y contexto.'),
      term('dm', String.raw`\mathrm{DM}_{estimada}`, 'DM no resuelta', 'pc cm⁻³', 'DM contextual/inyectada 1770 no es una medida desde este waterfall.', 'Sin Bow Tie DM-tiempo ni pico DM ficticio.')],
    relation: 'SNR propone un pulso; DM no resuelta y contexto impiden convertirlo en confirmación.',
    units: 'Umbral y SNR adimensionales. Sin clasificación entrenada; PSR J1745−2900 es magnetar galáctico, no FRB.', source: SOURCE },
];
