"""The palm-model animation in the project page's palette: python render_site.py frames.jsonl out.mp4 [poster.jpg]"""

import json
import sys

from PIL import Image

import render_video as rv

# The page's tokens: band panels, ink and secondary ink, hairlines, its blue for units that hold, a red for failures.
SITE = {
  'bg': '#f5f5f7', 'surface': '#ffffff', 'ink': '#1d1d1f', 'muted': '#6e6e73', 'line': '#d2d2d7', 'tint': '#e8e8ed',
  'accent': '#0071e3', 'accent-soft': '#dbebfb', 'fail': '#cf3f2a', 'fail-soft': '#f9e6e3', 'amber': '#b26b00', 'amber-soft': '#fbefd9',
}
rv.TOKENS.update(SITE)
rv.STYLE = (
  "text{font-family:'Noto Sans CJK SC','Noto Sans',sans-serif}"
  + ''.join(f'.s-{k}{{fill:{rv.TOKENS[v]}}}' for k, v in [('ink', 'ink'), ('muted', 'muted'), ('accent', 'accent'), ('fail', 'fail'), ('amber', 'amber')])
  + f".s-line{{stroke:{rv.TOKENS['line']}}}.s-stroke-ink{{stroke:{rv.TOKENS['ink']}}}.s-stroke-muted{{stroke:{rv.TOKENS['muted']}}}"
)

if __name__ == '__main__':
  frames, out = sys.argv[1:3]
  if len(sys.argv) > 3:
    lines = open(frames, encoding='utf-8').read().splitlines()
    total = json.loads(lines[-1])['t']
    Image.frombytes('RGB', (rv.W, rv.H), rv.frame((lines[int(25.0 * rv.FPS)], 'en', total))).save(sys.argv[3], quality=86)
  rv.main([frames, 'en', out])
