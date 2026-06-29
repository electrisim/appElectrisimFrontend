#!/usr/bin/env python3
"""
soh_capability.py - degradation-aware reactive-power capability for BESS inverters.

Maps battery state-of-health (SOH) and internal resistance (R_int) to the SHRUNK
P-Q capability envelope a real, aged battery can actually support - versus the
ideal envelope assumed when SOH is taken at face value (or inflated by a
leakage-optimistic estimate).

Why this lives next to the OpenDSS tutorial:
    OpenDSS InvControl (Volt-VAR / Volt-Watt) assumes the reactive headroom is
    bounded only by the inverter kVA rating. It does NOT shrink that headroom
    based on the battery's SOH / R_int. This helper computes the realistic
    q_avail_mvar so you can feed it back into the model as the inverter's
    effective limit before trusting the grid-code verdict at the POC.

Source / joint collaboration:
    Electrisim (Adam Kierad) x VolMax Studio Lab (Ivan Nestorov)
    https://github.com/VolMax-Studio/electrisim-soh-capability-demo  (Apache-2.0)

Uses representative parameters for a utility-scale ~3.45 MVA BESS inverter class
(illustrative, not tied to a specific verified datasheet). Replace the specs
below with your project's inverter and aged-battery datasheet values before
drawing binding compliance conclusions.

PHYSICS (instantaneous / grid-stability timescale, NOT energy-depletion):
 1. Aged cell -> higher R_int -> larger I*R_int drop under load
        V_dc = OCV(SOC) - I_dc * R_int
 2. Lower V_dc lowers the inverter's max AC voltage before overmodulation
        V_ac_max = m_max * V_dc / 2   (m_max ~1.0 linear, ~1.15 with 3rd-harm)
 3. Apparent power is bounded by BOTH the inverter current limit and S_rated:
        S_avail = min( S_rated , sqrt(3) * V_ac * I_inv_max )
    and the deliverable reactive headroom at a given P is
        Q_avail = sqrt( max(S_avail^2 - P^2, 0) )

OUT OF SCOPE (must be covered by separate studies):
    - SOC energy depletion over multi-hour load flows
    - thermal derating of cells / power electronics
    - high-frequency inverter control-loop dynamics and transients
    - harmonic voltage/current limits at the POC
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from math import sqrt


@dataclass
class InverterSpec:
    s_rated_mva: float       # nameplate apparent power
    v_dc_nominal_v: float    # nominal DC-link voltage at healthy battery
    i_inv_max_a: float       # inverter AC current limit (per phase, RMS)
    v_ac_nominal_v: float    # nominal AC line voltage (RMS, L-L)
    m_max: float = 1.0       # modulation index ceiling (1.0 linear SVPWM;
    #                          up to ~1.155 with third-harmonic injection)


@dataclass
class BatteryState:
    soh_fraction: float      # 1.0 = new; e.g. 0.80 aged, or an inflated 0.95
    r_int_ohm: float         # present internal resistance (rises with age)
    ocv_v: float             # open-circuit DC voltage at current SOC
    label: str = ""          # "honest" / "leakage_inflated" / etc.


def reactive_capability(
    p_mw: float,
    batt: BatteryState,
    inv: InverterSpec,
    *,
    i_dc_a: float | None = None,
) -> dict:
    """Return the deliverable Q headroom (Mvar) and the shrunk apparent-power
    limit for the given operating point, under the battery's present state.
    """
    p_w = p_mw * 1e6
    if i_dc_a is None:
        # estimate of DC current from active power and nominal link voltage
        i_dc_a = p_w / max(inv.v_dc_nominal_v, 1e-6)

    v_dc = batt.ocv_v - i_dc_a * batt.r_int_ohm
    if v_dc <= 0:
        return {
            "label": batt.label, "p_mw": p_mw, "v_dc_v": round(v_dc, 1),
            "q_avail_mvar": 0.0, "s_avail_mva": 0.0,
            "note": "V_dc collapsed under load (R_int too high for this current)",
        }

    # AC voltage ceiling set by modulation against the real V_dc
    v_ac_max = inv.m_max * v_dc / 2.0
    v_dc_ceiling_healthy = inv.m_max * inv.v_dc_nominal_v / 2.0
    modulation_headroom = min(1.0, v_ac_max / v_dc_ceiling_healthy)

    # Apparent-power limit: min(nameplate, current-limit) * modulation
    s_current_limit = sqrt(3) * inv.v_ac_nominal_v * inv.i_inv_max_a / 1e6  # MVA
    s_avail = min(inv.s_rated_mva, s_current_limit) * modulation_headroom

    # Reactive headroom at this P
    q_sq = s_avail ** 2 - p_mw ** 2
    q_avail = sqrt(q_sq) if q_sq > 0 else 0.0

    # physics gate
    if q_avail > 0:
        s_check = sqrt(p_mw ** 2 + q_avail ** 2)
        assert abs(s_check - s_avail) < 1e-6, (
            f"apparent-power identity violated: {s_check} != {s_avail}"
        )

    return {
        "label": batt.label,
        "p_mw": round(p_mw, 4),
        "v_dc_v": round(v_dc, 1),
        "modulation_headroom": round(modulation_headroom, 4),
        "s_avail_mva": round(s_avail, 4),
        "q_avail_mvar": round(q_avail, 4),
        "p_over_s_limited": p_mw >= s_avail,
    }


def compare_honest_vs_inflated(
    p_mw: float,
    q_required_mvar: float,
    honest: BatteryState,
    inflated: BatteryState,
    inv: InverterSpec,
) -> dict:
    h = reactive_capability(p_mw, honest, inv)
    f = reactive_capability(p_mw, inflated, inv)

    def verdict(cap):
        return {
            **cap,
            "q_required_mvar": q_required_mvar,
            "meets_requirement": cap["q_avail_mvar"] >= q_required_mvar,
            "q_shortfall_mvar": round(max(0.0, q_required_mvar - cap["q_avail_mvar"]), 4),
        }

    vh, vf = verdict(h), verdict(f)
    return {
        "operating_point": {"p_mw": p_mw, "q_required_mvar": q_required_mvar},
        "honest_soh": vh,
        "inflated_soh": vf,
        "verdict_flips": vh["meets_requirement"] != vf["meets_requirement"],
        "interpretation": (
            "Inflated SOH reports compliance the real battery cannot deliver - "
            "the grid-code check passes on paper and fails in the field."
            if (vf["meets_requirement"] and not vh["meets_requirement"])
            else "Both inputs agree at this operating point; sweep P to find where they diverge."
        ),
        "assumptions": {
            "model": "single-stage R_int -> V_dc -> modulation/current-limit -> Q",
            "timescale": "instantaneous (grid-stability); SOC depletion NOT modelled",
            "out_of_scope": ["thermal derating", "inverter control-loop dynamics",
                             "SOC energy duration", "harmonic limits"],
            "inverter": asdict(inv),
            "honest_state": asdict(honest),
            "inflated_state": asdict(inflated),
            "note": "Representative parameters for a utility-scale BESS inverter class (illustrative, not a verified datasheet).",
        },
    }


if __name__ == "__main__":
    import json

    # Representative 3.45 MVA BESS inverter specs at 550 V AC L-L.
    # (Illustrative values for this inverter class)
    inv = InverterSpec(
        s_rated_mva=3.45, v_dc_nominal_v=1100.0,
        i_inv_max_a=3621.0, v_ac_nominal_v=550.0, m_max=1.0,
    )

    # Representative physical cell degradations.
    # Honest:   SOH 80%, internal resistance raised to 45 mOhm.
    # Inflated: SOH 95%, internal resistance reported as 25 mOhm.
    honest = BatteryState(soh_fraction=0.80, r_int_ohm=0.045,
                          ocv_v=1080.0, label="honest")
    inflated = BatteryState(soh_fraction=0.95, r_int_ohm=0.025,
                            ocv_v=1095.0, label="leakage_inflated")

    print(" [note] Calibrated with representative utility-scale inverter specifications.\n")

    # sweep P, find where the compliance verdict flips
    print(" P(MW)  Q_req  Q_honest  Q_inflated  flips?")
    for p in [1.0, 2.0, 2.5, 2.8, 3.0]:
        r = compare_honest_vs_inflated(p, q_required_mvar=1.5,
                                       honest=honest, inflated=inflated, inv=inv)
        print(f" {p:>4}   1.5   "
              f"{r['honest_soh']['q_avail_mvar']:>7}   "
              f"{r['inflated_soh']['q_avail_mvar']:>8}   "
              f"{'YES' if r['verdict_flips'] else 'no'}")

    print()
    detail = compare_honest_vs_inflated(2.8, 1.5, honest, inflated, inv)
    print(json.dumps(detail, indent=2))
