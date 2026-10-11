import type { MathTerm, StageMath } from './model';

const RADIATION = { title: 'NRAO: polarizacion y Stokes', url: 'https://www.cv.nrao.edu/~sransom/web/Ch2.html#Ch2.S3' };
const PLASMA = { title: 'NRAO: propagacion en plasma y Faraday', url: 'https://www.cv.nrao.edu/~sransom/web/A4.html' };
const INVENTORY = { title: 'Niu et al. 2022: inventario de DM', url: 'https://www.nature.com/articles/s41586-022-04755-5' };
const term = (id: string, symbol: string, label: string, unit: string, meaning: string, visual: string): MathTerm =>
  ({ id, symbol, label, unit, meaning, visual });

export const COSMIC_MATH: StageMath[] = [
  {
    id: 'anfitriona',
    formula: String.raw`\begin{aligned}@{frequency}&=\frac{\nu_{\rm emit}}{1+@{redshift}}\\@{duration}&=(1+@{redshift})\,\Delta t_{\rm emit}\\@{host}&=\frac{\mathrm{DM}_{\rm host,rest}}{1+@{redshift}}\end{aligned}`,
    terms: [
      term('host', String.raw`\mathrm{DM}_{\rm host,obs}`, 'Galaxia anfitriona', 'pc cm^-3', 'Electronica local y galactica, convertida al marco del observador.', 'Gas junto a la fuente y columna de salida.'),
      term('redshift', 'z', 'Corrimiento cosmologico', '1', 'Expansion cosmica; el valor ilustrativo no se estima desde DM.', 'Cambio de escala entre emision y observacion.'),
      term('frequency', String.raw`\nu_{\rm obs}`, 'Frecuencia observada', 'MHz', 'La expansion reduce la frecuencia recibida respecto de la emitida.', 'Longitud de onda del paquete que sale.'),
      term('duration', String.raw`\Delta t_{\rm obs}`, 'Duracion observada', 'ms', 'Dilatacion cosmologica antes de sumar dispersion instrumental o scattering.', 'Anchura de la envolvente al salir.'),
    ],
    relation: 'Este ejemplo nace fuera de nuestra galaxia; la expansion cambia frecuencia, duracion y DM local observada.',
    units: 'z=0.3 ilustrativo. DM host local 130 se observa como 100 pc cm^-3; no es una medicion.',
    source: INVENTORY,
    example: 'No todos los FRB son extragalacticos: FRB 20200428 procede del magnetar galactico SGR 1935+2154.',
  },
  {
    id: 'galaxia',
    formula: String.raw`@{total}=@{disk}+@{halo}+@{igm}+\frac{\mathrm{DM}_{\rm host,rest}}{1+z}`,
    terms: [
      term('halo', String.raw`\mathrm{DM}_{\rm MW,halo}`, 'Halo de la Via Lactea', 'pc cm^-3', 'Columna electronica del halo galactico atravesada por la linea de vision.', 'Electronica tenue alrededor del disco.'),
      term('disk', String.raw`\mathrm{DM}_{\rm MW,disk}`, 'Disco de la Via Lactea', 'pc cm^-3', 'Columna electronica del medio interestelar galactico; depende de la direccion.', 'Brazos y segmento interior hasta el Sol.'),
      term('igm', String.raw`\mathrm{DM}_{\rm IGM}`, 'Medio intergalactico', 'pc cm^-3', 'Contribucion acumulada entre galaxias, en el marco del observador.', 'Trayecto de entrada desde fuera de la galaxia.'),
      term('total', String.raw`\mathrm{DM}_{\rm obs}`, 'Columna total observada', 'pc cm^-3', 'Suma de contribuciones; no determina por si sola distancia ni origen.', 'Barras acumuladas y llegada al Sistema Solar.'),
    ],
    relation: 'Halo y disco agregan electrones a la columna que ya traia el pulso extragalactico.',
    units: 'Reparto didactico: host 100 + IGM 280 + halo 50 + disco 70 = 500 pc cm^-3.',
    source: INVENTORY,
    example: 'Reparto y geometria ilustrativos. El fixture conserva DM total 500; no identifica su galaxia ni redshift.',
  },
  {
    id: 'polarizacion',
    formula: String.raw`\begin{aligned}@{angle}&=\chi_0+@{rotation}\,@{wavelength}^{2}\\@{rotation}&=0.81\int n_e B_{\parallel}\,d\ell\\@{stokes}&=(|E_y|^2+|E_z|^2,\ |E_y|^2-|E_z|^2,\ 2\Re[E_yE_z^*],\ 2\Im[E_yE_z^*])\\@{field}&\perp\hat{\mathbf x}\end{aligned}`,
    terms: [
      term('field', String.raw`\mathbf E`, 'Campo transversal', 'u.a.', 'El campo electrico oscila perpendicular a la propagacion hacia la derecha.', 'Componentes ortogonales y punta que traza la elipse.'),
      term('stokes', String.raw`(I,Q,U,V)`, 'Parametros Stokes', 'u.a.^2', 'Intensidad y polarizacion; signo V definido por E_y E_z conjugado.', 'Cuatro barras calculadas desde el mismo vector de Jones.'),
      term('rotation', String.raw`\mathrm{RM}`, 'Medida de rotacion', 'rad m^-2', 'Plasma magnetizado gira polarizacion; no es el retardo asociado a DM.', 'Campo longitudinal y orientaciones tras el medio.'),
      term('wavelength', String.raw`\lambda`, 'Longitud de onda', 'm', 'Longitudes mayores giran mas para la misma pantalla de Faraday.', 'Tres orientaciones de salida por frecuencia.'),
      term('angle', String.raw`\chi`, 'Angulo de polarizacion', 'rad', 'Orientacion del eje mayor, definida modulo pi.', 'Elipse y arco del angulo de salida.'),
    ],
    relation: 'DM retrasa la llegada; RM gira la polarizacion. Stokes describe ambas componentes transversales.',
    units: 'RM: n_e en cm^-3, B paralelo en microG y l en pc. Stokes normalizados; no polarimetria del fixture.',
    source: PLASMA,
    example: 'Pantalla externa ilustrativa: RM=24 rad m^-2. Rotacion 0.958672 rad a 1500 MHz, sin alterar I ni V.',
  },
  {
    id: 'tierra',
    formula: String.raw`\begin{aligned}@{delay}&=4148.808\,\mathrm{DM}\,(@{frequency}^{-2}-\nu_{\rm ref}^{-2})\\@{field}&=(E_y,E_z)\perp\hat{\mathbf x}\\@{receiver}&\propto\hat{\mathbf e}_{\rm feed}\cdot\mathbf E\end{aligned}`,
    terms: [
      term('frequency', String.raw`\nu`, 'Bandas de radio', 'MHz', 'Frecuencias recibidas despues del viaje cosmico.', 'Paquetes coloreados con bandas rotuladas.'),
      term('delay', String.raw`\Delta t`, 'Orden de llegada', 's', 'Los canales bajos llegan despues del canal alto de referencia.', 'Frentes separados que alcanzan el mismo receptor.'),
      term('field', String.raw`\mathbf E`, 'Polarizacion recibida', 'u.a.', 'Orientacion ilustrativa del campo al entrar al sistema receptor.', 'Oscilaciones y vector transversal sobre cada frente.'),
      term('receiver', String.raw`v_{\rm feed}`, 'Voltaje del receptor', 'u.a.', 'La antena proyecta el campo sobre su polarizacion sensible.', 'Dos ejes del feed y plato en superficie.'),
    ],
    relation: 'Descendemos con la señal hasta Chajnantor; dispersión y polarización preceden a los voltajes del receptor.',
    units: 'K=4148.808 s MHz^2/(pc cm^-3). LF 1203.125-1596.875 MHz ilustrativa; ALMA real observa mm/submm.',
    source: RADIATION,
    example: 'DM=500: diferencia entre centros extremos 0.619595983 s. Color identifica banda, no luz visible.',
  },
];

