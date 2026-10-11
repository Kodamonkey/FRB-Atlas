# Cosmic Journey: Provenance and Boundaries

Atlas has two observing cases. The LF route is an extragalactic illustration received at historic Arecibo; the HF route begins inside the Milky Way and reaches ALMA. Neither localizes an observed FRB. Hosts, Galactic arms, Sun markers, redshift and polarization are not measured properties of their synthetic fixtures. The HF magnetar-inspired pulse is not an observed FRB or a replay of PSR J1745-2900 data. Configuration, historical observations and backend contracts are in [OBSERVING_CASES.md](OBSERVING_CASES.md). Camera distances and durations are not astronomical scales.

## LF Dispersion Inventory

The observer-frame inventory is `DM_MW,disk + DM_MW,halo + DM_IGM + DM_host,rest/(1+z)`. Host includes the source environment and host halo; IGM is already in the observer frame. An intervening halo can be included in the cosmic term; this scene does not separately infer one. The source-frame correction must not be applied twice.

The scene uses `z=0.3`, host-rest `130`, IGM `280`, Milky Way halo `50` and Milky Way disk `70`, all DM values in `pc cm^-3`. Their observed sum is `500`, matching the existing fixture's total DM. This decomposition is didactic and non-unique. DM alone does not determine redshift.

The LF column is cumulative: host contributes `100`; intergalactic propagation adds `280` to reach `380`; halo and disk add `120` to reach `500`. Sampled channels remain separated during Galactic entry. In the cosmological integral, electron density and distance are proper quantities, weighted by `1/(1+z)`. The illustrative IGM budget is already observer-frame. The legacy uniform-column operator keeps its default `0..500` contract; the LF route supplies an explicit `100..380` adapter. These numbers do not apply to the galactic HF case.

