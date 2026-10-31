# Humanoid Wall Climbing: project page

Static project page, served by GitHub Pages from the `humanoid-climbing` organization at <https://humanoid-climbing.github.io/>.
It stands on its own: links to the author's homepage are absolute (<https://sxuanalan.github.io/>), and the icons are in `assets/`.

- `index.html`: the page.
- `assets/`: stylesheet, script and icons (no build step). `index.html` links the stylesheet and the script with `?v=` and the first eight characters of the file's md5; update it whenever the file changes, so browsers fetch the new one.
- `media/`: videos and their posters, figures. From the code repository (`scr-phybot_mjlab`):
  - `pipeline.png` is rendered from the slide figure `artifacts/MRGP.svg` (cairosvg at 2400 px wide, 64 colours).
  - `unit-table.png` is drawn by `tools/unit_table_figure.py` from the packaged unit table and its bench trials; run it with that repository's environment.
  - `human-climb.mp4` is `artifacts/human_climb.mp4`, cropped to 16:9 from the top and scaled to 1280 × 720, without sound.
  - `palm-model.mp4` and its poster are rendered in the page's palette by `tools/palm-model-animation/`.
  - `palm1-hinge.png`, `palm2-drawing.png`, `palm2-cad.jpg` and `palm2-side.jpg` are the figures of `external_references/palm_interation2.pptx`; the hold-probability table in the palm iterations is typed from the same slide.
- `tools/`: scripts that regenerate figures.

Preview locally from the folder: `python -m http.server`, then open <http://localhost:8000/>.
Source slides in `external_references/` are not tracked.
