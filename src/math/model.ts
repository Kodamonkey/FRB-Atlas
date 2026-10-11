import { COSMIC_MATH } from './cosmicMath';
import { METHOD_MATH } from '../methods/math';

export interface MathTerm {
  id: string;
  symbol: string;
  label: string;
  unit: string;
  meaning: string;
  visual: string;
}

export interface StageMath {
  id: string;
  formula: string;
  terms: MathTerm[];
  relation: string;
  units: string;
  source: { title: string; url: string };
  example?: string;
}

const BASELINE = 'https://github.com/Kodamonkey/DRAFTS-UC/blob/04e5f7b44c4c4ae3d7e59dda8b8278b371f6fcd3/';
const PULSARS = { title: 'NRAO: Essential Radio Astronomy, pulsars', url: 'https://www.cv.nrao.edu/~sransom/web/Ch6.html' };
const INTERFEROMETRY = { title: 'NRAO: interferometro de dos elementos', url: 'https://www.cv.nrao.edu/~sransom/web/Ch3.html#Ch3.S7.SS1' };
const DEDISPERSION = { title: 'DRAFTS-UC: dedispersor original', url: `${BASELINE}src/preprocessing/dedispersion.py` };
const DETECTOR = { title: 'DRAFTS-UC: CenterNet concreto', url: `${BASELINE}src/models/ObjectDet/centernet_model.py` };
const DECODE = { title: 'DRAFTS-UC: decode y NMS', url: `${BASELINE}src/models/ObjectDet/centernet_utils.py` };

function term(id: string, symbol: string, label: string, unit: string, meaning: string, visual: string): MathTerm {
  return { id, symbol, label, unit, meaning, visual };
}

