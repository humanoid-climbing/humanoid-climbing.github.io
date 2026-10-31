# Humanoid Wall Climbing: project page

Static project page, served by GitHub Pages at <https://sxuanalan.github.io/climbing/>.
Links to `../` and `../images/` resolve to the homepage repository, `SXuanAlan.github.io`.

- `index.html`: the page.
- `assets/`: stylesheet and script (no build step).
- `media/`: videos and their posters, figures. From the code repository (`scr-phybot_mjlab`):
  - `pipeline.png` is rendered from the slide figure `artifacts/MRGP.svg` (cairosvg at 2400 px wide, 64 colours).
  - `unit-table.png` is drawn by `tools/unit_table_figure.py` from the packaged unit table and its bench trials; run it with that repository's environment.
  - `human-climb.mp4` is `artifacts/human_climb.mp4`, cropped to 16:9 from the top and scaled to 1280 × 720, without sound.
  - `palm-model.mp4` and its poster are rendered in the page's palette by `tools/palm-model-animation/`.
- `tools/`: scripts that regenerate figures.

Preview locally from the folder: `python -m http.server`, then open <http://localhost:8000/>.
Source slides in `external_references/` are not tracked.
