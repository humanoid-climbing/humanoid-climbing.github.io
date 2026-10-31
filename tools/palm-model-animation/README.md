# Palm-model animation

`media/palm-model.mp4` and its poster `palm-model.jpg`, in the page's palette. The player `video2.js` and its data `vdata.json` come from
the microspine survival-model explainer; `render_video.py` is that explainer's frame compositor, and `render_site.py`
swaps in the page's colours without touching layout or text.

    node frames.js en 30 frames_en.jsonl                      # every frame's pad and tree SVG
    python render_site.py frames_en.jsonl site_en.mp4 poster.jpg
    ffmpeg -i site_en.mp4 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -an -movflags +faststart ../../media/palm-model.mp4

Run from this folder, with Python that has cairosvg and Pillow, and the Noto Sans CJK fonts installed.