export const MATH_STAGES: StageMath[] = [
  {
    id: 'faro',
    formula: String.raw`@{field}(t)=R_{\hat\Omega}(@{rotation})\mathbf B_0,\qquad @{rotation}=\Omega t`,
    terms: [
      term('rotation', String.raw`\varphi`, 'Rotacion', 'rad', 'Angulo de giro del modelo ilustrativo.', 'Eje y orientacion del haz.'),
      term('field', String.raw`\mathbf B`, 'Campo magnetico', 'u.a.', 'Direccion magnetica representada; sin calibracion de campo.', 'Dipolo y haces polares.'),
    ],
    relation: 'El giro orienta el haz; no identifica el progenitor real del candidato.',
    units: 'Angulo en radianes; campo ilustrativo en unidades arbitrarias, no teslas medidos.',
    source: PULSARS,
    example: 'Faro ilustrativo: no es una observacion del origen del evento LF.',
  },
  {
    id: 'pulso',
    formula: String.raw`@{field}(t)=@{envelope}(t)\cos(2\pi\nu_0t),\qquad @{intensity}(t)\propto @{envelope}^{2}(t)`,
    terms: [
      term('field', 'E', 'Campo electrico', 'u.a.', 'Portadora oscilante dentro del paquete ilustrativo.', 'Oscilaciones interiores del paquete.'),
      term('envelope', 'a', 'Envolvente', 'u.a.', 'Amplitud lenta que delimita el campo, no su intensidad.', 'Contorno exterior del paquete.'),
      term('intensity', 'I', 'Intensidad', 'u.a.^2', 'Promedio del campo al cuadrado; proporcional al cuadrado de la envolvente.', 'Anchura del paquete de intensidad.'),
    ],
    relation: 'Campo y envolvente describen amplitud; intensidad escala con su cuadrado.',
    units: 'Ejemplo sin calibracion. FWHM intrinseca inyectada: 6 ms de intensidad, no de campo.',
    source: { title: 'NRAO: potencia y radiometria', url: 'https://www.cv.nrao.edu/~sransom/web/Ch3.html' },
    example: 'Gaussiana: sigma de intensidad 2.547965 ms; sigma de amplitud 3.603367 ms.',
  },
  {
    id: 'vuelo',
    formula: String.raw`@{time}=\frac{@{distance}}{@{speed}},\qquad @{speed}=299\,792\,458\;\mathrm{m\,s^{-1}}`,
    terms: [
      term('distance', 'd', 'Distancia', 'm (modelo)', 'Distancia simbolica; la escena no tiene escala metrica.', 'Trayecto del paquete entre escenas.'),
      term('speed', 'c', 'Velocidad en vacio', 'm/s', 'Velocidad de la luz en vacio, definida exactamente en SI.', 'Propagacion, no velocidad del scroll.'),
      term('time', 't', 'Tiempo de viaje', 's (modelo)', 'Duracion fisica simbolica distinta del reloj cinematografico.', 'Separacion entre salida y llegada.'),
    ],
    relation: 'El paquete viaja; distancia dibujada y scroll no permiten medir su tiempo fisico.',
    units: 'Relacion en SI; ninguna distancia astronomica se infiere de esta escena.',
    source: { title: 'NIST: definicion SI de la velocidad de la luz', url: 'https://www.nist.gov/pml/special-publication-330/sp-330-section-2' },
    example: 'Un segundo-luz equivale exactamente a 299792458 m, no a una distancia de la escena.',
  },
  {
    id: 'plasma',
    formula: String.raw`\begin{aligned}@{dm}&=\int @{density}\,d@{path}\\@{delay}&=4148.808\,@{dm}\left(@{frequency}^{-2}-\nu_{\rm ref}^{-2}\right)\end{aligned}`,
    terms: [
      term('density', String.raw`n_e`, 'Densidad electronica', 'cm^-3', 'Numero de electrones libres por volumen.', 'Medio que separa las llegadas.'),
      term('path', String.raw`\ell`, 'Trayectoria', 'pc', 'Longitud integrada sobre la linea de vision.', 'Trayecto atravesado por el paquete.'),
      term('dm', String.raw`\mathrm{DM}`, 'Medida de dispersion', 'pc cm^-3', 'Columna integrada de electrones; no densidad local ni distancia unica.', 'Separacion global entre frecuencias.'),
      term('frequency', String.raw`\nu`, 'Frecuencia', 'MHz', 'Centro de canal; referencia en el centro mas alto.', 'Bandas que llegan en tiempos diferentes.'),
      term('delay', String.raw`\Delta t`, 'Retardo relativo', 's', 'Llegada relativa al canal de referencia por plasma frio.', 'Retraso de frecuencias bajas.'),
    ],
    relation: 'La columna electronica retrasa mas las frecuencias bajas que las altas.',
    units: 'K=4148.808 s MHz^2/(pc cm^-3). Frecuencias en MHz, resultado en segundos.',
    source: PULSARS,
    example: 'DM 500; centros 1203.125 y 1596.875 MHz: retardo 0.619595983 s.',
  },
  {
    id: 'antenas',
    formula: String.raw`@{delay}=\frac{@{baseline}\cdot @{direction}}{c},\qquad \phi_g=2\pi\nu\,@{delay}`,
    terms: [
      term('baseline', String.raw`\mathbf b`, 'Linea de base', 'm (modelo)', 'Vector entre dos antenas; geometria ilustrativa no medida.', 'Separacion entre receptores.'),
      term('direction', String.raw`\hat{\mathbf s}`, 'Direccion de propagacion', '1', 'Vector unitario que sigue el frente, alejandose de la fuente.', 'Flecha del frente incidente hacia la derecha.'),
      term('delay', String.raw`\tau_g`, 'Retardo geometrico', 's', 'Camino proyectado dividido por la velocidad de la luz.', 'Llegadas distintas al arreglo.'),
    ],
    relation: 'La proyeccion de la linea de base fija retardo y fase geometrica.',
    units: 'b=r_j-r_i; tau=t_j-t_i; s sigue propagacion. b en m, tau en s y nu en Hz.',
    source: INTERFEROMETRY,
    example: 'Ejemplo independiente: b=30 m, cos(theta)=0.5; tau=50.034614 ns. No escala del arreglo dibujado.',
  },
  {
    id: 'fase',
    formula: String.raw`\begin{aligned}@{product}_{ij}[n]&=@{voltage}_i[n]@{voltage}_j[n]^*\\@{visibility}_{ij}&=@{average}(@{product}_{ij})\\@{average}(q)&=\frac1N\sum_{n=0}^{N-1}q[n]\end{aligned}`,
    terms: [
      term('voltage', 'v', 'Voltaje complejo', 'u.a.', 'Amplitud compleja ilustrativa por antena, sin calibracion en voltios.', 'Dos trazas con fases relativas.'),
      term('product', 'q', 'Producto conjugado', 'u.a.^2', 'Producto de una muestra por el conjugado de la otra.', 'Multiplicacion entre trazas, no suma.'),
      term('average', String.raw`\mathcal A_N`, 'Promedio temporal', 'operador', 'Media sobre N productos complejos; no elimina su fase.', 'Acumulacion temporal del producto.'),
      term('visibility', String.raw`V`, 'Visibilidad compleja', 'u.a.^2', 'Media compleja de productos; no mapa de intensidad ni voltaje combinado.', 'Resultado del correlador paralelo.'),
    ],
    relation: 'Correlador paralelo: multiplica y promedia; sus visibilidades no alimentan la suma coherente.',
    units: 'v en u.a.; V en u.a.^2. Fase arg(V) en rad; amplitud sin calibracion Jy.',
    source: INTERFEROMETRY,
    example: 'v_i=1, v_j=i: V_ij=-i. Intercambiar antenas conjuga el resultado.',
  },
  {
    id: 'suma',
    formula: String.raw`v_{\Sigma}=\frac16\sum_{i=1}^{6}@{voltage}_i e^{-i@{phase}_i},\qquad @{power}=|v_{\Sigma}|^2`,
    terms: [
      term('voltage', 'v', 'Voltajes de antena', 'u.a.', 'Campos complejos que se alinean antes de combinar.', 'Seis ramas normalizadas v/6.'),
      term('phase', String.raw`\phi`, 'Fase compensada', 'rad', 'Fase relativa removida para la direccion elegida.', 'Alineacion de las oscilaciones.'),
      term('power', String.raw`P_{\Sigma}`, 'Potencia combinada', 'u.a.^2', 'Modulo cuadrado de la suma; incluye terminos cruzados.', 'Salida comun posterior a la suma.'),
    ],
    relation: 'Sumar campos alineados antes de elevar al cuadrado conserva interferencia coherente.',
    units: 'Promedio coherente normalizado: seis ramas v/6 producen v, no una ganancia fisica medida.',
    source: { title: 'NRAO: combinacion coherente y correlacion', url: 'https://www.cv.nrao.edu/~sransom/web/Ch3.html' },
    example: 'Seis entradas identicas de amplitud 1: salida normalizada 1 y potencia 1.',
  },
  {
    id: 'receptor',
    formula: String.raw`\begin{aligned}@{code}&=\left\lfloor\frac{\operatorname{clip}(@{voltage},-1,1)+1}{2}(2^{@{bits}}-1)+\frac12\right\rfloor\\\hat v&=\frac{2@{code}}{2^{@{bits}}-1}-1\end{aligned}`,
    terms: [
      term('voltage', 'v', 'Entrada normalizada', 'u.a.', 'Voltaje ilustrativo saturado al intervalo [-1,1].', 'Curva continua de entrada.'),
      term('code', 'q', 'Codigo ADC', 'entero', 'Indice discreto entre cero y 2^b menos uno.', 'Niveles cuantizados del receptor.'),
      term('bits', 'b', 'Resolucion ADC', 'bit', 'Numero de bits del ejemplo, no del waterfall float32.', 'Cantidad de niveles disponibles.'),
    ],
    relation: 'Muestrear fija instantes; cuantizar asigna niveles sin recuperar informacion perdida.',
    units: 'Cuantizador didactico con extremos incluidos: 64 muestras, b=4, 16 niveles. Sin Fs fisica.',
    source: { title: 'Analog Devices: cuantizacion ideal (convencion de niveles del ejemplo explicita)', url: 'https://www.analog.com/media/en/training-seminars/tutorials/MT-001.pdf' },
    example: 'Paso 2/15=0.133333 u.a.; error ideal hasta 1/15 dentro del rango, sin saturacion.',
  },
  {
    id: 'fft',
    formula: String.raw`\begin{aligned}@{amplitude}&=\sum_{n=0}^{N-1}@{window}[n]\hat v[n]e^{-2\pi i\,@{frequency}n}\\@{frequency}&=k/N\\@{window}[n]&=\tfrac12\left(1-\cos\frac{2\pi n}{N-1}\right)\end{aligned}`,
    terms: [
      term('window', 'w', 'Ventana Hann', '1', 'Peso temporal simetrico aplicado antes de la FFT.', 'Muestras atenuadas en los extremos.'),
      term('frequency', String.raw`f_k`, 'Frecuencia normalizada', 'ciclos/muestra', 'Bin k dividido por N; sin Fs no tiene valor en Hz.', 'Separacion de bins espectrales.'),
      term('amplitude', String.raw`X_k`, 'Amplitud FFT', 'u.a.', 'Suma compleja no normalizada de las muestras ponderadas.', 'Componentes complejas por bin.'),
    ],
    relation: 'La FFT transforma muestras ponderadas en amplitudes complejas por frecuencia normalizada.',
    units: 'N=64; f_k=k/64 ciclos/muestra. No equiparar bins con los centros MHz del evento LF.',
    source: { title: 'fft.js: implementacion y convencion FFT', url: 'https://github.com/indutny/fft.js' },
    example: 'El ejemplo contiene componentes en bins 5 y 13; Hann introduce fuga a bins vecinos.',
  },
  {
    id: 'potencia',
    formula: String.raw`@{power}_{j,k}=\frac{|@{amplitude}_{j,k}|^2}{N^2},\qquad @{average}_k=\frac1J\sum_{j=0}^{J-1}@{power}_{j,k}`,
    terms: [
      term('amplitude', 'X', 'Amplitud compleja', 'u.a.', 'Parte real e imaginaria de la FFT no normalizada.', 'Salida compleja de los canales.'),
      term('power', 'P', 'Potencia por bin', 'u.a.^2', 'Modulo cuadrado dividido por N al cuadrado.', 'Barras no negativas por bin.'),
      term('average', String.raw`\bar P`, 'Potencia acumulada', 'u.a.^2', 'Media de ventanas ilustrativas; mantiene las unidades de potencia.', 'Ventanas temporales y salida acumulada.'),
    ],
    relation: 'Cada bin aporta potencia; el promedio temporal conserva unidades.',
    units: 'N=64. Potencia normalizada, no densidad espectral por Hz ni flujo calibrado.',
    source: { title: 'NRAO: potencia y promedios del radiometro', url: 'https://www.cv.nrao.edu/~sransom/web/Ch3.html' },
    example: 'Esta adquisicion ilustrativa no genera el waterfall sintetico de la fase siguiente.',
  },
  {
    id: 'matriz',
    formula: String.raw`\mathbf I\in\mathbb R^{2048\times64},\qquad @{power}[@{sample},@{frequency}]=I[n,k],\qquad t_n=n\Delta t`,
    terms: [
      term('sample', 'n', 'Muestra temporal', 'indice', 'Indice efectivo de tiempo; dt es 1 ms.', 'Columnas temporales del waterfall.'),
      term('frequency', String.raw`\nu_k`, 'Centro de canal', 'MHz', 'Frecuencia real del canal, distinta del borde de banda.', 'Filas de frecuencia del waterfall.'),
      term('power', 'I', 'Intensidad sintetica', 'u.a.', 'Datos sinteticos float32; sin conversion instrumental a flujo.', 'Color de cada celda original.'),
    ],
    relation: 'Aqui comienza el dataset sintetico exacto; la adquisicion previa no lo produjo.',
    units: 'dt=0.001 s; centros 1203.125..1596.875 MHz; intensidad en u.a., no Jy.',
    source: { title: 'DRAFTS-UC: fisica y unidades del generador', url: `${BASELINE}src/domain/physics.py` },
    example: '2048x64, row-major [tiempo,frecuencia]; tiempo de la ultima muestra 2.047 s.',
  },
  {
    id: 'bloques',
    formula: String.raw`@{window}=[\max(0,a_j-@{context}),\min(N,b_j+@{context})),\quad @{valid}=[a_j,b_j),\quad @{context}=\Delta n_{\max}+w_{\max}`,
    terms: [
      term('window', String.raw`\mathcal W_j`, 'Bloque extendido', 'muestras', 'Intervalo de lectura con vecinos recortado a la observacion.', 'Ventana con contexto lateral.'),
      term('context', String.raw`\eta`, 'Contexto conservador', 'muestras', 'Maximo shift DM mas mayor anchura de filtro.', 'Vecinos externos al nucleo valido.'),
      term('valid', String.raw`\mathcal V_j`, 'Region valida', 'muestras', 'Intervalo semiabierto contado una vez, sin duplicacion entre nucleos.', 'Nucleo coloreado de cada bloque.'),
    ],
    relation: 'El contexto permite desplazar sin perder vecinos; los nucleos no duplican muestras.',
    units: 'Indices de muestras efectivas; contexto didactico conservador, no overlap historico 160.',
    source: { title: 'Contexto derivado del dedispersor original', url: `${BASELINE}src/preprocessing/dedispersion.py` },
    example: 'eta=1239+30=1269 muestras; cuatro nucleos de 512 cubren 2048 muestras.',
  },
  {
    id: 'alineacion',
    formula: String.raw`\begin{aligned}@{delay}_k&=4148.808\,@{dm}(\nu_k^{-2}-\nu_{\rm ref}^{-2})\\@{shift}_k&=\operatorname{round}_{\rm even}(@{delay}_k/\Delta t_{\rm samp})\\I_d[n,k]&=I[n+@{shift}_k,k]\end{aligned}`,
    terms: [
      term('dm', 'd', 'DM de prueba', 'pc cm^-3', 'Hipotesis guiada fijada antes de mostrar la seleccion de la red.', 'Concentracion temporal por frecuencia.'),
      term('delay', String.raw`\Delta t`, 'Retardo dispersivo', 's', 'Tiempo relativo al mayor centro de frecuencia.', 'Desplazamientos diferentes por canal.'),
      term('shift', String.raw`\delta n`, 'Desplazamiento entero', 'muestras', 'Retardo dividido por dt y redondeado ties-to-even.', 'Movimiento de cada tira, sin wrap.'),
    ],
    relation: 'Una hipotesis DM alinea canales; fuera de observacion no hay exposicion.',
    units: 'nu en MHz; Delta t_samp=0.001 s. Retardo e intervalo de muestreo son cantidades distintas.',
    source: DEDISPERSION,
    example: 'DM guiada 494.7368469: retardo maximo 0.613073926 s; shifts 0..613.',
  },
  {
    id: 'perfil',
    formula: String.raw`@{mean}[n]=\frac{\sum_{@{channel}=0}^{63}@{exposure}[n,@{channel}]I_d[n,@{channel}]}{\sum_{@{channel}=0}^{63}@{exposure}[n,@{channel}]}`,
    terms: [
      term('channel', 'k', 'Canal', 'indice', 'Canal de frecuencia del waterfall dedispersado.', 'Fila que contribuye al perfil.'),
      term('exposure', 'M', 'Exposicion valida', '0 o 1', 'Indica si la muestra desplazada existe en la observacion.', 'Bordes sin datos se excluyen.'),
      term('mean', String.raw`\bar I_d`, 'Media expuesta', 'u.a.', 'Media de canales validos; no suma normalizada de voltajes ni SNR.', 'Perfil de intensidad de 2048 valores.'),
    ],
    relation: 'Dividir por canales expuestos evita confundir bordes faltantes con intensidad cero.',
    units: 'Media de intensidad, mismas u.a. del waterfall; sin boxcars ni normalizacion SNR.',
    source: DEDISPERSION,
    example: 'Fila 47 exacta del mapa, DM 494.7368469; exposicion parcial hacia el final.',
  },
  {
    id: 'bowtie',
    formula: String.raw`D[@{trial},@{time}]=@{mean}_{d_j}[n],\qquad d_j=\operatorname{float32}(1000j/95),\qquad t_n=n\Delta t`,
    terms: [
      term('trial', 'j', 'Prueba DM', 'indice; DM en pc cm^-3', 'Fila asociada a una hipotesis, no a un score del detector.', 'Filas de la grilla DM.'),
      term('time', 'n', 'Muestra de tiempo', 'indice; t en s', 'Mismo indice temporal efectivo en todas las pruebas.', 'Columnas temporales del mapa.'),
      term('mean', String.raw`\bar I`, 'Media por prueba', 'u.a.', 'Primer plano cientifico del cubo, no heatmap CNN.', 'Valor real en cada celda DM-tiempo.'),
    ],
    relation: 'Cada hipotesis aporta un perfil; apilarlo no cambia sus unidades.',
    units: '96 DM float32 entre 0 y 1000; 2048 tiempos con dt=1 ms.',
    source: DEDISPERSION,
    example: 'D[47,:] es el perfil anterior. El mapa no se construye desde SNR del candidato.',
  },
  {
    id: 'rgb',
    formula: String.raw`A=\operatorname{clip}_{@{range}}\!\left(\mathcal Z(D)\right),\quad B=\frac{A-\min A}{\max A-\min A},\quad @{channel}_c=\frac{\operatorname{mako}(B)_c-\mu_c}{\sigma_c},\quad @{resize}=512\times512`,
    terms: [
      term('range', String.raw`[p_{0.1},p_{99.9}]`, 'Rango robusto', '1', 'Percentiles tras normalizar y redimensionar; limitan extremos.', 'Cambio de rango de colores.'),
      term('channel', 'R', 'Canal RGB preparado', '1', 'Color mako normalizado con media y desviacion ImageNet.', 'Tres canales cromaticos, no planos fisicos.'),
      term('resize', String.raw`(H,W)`, 'Resolucion de entrada', 'pixel', 'Resize a 512 por 512 antes de clipping y color.', 'Imagen cuadrada que entra al detector.'),
    ],
    relation: 'Preprocesar crea una imagen RGB; no convierte tres planos cientificos en colores.',
    units: 'Z incluye min-max, estandarizacion y resize lineal. RGB normalizado es adimensional.',
    source: { title: 'DRAFTS-UC: preprocess_img real', url: `${BASELINE}src/visualization/visualization_unified.py#L38` },
    example: 'Input NCHW [1,3,512,512]; rgb.u8 solo desnormaliza y cuantiza para mostrar.',
  },
  {
    id: 'backbone',
    formula: String.raw`@{product}_{c,a,b}=@{kernel}_{o,c,a,b}X_{c,u+a,v+b},\qquad @{sum}_{o,u,v}=b_o+\sum_{c,a,b}@{product}_{c,a,b}`,
    terms: [
      term('kernel', 'K', 'Peso aprendido', '1', 'Peso del checkpoint aplicado sin invertir el kernel espacial.', 'Ventana local de la convolucion.'),
      term('product', 'q', 'Producto local', '1 (activacion)', 'Peso multiplicado por una entrada del vecindario.', 'Contribucion dentro de la ventana.'),
      term('sum', 'Y', 'Salida convolucional', '1 (activacion)', 'Suma sobre canales y posiciones mas sesgo.', 'Nuevo mapa de caracteristicas.'),
    ],
    relation: 'Conv2d suma productos locales; PyTorch ejecuta correlacion cruzada, no invierte el kernel.',
    units: 'Activaciones de una imagen normalizada; no intensidad astronomica ni frecuencia fisica.',
    source: { title: 'PyTorch 2.11: Conv2d', url: 'https://docs.pytorch.org/docs/2.11/generated/torch.nn.Conv2d.html' },
    example: 'Conv inicial: [1,64,256,256]; solo canal 0 resumido a 24x24 en la escena.',
  },
  {
    id: 'upsampling',
    formula: String.raw`U=\operatorname{Bilinear}_{@{stride}}(X),\qquad @{output}=\operatorname{DoubleConv}_{@{kernel}}(U),\qquad (H_U,W_U)=@{stride}(H,W)`,
    terms: [
      term('stride', 's', 'Factor de aumento', '1', 'Factor dos; no stride de una convolucion transpuesta.', 'Crecimiento espacial de la cuadricula.'),
      term('kernel', 'K', 'Kernels 3x3', '1', 'Dos convoluciones aprendidas con BatchNorm y ReLU despues de bilinear.', 'Operadores que refinan la interpolacion.'),
      term('output', 'Y', 'Caracteristicas ampliadas', '1 (activacion)', 'Salida de Up, no nuevos datos del telescopio.', 'Tensor final 256 por 128 por 128.'),
    ],
    relation: 'Bilinear duplica resolucion; dos bloques Conv, BN y ReLU refinan cada salida.',
    units: 's=2, align_corners=True; resolucion en pixeles de caracteristicas, no muestras fisicas.',
    source: DETECTOR,
    example: '16x16 a 32x32 a 64x64 a 128x128; up3=[1,256,128,128].',
  },
  {
    id: 'cabezas',
    formula: String.raw`@{center}=\sigma(K_H\star X+b_H),\qquad @{size}=K_S\star X+b_S,\qquad @{offset}=K_O\star X+b_O`,
    terms: [
      term('center', 'H', 'Heatmap de centros', 'score [0,1]', 'Sigmoid del logit por celda; no mapa DM cientifico.', 'Heatmap real del detector.'),
      term('size', 'S', 'Tamano WH', 'celdas de caracteristicas', 'Anchura y altura predichas por la cabeza lineal.', 'Vector WH real del pico elegido.'),
      term('offset', 'O', 'Offset local', 'celdas de caracteristicas', 'Ajuste continuo del centro respecto a la celda del pico.', 'Vector offset real, no mapa inventado.'),
    ],
    relation: 'Tres cabezas comparten rasgos y predicen centro, tamano y ajuste local.',
    units: 'Heatmap sin unidades; WH y offset en celdas de la grilla 128x128.',
    source: DETECTOR,
    example: 'WH=[25.168102,85.680801]; offset=[0.451349,0.406291] en pico [fila63,columna34].',
  },
  {
    id: 'centernet',
    formula: String.raw`\mathbf c_{\rm CNN}=@{scale}\bigl(@{peak}+@{offset}\bigr),\qquad \mathbf b_{\pm}=\mathbf c_{\rm CNN}\pm\frac{@{scale}\mathbf S}{2}`,
    terms: [
      term('peak', String.raw`\mathbf p`, 'Pico de heatmap', 'celda [x,y]', 'Centro discreto retenido por maximo local y umbral estricto.', 'Punto antes de aplicar el offset.'),
      term('offset', String.raw`\mathbf O`, 'Ajuste subcelda', 'celda [x,y]', 'Offset real predicho en el pico, con orden x,y.', 'Movimiento hasta el centro continuo.'),
      term('scale', 'r', 'Escala imagen/grilla', 'pixel/celda', 'Cociente 512/128 entre imagen y mapa de salida.', 'Expansion de centro y caja al RGB.'),
    ],
    relation: 'Offset ajusta el pico; escala recupera coordenadas y NMS filtra cajas solapadas.',
    units: 'r=4 pixel/celda. Peak del fixture [fila63,columna34] se usa como [x34,y63].',
    source: DECODE,
    example: 'Centro CNN=[137.805393,253.625160] px; score>0.3 e IoU NMS=0.3.',
  },
  {
    id: 'recorte',
    formula: String.raw`\begin{aligned}@{time}&=x_{\rm CNN}\frac{N}{W}\Delta t\\@{dm}&=d_{\operatorname{round}_{\rm even}(\frac{y_{\rm CNN}}{H-1}(J-1))}\\@{extent}[n,k]&=I[a+n+\delta n_k(@{dm}),k]\end{aligned}`,
    terms: [
      term('time', 't', 'Tiempo estimado', 's', 'Centro continuo convertido al eje temporal; indice entero truncado.', 'Posicion temporal de la caja.'),
      term('dm', 'd', 'DM estimada', 'pc cm^-3', 'Fila mas cercana de la grilla real, usando denominador H-1.', 'Hipotesis seleccionada para el recorte.'),
      term('extent', 'C', 'Recorte original', 'u.a.; forma 512x64', 'Datos dedispersados originales; preparados despues para la clasificacion.', 'Ventana rectangular, no entrada RGB.'),
    ],
    relation: 'La caja localiza coordenadas; el clasificador recibe un recorte dedispersado del dato original.',
    units: 'N=2048, W=H=512, J=96, dt=1 ms. Recorte sin padding para este evento.',
    source: { title: 'DRAFTS-UC: caja a DM y tiempo', url: `${BASELINE}src/preprocessing/dm_candidate_extractor.py` },
    example: 't=0.551221573 s; muestra 551; DM fila47=494.7368469; recorte inicia en 295.',
  },
  {
    id: 'resnet',
    formula: String.raw`@{residual}=F_{@{convolution}}(x),\qquad @{activation}=\operatorname{ReLU}\bigl(P(x)+@{residual}\bigr)`,
    terms: [
      term('convolution', 'K', 'Pesos convolucionales', '1', 'Pesos aprendidos dentro del camino residual.', 'Operaciones locales del BasicBlock.'),
      term('residual', 'F(x)', 'Camino residual', '1 (activacion)', 'Transformacion con Conv y BatchNorm compatible con el shortcut.', 'Rama transformada, distinta del shortcut.'),
      term('activation', 'y', 'Activacion de salida', '1 (activacion)', 'ReLU de la suma; P proyecta si cambia la forma.', 'Reunion de ambos caminos del bloque.'),
    ],
    relation: 'Sumar caminos requiere formas compatibles; la proyeccion resuelve cambios de canales o resolucion.',
    units: 'Activaciones adimensionales. Input clasificador [1,1,512,64]; layer4 [1,512,16,2].',
    source: { title: 'He et al.: Deep Residual Learning', url: 'https://arxiv.org/abs/1512.03385' },
    example: 'Residual ilustrado: 64x128x16; no bypass global hasta 512x16x2.',
  },
  {
    id: 'decision',
    formula: String.raw`\begin{aligned}@{feature}_c&=\frac1{HW}\sum_{u,v}A_{c,u,v}\\@{logit}_j&=b_j+\sum_cW_{jc}@{feature}_c\\@{probability}_j&=\frac{e^{@{logit}_j-m}}{\sum_{q=0}^{1}e^{@{logit}_q-m}}\end{aligned}`,
    terms: [
      term('feature', 'g', 'Vector GAP', '1 (activacion)', 'Media espacial por canal; 512 valores reales completos.', 'Vector de 512 rasgos agregados.'),
      term('logit', 'z', 'Logit de clase', '1', 'Salida affine de Linear antes de softmax.', 'Dos salidas firmadas del clasificador.'),
      term('probability', 'p', 'Salida softmax', '1', 'Proporcion normalizada del modelo, no probabilidad astrofisica calibrada.', 'Dos salidas que suman uno.'),
    ],
    relation: 'GAP agrega rasgos; Linear produce dos logits y softmax normaliza sus salidas.',
    units: 'm=max(z) estabiliza softmax. Salidas sin unidades; ninguna certeza astronomica se deriva.',
    source: { title: 'PyTorch 2.11: softmax de dos logits', url: 'https://docs.pytorch.org/docs/2.11/generated/torch.nn.Softmax.html' },
    example: 'Logits [-29.1538563,28.7564430]; clase1=1.0 float32; no sigmoid binario unico.',
  },
  {
    id: 'candidato',
    formula: String.raw`@{score}>0.3,\quad @{snr}=\max_{n,w}\frac1{\sqrt w}\sum_{q\in B_w}z[n+q],\quad (@{score},@{snr})\not\Rightarrow @{confirmation}`,
    terms: [
      term('score', 's_H', 'Score detector', '1', 'Valor de heatmap de la caja retenida, distinto de softmax ResNet.', 'Caja y puntuacion de CenterNet.'),
      term('snr', String.raw`\mathrm{SNR}`, 'SNR del recorte', '1', 'Maximo de boxcars del perfil ponderado, detrendido y normalizado.', 'Pico del perfil SNR de 512 muestras.'),
      term('confirmation', String.raw`\mathrm{confirmacion}`, 'Confirmacion astrofisica', 'no calculada', 'Validacion externa; no se obtiene del score ni del SNR.', 'Ficha como candidato, no descubrimiento.'),
    ],
    relation: 'Score y SNR caracterizan una traza; no confirman un origen astrofisico.',
    units: 'z usa ponderacion MAD, bloques y correccion 1.148; w en muestras. Score y SNR adimensionales.',
    source: { title: 'DRAFTS-UC: SNR original con filtros boxcar', url: `${BASELINE}src/analysis/snr_utils.py` },
    example: 'Score 0.804512084; SNR 67.8216858 con ancho14 ms; pico SNR 554 ms, no centro551.222 ms.',
  },
];

