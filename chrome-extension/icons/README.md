# icons/

Chrome requires PNG icons at three sizes. Create these files before loading
the extension as an unpacked extension in `chrome://extensions/`.

| File        | Size           | Used for                        |
|-------------|----------------|---------------------------------|
| icon16.png  | 16 × 16 px     | Favicon in browser toolbar      |
| icon48.png  | 48 × 48 px     | Extensions management page      |
| icon128.png | 128 × 128 px   | Chrome Web Store listing        |

## Quick way to generate placeholder icons

If you have ImageMagick installed:

```bash
magick -size 16x16  xc:"#2563eb" -fill white -font Arial -pointsize 8  -gravity Center -annotate 0 "P" icon16.png
magick -size 48x48  xc:"#2563eb" -fill white -font Arial -pointsize 24 -gravity Center -annotate 0 "P" icon48.png
magick -size 128x128 xc:"#2563eb" -fill white -font Arial -pointsize 64 -gravity Center -annotate 0 "P" icon128.png
```

For production, replace these with a proper shield/fish-hook SVG exported at
each size.  Tools like Figma, Inkscape, or https://realfavicongenerator.net
can produce all three sizes from a single SVG source.
