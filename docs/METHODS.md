# Selectable Detection And Classification

The **LF/Arecibo** default route uses recorded CNN/CenterNet plus ResNet. Toy Boxcar detection and radio inspection remain optional. **HF/ALMA** follows its own synthetic SNR/width-bank route, without a DM Bow Tie or trained classification. A detector proposes events; a classifier orders or reviews proposals. Neither confirms an astrophysical origin. Observing cases and backend policy: [OBSERVING_CASES.md](OBSERVING_CASES.md).

Alternative LF scenes and the HF fixture are explicitly synthetic/pedagogical. They do not download weights, train models, call inference services, or reuse incompatible DRAFTS scores. Their mathematical operators are real; provenance identifies each input, threshold, weight and schematic box. HF reuses the existing Explorer SNR operator read-only, not its LF candidate output.

## LF Route Contracts

- `detectionStages('boxcar')`: `boxcar`, `boxcar-bank`, `boxcar-threshold`. Input: fixed 64-value profile, not the exported SNR profile. Output: complete-window filter responses and illustrative threshold proposals.
- `detectionStages('cnn')`: existing RGB preparation, backbone, upsampling, heads and CenterNet decoding. The recorded checkpoint, prepared input and hashes remain unchanged.
- `detectionStages('transformer')`: `vit-patches`, `vit-detection`, `vit-proposals`. Input: fixed schematic 16x16 map. Output: analytic tokens and attention, then hand-drawn boxes without scores or physical-coordinate conversion.
- `classificationStages('radio')`: `radio-checks`. Input: schematic profiles, map and context. Output: inspection relationships, not an estimated Galactic DM or distance.
- `classificationStages('forest')`: `forest-features`, `forest`. Input: fixed vector `[8, 6 ms, 500 pc cm^-3, 0.75]`. Output: votes from three published hand-written trees.
- `classificationStages('resnet', 'cnn')`: existing crop, ResNet and logits. The exact recorded crop remains required. This trace is not evidence for any other detector input.
- `classificationStages('resnet', nonCNN)`: `resnet-didactic`. Equal-length toy convolution and identity paths demonstrate residual addition; no trained classification is asserted.
- `classificationStages('transformer')`: `vit-classification`. Input: fixed schematic crop; output: analytic attention, mean aggregation and two toy logits.
- Only CNN plus ResNet may finish with the legacy recorded candidate. Every other pair finishes with `candidate-didactic`: no recorded score, no inferred DM, no confirmation.

`metodos` is the LF branch before detection. The interface selects detector and classifier independently; only `arecibo-lf` plus CNN/ResNet can display the recorded candidate. That default pair has 27 phases; optional Boxcar/radio has 23. HF keeps its 18-phase classical route. Changing observing case replaces data and removes incompatible recorded scores. The centred final plots use `data-confirmation="not-confirmed"`; the detected-candidate title is not an astrophysical claim.

## HF Signal Search

HF known/injected DM is 1770 pc cm^-3, but the candidate DM is unresolved, not estimated from the data. The resolution decision uses `R_search=Delta t(DM_max=3000)/dt_effective=0.018344957066 < 2`. Equality two is LF. The distinct cube-skip rule uses DM interval delay below one effective sample. Neither policy is an ALMA-paper inference; both follow the repository backend. At native 32 microseconds without downsampling the same setup gives R_search 2.348155 and selects LF. See OBSERVING_CASES for units and references.

`src/hf/model.ts` builds seed 17452900, 128 samples by 32 channels, dt 4.096 ms, Gaussian intensity FWHM 20 ms and background-subtracted residuals. It imports `computeSNR`, `channelShifts` and physical helpers from the original Explorer without editing them. Temporal sum by 128 scales pulse by 128 and independent noise deviation by sqrt(128); this analytic model is not an observed ALMA recording.

The SNR contract follows `src/analysis/snr_utils.py::compute_snr_profile`: channel median/MAD weights, robust detrending/noise normalization, float32 boxcar coefficients and `same` convolution. The six widths are `[1,2,3,5,8,15]` effective samples, or `[4.096,8.192,12.288,20.480,32.768,61.440] ms`. Its width-time raster is 6x128. Kernels retain zero padding and the extra preceding sample for even widths; this differs intentionally from the complete-window LF toy bank below.

The published HF seed peaks at SNR 9.6916513443, time 249.856 ms and W=5 samples (20.48 ms). Selection requires full exposure and `SNR >= 6`, including equality, matching the HF threshold contract rather than the strict CNN detector threshold. The width is a winning filter scale, not a re-estimated Gaussian FWHM. DM remains null/unresolved, neural score absent and confirmation false.

HF stages `hf-resolution`, `hf-matriz`, `hf-profile`, `hf-boxcar`, `hf-candidato` reveal resolution, residual waterfall, weighted profile, filter bank and proposal. Their final linked plots use time, width in ms and frequency in GHz, never relabel width rows as DM. No LF logits, activations or pretrained ResNet result is attached. The backend generally supports HF ResNet classification; a compatible HF trace has not been supplied or executed here.