export const MATH_CATALOG = [...MATH_STAGES, ...COSMIC_MATH, ...METHOD_MATH];
const stagesById = new Map(MATH_CATALOG.map(stage => [stage.id, stage]));

export function mathFor(id: string): StageMath {
  const stage = stagesById.get(id);
  if (!stage) throw new RangeError(`Unknown mathematical stage: ${id}`);
  return stage;
}

const pregalacticMath: StageMath = {
  ...mathFor('plasma'),
  formula: String.raw`\begin{aligned}@{dm}&=\mathrm{DM}_{\rm host,obs}+\int\frac{@{density}}{1+z(\ell)}\,d@{path}_{\rm proper}\\@{delay}&=4148.808\,@{dm}\left(@{frequency}^{-2}-\nu_{\rm ref}^{-2}\right)\end{aligned}`,
  relation: 'La DM previa suma anfitriona y medio intergaláctico. La Vía Láctea añadirá electrones después.',
  units: 'Host 100 + IGM 280 = 380 pc cm^-3 antes de la Vía Láctea. K=4148.808 s MHz^2/(pc cm^-3).',
  source: { title: 'Ioka (2003): dispersión cosmológica', url: 'https://arxiv.org/abs/astro-ph/0309200' },
  example: 'DM previa 380: retardo entre centros extremos 0.470892947 s. Halo y disco añadirán 120 pc cm^-3.',
};

