"""Rasterize the exported player frames and encode an MP4: python render_video.py frames.jsonl lang out.mp4"""

import io
import json
import re
import subprocess
import sys
from multiprocessing import Pool

import cairosvg
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1920, 1080, 30
SCALE = 1.9
PAD_W, PAD_H = 420, 470
TREE_W, TREE_H = 560, 470
TOKENS = {
  'bg': '#f5f7f6', 'surface': '#ffffff', 'ink': '#1b2422', 'muted': '#5a6763', 'line': '#d6dedb', 'tint': '#ebf0ee',
  'accent': '#136a68', 'accent-soft': '#d9efec', 'fail': '#c24414', 'fail-soft': '#fbe3d7', 'amber': '#9a6208', 'amber-soft': '#f8eccf',
}
STYLE = (
  "text{font-family:'Noto Sans CJK SC','Noto Sans',sans-serif}"
  + ''.join(f'.s-{k}{{fill:{TOKENS[v]}}}' for k, v in [('ink', 'ink'), ('muted', 'muted'), ('accent', 'accent'), ('fail', 'fail'), ('amber', 'amber')])
  + f".s-line{{stroke:{TOKENS['line']}}}.s-stroke-ink{{stroke:{TOKENS['ink']}}}.s-stroke-muted{{stroke:{TOKENS['muted']}}}"
)
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
FONT_BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
CHAPTERS = {'zh': [(0, '刺垫与载荷'), (2.5, '第 1 轮'), (12, '第 2–4 轮'), (25.4, '很多样本')],
            'en': [(0, 'Pad and load'), (2.5, 'Round 1'), (12, 'Rounds 2–4'), (25.4, 'Many samples')]}
TITLE = {'zh': 'Microspine 联合存活模型 · 同一轮的同时失效', 'en': 'Microspine joint survival model · simultaneous failures'}


def resolve(svg_inner):
  return re.sub(r'var\(--([a-z-]+)\)', lambda m: TOKENS[m.group(1)], svg_inner)


def raster(inner, w, h):
  svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w * SCALE:.0f}" height="{h * SCALE:.0f}"><style>{STYLE}</style>{resolve(inner)}</svg>'
  png = cairosvg.svg2png(bytestring=svg.encode('utf-8'))
  return Image.open(io.BytesIO(png)).convert('RGBA')


def wrap(draw, text, font, width):
  lines, cur = [], ''
  tokens = re.findall(r'[A-Za-z0-9#.,;:%()\'"“”→−\-+/=×·]+\s*|\s+|.', text)
  no_start = set('，。；：、）》」』！？,.;:!?)%')
  for tok in tokens:
    trial = cur + tok
    if draw.textlength(trial, font=font) <= width or not cur or tok[0] in no_start:
      cur = trial
    else:
      lines.append(cur.rstrip())
      cur = tok.lstrip()
  if cur.strip():
    lines.append(cur.rstrip())
  return lines


def frame(args):
  line, lang, total = args
  f = json.loads(line)
  img = Image.new('RGB', (W, H), TOKENS['surface'])
  d = ImageDraw.Draw(img)
  pad, tree = raster(f['pad'], PAD_W, PAD_H), raster(f['tree'], TREE_W, TREE_H)
  x0, gap = 20, 18
  y0 = 62 + (H - 14 - 62 - pad.height) // 2
  for x, im in ((x0, pad), (x0 + pad.width + gap, tree)):
    d.rounded_rectangle([x - 4, y0 - 4, x + im.width + 4, y0 + im.height + 4], radius=14, fill=TOKENS['bg'])
    img.paste(im, (x, y0), im)
  title_font = ImageFont.truetype(FONT_BOLD, 26)
  d.text((24, 14), TITLE[lang], font=title_font, fill=TOKENS['ink'])
  chapter = [name for start, name in CHAPTERS[lang] if f['t'] >= start][-1]
  small = ImageFont.truetype(FONT, 22)
  stamp = f"{chapter}   {int(f['t'] // 60)}:{int(f['t'] % 60):02d} / {int(total // 60)}:{int(total % 60):02d}"
  d.text((W - 24 - d.textlength(stamp, font=small), 18), stamp, font=small, fill=TOKENS['muted'])
  # progress bar with chapter ticks
  d.rectangle([0, H - 8, W, H], fill=TOKENS['tint'])
  d.rectangle([0, H - 8, int(W * f['t'] / total), H], fill=TOKENS['accent'])
  for start, _ in CHAPTERS[lang][1:]:
    x = int(W * start / total)
    d.rectangle([x - 1, H - 8, x + 1, H], fill=TOKENS['surface'])
  return img.tobytes()


def main(argv=None):
  frames_path, lang, out = (argv or sys.argv[1:])[:3]
  lines = open(frames_path, encoding='utf-8').read().splitlines()
  total = json.loads(lines[-1])['t']
  ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                         '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
  with Pool(48) as pool:
    for k, raw in enumerate(pool.imap(frame, ((ln, lang, total) for ln in lines), chunksize=4)):
      ff.stdin.write(raw)
      if k % 300 == 0:
        print(f'frame {k}/{len(lines)}', flush=True)
  ff.stdin.close()
  ff.wait()
  print('done', out)


if __name__ == '__main__':
  main()
