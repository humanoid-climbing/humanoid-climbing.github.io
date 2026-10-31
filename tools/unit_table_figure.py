"""Figure of the single-unit table the simulator draws from: media/unit-table.png.

Run with the code repository's environment, which provides the packaged table and the bench trials:
  python tools/unit_table_figure.py [--out media/unit-table.png]
"""

import argparse
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap

from scr_phybot_mjab.assets.microspine import EMPIRICAL_UNIT_TABLE
from scr_phybot_mjab.tools.microspine.empirical_fitting import EARLY, read_trials
from scr_phybot_mjab.tools.paths import DEFAULT_UNIT_TRIALS

INK, INK2, MUTED, GRID, AXIS = "#1d1d1f", "#52514e", "#898781", "#e1e0d9", "#c3c2b7"
BLUE = {150: "#b7d3f6", 250: "#86b6ef", 400: "#3987e5", 550: "#1c5cab", 700: "#0d366b"}
SHEARS = (0.0, 10.0, 20.0, 30.0)
SHEAR_INK = (BLUE[250], BLUE[400], BLUE[550], BLUE[700])
# Diverging about zero: blue where a unit must be pressed to hold, red where it holds a pull, gray at zero.
DIVERGING = LinearSegmentedColormap.from_list(
  "capacity", ["#184f95", "#5598e7", "#cde2fb", "#f0efec", "#f6c9c2", "#e34948", "#9c2b2a"]
)


def main(argv=None):
  parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
  parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "media" / "unit-table.png")
  args = parser.parse_args(argv)

  table = np.load(EMPIRICAL_UNIT_TABLE, allow_pickle=False)
  shear, lateral, q = table["shear_n"], table["lateral_n"], table["normal_quantile_n"]
  supported, nq = table["supported"].astype(bool), q.shape[-1]
  rows = read_trials(DEFAULT_UNIT_TRIALS)
  pulled = [r for r in rows if r["result"] == "detached_normal"]
  held = [r for r in rows if r["result"] == "held"]
  early = [r for r in rows if r["result"] in EARLY]
  print(f"{len(rows)} trials: {len(pulled)} let go under the pull, {len(early)} before it, {len(held)} held")

  plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 11.5, "axes.edgecolor": AXIS, "axes.labelcolor": INK2,
    "xtick.color": MUTED, "ytick.color": MUTED, "axes.titlesize": 12.5, "axes.titleweight": "bold",
    "axes.titlecolor": INK, "axes.titlelocation": "left", "axes.spines.top": False, "axes.spines.right": False,
  })
  fig, (a, b, c) = plt.subplots(1, 3, figsize=(13.2, 4.4), dpi=200, gridspec_kw={"width_ratios": [1.05, 1, 1.15]})

  # (a) the strength quantiles at zero lateral load, with the trials behind them
  col = supported[:, 0]
  s = shear[col]
  band = lambda u: q[col, 0, min(int(u * nq), nq - 1)]
  a.fill_between(s, band(0.05), band(0.95), color=BLUE[150], lw=0, label="5–95% of units")
  a.fill_between(s, band(0.25), band(0.75), color=BLUE[250], lw=0, label="25–75%")
  a.plot(s, band(0.5), color=BLUE[700], lw=2, label="median")
  zero_l = [r for r in pulled if float(r["l_n"]) == 0.0]
  a.scatter([float(r["s_n"]) for r in zero_l], [float(r["fz_cmd_n"]) for r in zero_l], s=12, color=INK2,
            edgecolor="white", linewidth=0.6, zorder=3, label="trial: let go under the pull")
  zero_h = [r for r in held if float(r["l_n"]) == 0.0]
  if zero_h:
    a.scatter([float(r["s_n"]) for r in zero_h], [float(r["fz_last_held_n"]) for r in zero_h], marker="^", s=28,
              color=INK, zorder=3, label="trial: still holding at the bench limit")
  a.axhline(0, color=AXIS, lw=1, zorder=0)
  a.set(xlabel="Shear along the spines [N]", ylabel="Pull-off force [N]  (+ away from the wall)")
  a.set_title("(a) Strength, at zero lateral load")
  a.legend(loc="upper left", frameon=False, fontsize=9, handlelength=1.4)
  a.grid(axis="y", color=GRID, lw=0.6)

  # (b) the plant's failure probability: the share of strength ranks below the pull
  pull = np.linspace(-4, 10, 701)
  for value, ink in zip(SHEARS, SHEAR_INK):
    i = int(np.argmin(np.abs(shear - value)))
    alpha = (q[i, 0][None, :] < pull[:, None]).mean(-1)
    b.plot(pull, alpha, color=ink, lw=2, drawstyle="steps-post", label=f"{value:.0f} N")
  b.set(xlabel="Pull on the unit [N]", ylabel="Chance the unit has let go", ylim=(-0.02, 1.02), xlim=(-4, 10))
  b.set_title("(b) Failure probability, by shear")
  b.legend(title="Shear", loc="lower right", frameon=False, fontsize=9.5, title_fontsize=9.5)
  b.grid(color=GRID, lw=0.6)

  # (c) the median pull-off force over every tested shear and lateral load
  median = np.where(supported, q[..., nq // 2], np.nan).T
  image = c.imshow(median, origin="lower", cmap=DIVERGING, vmin=-6, vmax=6, aspect="auto",
                   extent=(shear[0] - 2.5, shear[-1] + 2.5, lateral[0] - 2.5, lateral[-1] + 2.5))
  for j, lv in enumerate(lateral):
    for i, sv in enumerate(shear):
      v = median[j, i]
      if np.isfinite(v):
        c.text(sv, lv, f"{v:.1f}", ha="center", va="center", fontsize=7.5, color="white" if abs(v) > 3.8 else INK)
  c.set(xlabel="Shear along the spines [N]", ylabel="Lateral load [N]", xticks=shear[::2], yticks=lateral)
  c.set_title("(c) Median pull-off force [N]")
  for side in ("left", "bottom"):
    c.spines[side].set_visible(False)
  bar = fig.colorbar(image, ax=c, fraction=0.05, pad=0.03)
  bar.outline.set_visible(False)
  bar.ax.tick_params(colors=MUTED, labelsize=9)
  bar.set_label("below 0: holds only while pressed", color=INK2, fontsize=9.5)

  fig.tight_layout(w_pad=2.2)
  fig.savefig(args.out, facecolor="white")
  print(args.out)


if __name__ == "__main__":
  main()