export function globalMathFor(id: string): StageMath {
  return id === 'plasma' ? pregalacticMath : mathFor(id);
}

export const LIGHT_SPEED_M_S = 299_792_458;
export const DISPERSION_K_S_MHZ2 = 4148.808;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

export function dispersionSeconds(dm: number, lowMHz: number, highMHz: number): number {
  if (finite(dm, 'DM') < 0 || finite(lowMHz, 'Frequency') <= 0 || finite(highMHz, 'Reference frequency') <= 0) {
    throw new RangeError('DM must be nonnegative and frequencies must be positive');
  }
  return finite(DISPERSION_K_S_MHZ2 * dm * (lowMHz ** -2 - highMHz ** -2), 'Dispersion delay');
}

export function geometricDelaySeconds(baselineM: number, directionCosine: number): number {
  if (finite(baselineM, 'Baseline') < 0 || Math.abs(finite(directionCosine, 'Direction cosine')) > 1) {
    throw new RangeError('Baseline must be nonnegative and direction cosine must be within [-1,1]');
  }
  return baselineM * directionCosine / LIGHT_SPEED_M_S;
}

export function visibilityComplex(a: [number, number][], b: [number, number][]): [number, number] {
  if (!a.length || a.length !== b.length) throw new RangeError('Visibility needs equally sized nonempty voltage series');
  let real = 0, imag = 0;
  for (let n = 0; n < a.length; n++) {
    const [ar, ai] = a[n], [br, bi] = b[n];
    [ar, ai, br, bi].forEach(value => finite(value, 'Complex voltage'));
    real += ar * br + ai * bi;
    imag += ai * br - ar * bi;
  }
  return [finite(real / a.length, 'Visibility real part'), finite(imag / a.length, 'Visibility imaginary part')];
}
