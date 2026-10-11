import { OBSERVATIONS, channelCentre, dispersionSeconds, effectiveDt, type ObservationCaseId } from '../observations';
import { globalMathFor, mathFor, type MathTerm, type StageMath } from './model';

const relevant = new Set(['faro', 'pulso', 'vuelo', 'plasma', 'galaxia', 'polarizacion', 'tierra', 'antenas']);
const term = (id: string, symbol: string, label: string, unit: string, meaning: string, visual: string): MathTerm =>
  ({ id, symbol, label, unit, meaning, visual });

export function observationMathFor(id: string, caseId: ObservationCaseId): StageMath | null {
  if (!relevant.has(id)) return null;
  const observation = OBSERVATIONS[caseId], hf = observation.id === 'alma-hf', base = mathFor(id);
  const low = channelCentre(observation, 0), high = channelCentre(observation, observation.channels - 1);
  const delay = dispersionSeconds(observation.dm, low, high), dt = effectiveDt(observation);
  const provenance = observation.provenance;
  if (id === 'faro') return { ...base,
    relation: hf ? 'Este faro representa un magnetar galactico; no convierte su pulso en un FRB extragalactico.' : base.relation,
    example: provenance, source: observation.source,
  };
  if (id === 'pulso') {
    const sigma = observation.widthMs / Math.sqrt(8 * Math.log(2));
    return { ...base, units: `FWHM sintetica de intensidad ${observation.widthMs} ms. Portadora dibujada ralentizada; no resuelve el periodo RF real.`,
      example: `Sigma de intensidad ${sigma.toFixed(6)} ms; sigma de campo ${(sigma * Math.SQRT2).toFixed(6)} ms. ${provenance}` };
  }
  if (id === 'vuelo') return { ...base, source: hf ? observation.source : base.source,
    units: hf ? 'c=299792458 m/s. Distancia de referencia del magnetar: 8.3 kpc; geometria y reloj de animacion no metricos.' : base.units,
    example: provenance,
  };
  if (id === 'plasma') {
    if (!hf) return { ...globalMathFor(id), example: `${globalMathFor(id).example} ${provenance}` };
    return { ...base,
      formula: String.raw`\begin{aligned}@{dm}&=\int @{density}\,d@{path}\\@{delay}&=4.148808\!\times\!10^{-3}\,@{dm}\left(@{frequency}^{-2}-\nu_{\rm ref}^{-2}\right)\end{aligned}`,
      terms: base.terms.map(value => value.id === 'frequency' ? { ...value, unit: 'GHz', meaning: 'Centro de canal en GHz; la constante de dispersion tambien se convierte a GHz.' } : value),
      relation: 'El plasma interestelar agrega DM; a 86 GHz, el retardo queda dentro de una muestra efectiva.',
      units: `DM=${observation.dm} pc cm^-3. Centros ${(low / 1000).toFixed(5)}-${(high / 1000).toFixed(5)} GHz. K=0.004148808 s GHz^2/(pc cm^-3).`,
      example: `Retardo ${(delay * 1e6).toFixed(3)} microsegundos; ${(delay / dt).toFixed(6)} muestras de ${(dt * 1000).toFixed(3)} ms. DM conocida adoptada, no estimada desde esta banda.`,
      source: observation.source,
    };
  }
  if (id === 'galaxia') {
    if (!hf) return { ...base, example: `${base.example} ${provenance}` };
    return { ...base,
      formula: String.raw`@{halo}\longrightarrow@{igm},\qquad @{total}=\int_0^{@{disk}}n_e\,d\ell`,
      terms: [
        term('halo', String.raw`\mathrm{PSR\ J1745{-}2900}`, 'Fuente galactica', 'ubicacion ilustrativa', 'Magnetar en la Via Lactea; no galaxia anfitriona extragalactica.', 'Fuente marcada cerca del centro galactico.'),
        term('disk', String.raw`\ell_{\rm ISM}`, 'Trayecto interestelar', 'pc', 'Columna entre fuente y observador; no se asigna presupuesto anfitriona o IGM.', 'Segmento dentro del disco de la Via Lactea.'),
        term('igm', String.raw`\mathrm{Sol}`, 'Vecindad del observador', 'ubicacion ilustrativa', 'Referencia solar dentro de la misma galaxia.', 'Sol al final del segmento galactico.'),
        term('total', String.raw`\mathrm{DM}_{\rm conocida}`, 'DM conocida adoptada', 'pc cm^-3', '1770 es el valor de referencia adoptado; esta banda no lo mide por barrido.', 'Columna total rotulada y seis canales casi alineados.'),
      ],
      relation: 'Fuente y observador comparten la Via Lactea; la columna es interestelar, sin presupuesto cosmologico.',
      units: 'DM conocida=1770 pc cm^-3; distancia de referencia 8.3 kpc. No host/(1+z), no IGM, no redshift cosmologico.',
      source: observation.source, example: provenance,
    };
  }
  if (id === 'polarizacion') return { ...base,
    units: `${base.units} Frecuencias del caso ${hf ? '85.29925-87.23675 GHz' : '1203.125-1596.875 MHz'}.`,
    example: `RM=24 rad m^-2 es una pantalla didactica, no la RM medida del magnetar ni polarimetria del fixture. ${provenance}`,
  };
  if (id === 'tierra') return { ...base,
    formula: hf ? String.raw`\begin{aligned}@{delay}&=4.148808\!\times\!10^{-3}\,\mathrm{DM}\,(@{frequency}^{-2}-\nu_{\rm ref}^{-2})\\@{field}&=(E_y,E_z)\perp\hat{\mathbf s}\\@{receiver}&\propto\hat{\mathbf e}_{\rm feed}\cdot\mathbf E\end{aligned}` : base.formula,
    terms: base.terms.map(value => value.id === 'frequency' ? { ...value, unit: hf ? 'GHz' : 'MHz' }
      : value.id === 'receiver' ? { ...value, visual: hf ? 'Feed de una antena del arreglo ALMA ilustrativo.' : 'Receptor suspendido sobre el reflector fijo de Arecibo.' } : value),
    relation: hf ? 'Descendemos a Chajnantor; los canales milimetricos llegan casi juntos al feed de ALMA.' : 'Descendemos a Puerto Rico; el reflector fijo de Arecibo entrega el campo a su receptor suspendido.',
    units: `DM=${observation.dm} pc cm^-3. Retardo ${(delay * 1e6).toFixed(3)} microsegundos, ${(delay / dt).toFixed(6)} muestras efectivas. ${hf ? 'ALMA Band 3, mm.' : 'Arecibo historico, banda L.'}`,
    source: observation.source, example: provenance,
  };
  if (!hf) return { ...base,
    formula: String.raw`\begin{aligned}@{delay}(t)&\propto\int_{A(@{baseline})}a(\mathbf r)\,\mathbf E(\mathbf r,t-\tau_{\rm opt})\cdot@{direction}\,dA\\\tau_{\rm opt}(\mathbf r)&=L_{\rm corr}(\mathbf r)/c\end{aligned}`,
    terms: [
      term('baseline', 'D', 'Diametro de apertura', 'm', '305 m de un solo reflector fijo esferico; no vector entre dos antenas.', 'Borde completo del plato y cota de apertura.'),
      term('direction', String.raw`\hat{\mathbf e}_{\rm feed}`, 'Polarizacion sensible', '1', 'El feed recibe la componente de campo alineada con su polarizacion.', 'Frentes que iluminan el reflector.'),
      term('delay', String.raw`v_{\rm feed}`, 'Campo enfocado al receptor', 'u.a.', 'Integracion sobre la apertura con caminos opticos corregidos; no correlador ni suma de antenas.', 'Rayos ilustrativos hacia la plataforma suspendida.'),
    ],
    relation: 'Una apertura esferica fija recoge el campo; la optica correctora lo entrega a un receptor suspendido.',
    units: 'D=305 m. Caminos opticos esquematicos, no escala metrica. ALFA tiene siete haces receptores, no siete antenas independientes.',
    source: { title: 'NASA PDS: reflector de 305 m del Observatorio de Arecibo', url: 'https://pds.nasa.gov/ds-view/pds/viewContext.jsp?identifier=urn:nasa:pds:context:telescope:arecibo.305m' },
    example: provenance,
  };
  return { ...base, units: `${base.units} Seis antenas didacticas de ALMA a 86 GHz; no configuracion completa observada.`,
    example: `La observacion publicada utilizo 37 antenas de 12 m; esta escena muestra seis. ${provenance}`, source: observation.source };
}
