"""Read-only reuse of DRAFTS preprocessing and candidate SNR for static evidence."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

os.environ.setdefault("MPLBACKEND", "Agg")
PROJECT = Path(__file__).resolve().parents[1]
REPOSITORY = PROJECT.parents[1]
sys.path.insert(0, str(REPOSITORY))

import numpy as np
from src.analysis.snr_utils import compute_snr_profile
from src.visualization.visualization_unified import preprocess_img


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    source = PROJECT.parent / "frb-explorer/public/traces"
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    crop = json.loads((source / "crops/candidate.json").read_text(encoding="utf-8"))
    state = manifest["state"]
    dm_map = np.fromfile(args.output / "dm-map.f32", dtype="<f4").reshape(state["dmCount"], state["samples"])
    detector_input = np.ascontiguousarray(preprocess_img(dm_map).astype(np.float32))[None]
    detector_hash = hashlib.sha256(detector_input.tobytes()).hexdigest()
    if detector_hash != manifest["inputHashes"]["detectorNCHW"]:
        raise AssertionError("Regenerated DM map does not match the real detector input")
    patch = np.fromfile(args.output / "original-crop.f32", dtype="<f4").reshape(crop["originalShape"])
    snr, _, widths = compute_snr_profile(patch, dt_seconds=crop["dtSeconds"], widths_ms=state["boxcarWidthsMs"])
    peak = int(np.argmax(snr))
    if abs(float(snr[peak]) - manifest["candidate"]["snr"]) > 1e-5:
        raise AssertionError("Candidate SNR no longer matches the fixed trace")
    if int(widths[peak]) != manifest["candidate"]["widthSamples"]:
        raise AssertionError("Candidate matched width no longer matches the fixed trace")
    snr.astype("<f4").tofile(args.output / "profile.f32")
    # Undo normalization on the captured float32 input, preserving its actual channel order.
    rgb = detector_input[0].transpose(1, 2, 0).astype(np.float64)
    rgb = rgb * np.array([0.229, 0.224, 0.225]) + np.array([0.485, 0.456, 0.406])
    np.rint(np.clip(rgb, 0, 1) * 255).astype(np.uint8).tofile(args.output / "rgb.u8")
    print(json.dumps({"python": sys.version.split()[0], "numpy": np.__version__,
                      "detectorInputSHA256": detector_hash, "snrPeak": float(snr[peak]),
                      "snrPeakWithinCrop": peak, "widthSamples": int(widths[peak])}), flush=True)


if __name__ == "__main__":
    main()