export interface JonesVector { y: readonly [number, number]; z: readonly [number, number] }
export interface NormalizedStokes { I: number; Q: number; U: number; V: number }

export function stokesFromJones(vector: JonesVector): NormalizedStokes {
  const [yr, yi] = vector.y, [zr, zi] = vector.z;
  if (![yr, yi, zr, zi].every(Number.isFinite)) throw new RangeError('Jones requiere componentes finitas.');
  const yy = yr * yr + yi * yi, zz = zr * zr + zi * zi;
  return { I: yy + zz, Q: yy - zz, U: 2 * (yr * zr + yi * zi), V: 2 * (yi * zr - yr * zi) };
}

export function faradayAngle(chi0: number, rm: number, wavelengthM: number): number {
  if (![chi0, rm, wavelengthM].every(Number.isFinite) || wavelengthM < 0) throw new RangeError('Faraday requiere valores finitos y lambda no negativa.');
  return chi0 + rm * wavelengthM * wavelengthM;
}

export function rotateJones(vector: JonesVector, angle: number): JonesVector {
  stokesFromJones(vector);
  if (!Number.isFinite(angle)) throw new RangeError('Angulo no finito.');
  const c = Math.cos(angle), s = Math.sin(angle);
  return { y: [c * vector.y[0] - s * vector.z[0], c * vector.y[1] - s * vector.z[1]],
    z: [s * vector.y[0] + c * vector.z[0], s * vector.y[1] + c * vector.z[1]] };
}

export function observedDispersion(disk: number, halo: number, igm: number, hostRest: number, redshift: number): number {
  if (![disk, halo, igm, hostRest, redshift].every(value => Number.isFinite(value) && value >= 0)) throw new RangeError('DM y redshift deben ser finitos y no negativos.');
  return disk + halo + igm + hostRest / (1 + redshift);
}

export function observedRotation(restRotation: number, redshift: number): number {
  if (!Number.isFinite(restRotation) || !Number.isFinite(redshift) || redshift < 0) throw new RangeError('RM finito y redshift no negativo requeridos.');
  return restRotation / (1 + redshift) ** 2;
}