## LF Toy Boxcar And PRESTO

For background mean `mu`, sample noise `sigma` and complete width `W`, the example computes

`rho_W[n] = sum(x[n+k] - mu, k=0..W-1) / (sigma sqrt(W))`.

The `sqrt(W)` denominator assumes independent, white sample noise. Overlapping windows and trials are correlated; a threshold does not directly provide a global false-alarm probability. The display commits one output only after its complete window is evaluated. It never wraps or shortens a window at an edge.

PRESTO's [single_pulse_search.py](https://github.com/scottransom/presto/blob/master/bin/single_pulse_search.py), reviewed 2026-10-10, documents this normalization and implements normalized boxcar filtering, including FFT convolution. Its real search also detrends, estimates noise, handles bad blocks, selects widths, prunes related peaks, and handles chunk overlap. This app does not reproduce that search or claim PRESTO-equivalent candidates. The displayed six-width bank `[1, 2, 4, 8, 14, 20]` is pedagogical.

The fixed toy profile, for `n=0..63`, is:

`x[n] = (sin(1.7n) + 0.7cos(0.47n))/sqrt(0.745) + 4exp(-0.5((n-31)/2.5)^2)`.

Its oscillatory background illustrates fluctuations, not an independent Gaussian-noise realization. The example sets `mu=0`, `sigma=1`, and `Delta t=1 ms`; its numerical response is not a calibrated statistical significance.

## Visual Attention

[Vision Transformer](https://arxiv.org/abs/2010.11929) supplies the image-to-patch-to-token contract. The fixed map and crop each have 16x16 cells. Raster-order 4x4 patches yield 16 vectors of length 16. An analytic 16x4 projection produces dimension-four tokens. Position components add `(patchRow or patchColumn)/30`.

The published projection is `E[i,j] = cos((i+1)(j+1))/4`, with zero-based indices. `Q` and `V` projections are 4x4 identities; `K` has diagonal 0.8 and paired off-diagonal 0.2, as exported in `src/methods/math.ts`. None are learned parameters.

[Scaled dot-product attention](https://arxiv.org/abs/1706.03762) computes `A = softmax_rows(QK^T/sqrt(4))` and `Y = AV`. Each row of `A` sums to one. Stable softmax subtracts the maximum logit before exponentiation. Products, attention cells and output tokens appear in separate phases. Attention weights show numerical mixing, not a causal explanation of an astrophysical event.

ViT itself is an image classifier, not a complete FRB detector. The detection head and its boxes are therefore schematic. The classification demonstration uses mean aggregation rather than a CLS token. Its head is the fixed 4x2 matrix `[[.6,-.6],[-.3,.3],[.4,-.4],[-.2,.2]]`, with zero biases. Its softmax is an untrained numerical example, not a calibrated probability.

The toy map at `(x,y)` is `0.05sin(1.31n) + exp(-0.5((x-7.5)/w)^2)exp(-0.5((y-7.5)/4)^2)`, where `n=16y+x` and `w=0.6+0.24abs(y-7.5)`. The toy crop is `0.05sin(1.31n) + exp(-0.5((x-7.5)/1.2)^2)`. Both arrays and weights are exported verbatim for reproducibility.

## Trees And Residuals

[Breiman's Random Forests](https://www.stat.berkeley.edu/~breiman/randomforest2001.pdf) defines classification through an ensemble of trees. The app demonstrates evaluation and vote aggregation, not training. Its three trees are hand-written; no bootstrap samples or random-feature training are claimed.

Rules use strict `<` for the lower branch; equality follows the upper branch. Tree one tests SNR 6 then DM 10. Tree two tests width 30 ms then occupancy 0.2. Tree three tests DM 20 then occupancy 0.35. The complete nested rules and paths are exported as `TOY_TREES` and `toyForest`. Vote fraction is not a calibrated astrophysical probability.

[Residual learning](https://arxiv.org/abs/1512.03385) supplies the identity-plus-transformation contract. The incompatible-input fallback uses `[.2,-.8,.4,1.5,.9,-.2,.1,.4]`, convolution kernel `[.25,.5,.25]`, stride one and zero padding. It computes `ReLU(x+F(x))` with equal dimensions. It is not the recorded ResNet or a replacement checkpoint.

## Verification

`tests/methods.test.ts` checks route provenance, formula rendering, units, short copy, complete-window edges, independent normalization values, stable softmax, attention row sums, patch order, dimensions, toy rule ties, residual arithmetic, term-to-object focus and reversible integer construction. No alternative stage claims a trained inference or astrophysical confirmation.

HF checks must independently cover native/effective units, regime boundaries, deterministic fixture generation, SNR-bank/profile equality, convolution borders, threshold equality and case invalidation. Delivery gate results are recorded in VALIDATION; this operator description does not assert that a new test run completed.