[Ioka (2003), section 2 and equation 2](https://arxiv.org/pdf/astro-ph/0309200) derives observer-frame plasma delay from the redshifted local frequency and dilated local delay. The equivalent proper-path expression is `integral n_e/(1+z) dl_proper`. This propagation result does not imply a GRB origin for the illustrative FRB.

Primary evidence: [Niu et al. 2022, equations 3 and 7](https://www.nature.com/articles/s41586-022-04755-5) separates disk, halo, IGM and observer-frame host terms, and explicitly converts source-frame host DM using `1/(1+z)`. [Macquart et al. 2020](https://www.nature.com/articles/s41586-020-2300-2) uses localized extragalactic bursts to study cosmic electron columns.

Most known FRBs are extragalactic, but this is not universal. [Bochenek et al. 2020](https://www.nature.com/articles/s41586-020-2872-x) detected Galactic FRB 20200428 from SGR 1935+2154. The source model remains illustrative; it does not establish a universal progenitor.

## Galactic HF Propagation

The HF origin is inside the Milky Way. No extragalactic host, intergalactic DM inventory or cosmological redshift correction is inserted. Known/injected DM `1770 pc cm^-3` is independent of a candidate DM estimate, which remains unresolved here. Frequencies use the configured `85.29925..87.23675 GHz` channel centres. The physical delay is `44.333157 microseconds`; at native `32 microseconds` it spans `1.385411` samples, but after temporal sum by 128 it spans only `0.010823525` effective samples. Arrival separation is deliberately exaggerated for inspection; labels retain these physical units.

HF selection uses delay at **DM_max 3000**, not the known pulse DM: `R_search=0.018344957066 < 2`. The rule is a backend resolution policy, not a statement from an ALMA observing paper. Its equal-to-two boundary, dependence on downsampling, and distinct cube-skip rule are documented in OBSERVING_CASES.

## Polarization and Faraday Rotation

The event travels along `+x`; the electric-field components lie in the transverse `y,z` plane. The normalized complex Jones vector is `(1, -0.32i)`. The scene derives `I,Q,U,V` from that same vector. Its convention is `V=2 Im(E_y conj(E_z))`; no volt-to-Jy or impedance calibration is applied. The exact normalized intensity is `I=1.1024`, not a flux density measurement.

A uniform external Faraday screen rotates the Jones vector by `chi=chi0+RM lambda^2`, with `chi0=0.16 rad`, illustrative `RM=24 rad m^-2` and wavelength calculated from the exact vacuum speed of light. Rotation preserves `I,V` and rotates `Q,U` by twice its angle. The ellipse is not a fit to the fixture's polarization. DM controls frequency-dependent arrival delay; RM controls orientation and contains the line-of-sight magnetic field. Those quantities are not interchangeable.

Primary sources: [NRAO, Chapter 2, polarization and Stokes](https://www.cv.nrao.edu/~sransom/web/Ch2.html#Ch2.S3), [NRAO, Appendix D, equations D.26-D.27](https://www.cv.nrao.edu/~sransom/web/A4.html). In the latter convention, positive RM corresponds to a magnetic field pointing from source toward observer. With `n_e` in `cm^-3`, `B_parallel` in `microG` and path in `pc`, coefficient is approximately `0.81 rad m^-2`.

`observedRotation` is an independently tested source-frame conversion: a local screen at redshift `z` contributes `RM_rest/(1+z)^2`. It is not used to infer the scene's RM. [Michilli et al. 2018](https://arxiv.org/abs/1801.03965), [author-hosted paper](https://www.icrar.org/wp-content/uploads/2018/01/nature25149_Hessels.pdf), explicitly applies this conversion. A distributed or internally emitting Faraday medium need not have one simple rotation measure.

## Earth Surface Asset

Local file: `public/media/earth-blue-marble.png`, unmodified NASA 1024x512 equirectangular mosaic. It depicts optical geography, not radio brightness or the source's line of sight.

- [NASA SVS item 2915](https://svs.gsfc.nasa.gov/2915/).
- [Original PNG](https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-1024.png).
- Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio. Blue Marble data courtesy of Reto Stockli (NASA/GSFC) and NASA's Earth Observatory.
- SHA-256: `d1d3cb36ae6ae452c43cdf7ae0ffc13a959e8a5a2358f58b05e5f623c15119f9`.

Three.js maps the authentic raster onto a sphere. Atmosphere and receivers are illustrative geometry. Radio frequencies use color plus numerical labels; they are not visible colored light. Sampled packets preserve each case's frequency ordering and highest-centre reference. Their spacing is cinematic, especially when the HF delay is below an effective sample.

Earth's progress spans first to last reception. Higher frequencies touch the feed first; received packets fade while arrival markers remain. All displayed bands have arrived by the held output. This user-controlled diagram does not infer a spatial scale from Earth geometry or dedisperse the pulse.

## Two Terrestrial Destinations

LF camera keyframes enter through the Galactic halo and disk toward the solar neighbourhood; HF begins inside the Galaxy. Earth uses the selected observatory's geographic surface normal. LF approaches Puerto Rico and an enlarged historic Arecibo landscape; HF approaches Chile and an enlarged Chajnantor plateau. Reversing progress restores camera and geometry. These are cinematic scale changes, not physical space-time metrics or surveyed descent paths.

Arecibo LF depicts a fixed 305 m spherical reflector with curvature radius 265.176 m, towers and suspended receiver. Seven ALFA beams are not seven dishes; the route omits interferometric phasing and coherent array summation. Its position is latitude 18.34422 degrees, longitude -66.7527 degrees. Historical depiction, sources and optical simplifications are in [OBSERVING_CASES](OBSERVING_CASES.md), not a claim about the observatory's current structure.

[ESO ALMA site](https://almascience.eso.org/about-alma/alma-site) supplies the HF location: latitude -23.029 degrees, longitude -67.755 degrees, about 5000 m. Procedural 12 m dishes use a 4.8 m primary focal distance, following the [ALMA Technical Handbook](https://almascience.hq.eso.org/documents-and-tools/latest/alma-technical-handbook). Six antennas and ridges simplify the setting; they are not a measured array configuration, mechanical CAD or terrain elevation model. ALMA geometry belongs to the millimetre HF case, never the LF 1.2-1.6 GHz fixture.

Historical FRB 121102 measurements and the eight Galactic magnetar pulses in the phased ALMA reference are distinct from both synthetic fixtures. Neither observed raw data nor an HF neural trace is imported. See OBSERVING_CASES for source-specific numbers, survey limits and the unavailable private data boundary.

Scene equations are synchronous Canvas mathematical compositions, with explicit integral, fractions and positioned scripts. Their canonical TeX agrees with the linked KaTeX equations. These textures are presentation assets; they do not numerically integrate a cosmological density field.

## Verification

`tests/cosmic.test.ts` checks observer/source frame factors, signed Stokes, Faraday invariants, renderable formulas, exact scene/term contracts, immediate reversible focus, finite reusable geometry, cumulative DM, and rightward frequency-ordered arrivals. Scene updates depend on user progress, not autonomous physical propagation.
