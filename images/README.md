# Game artwork

The five `*-16.png` atlases were generated for this game. Each contains 16
illustrations without a surrounding card frame. The app draws its own outline.
The older JPG files remain as reference assets; gameplay uses the new PNGs.
Character avatars still use `characters_final.png`.

`THEMES` in `script.js` keeps the picture names, atlas dimensions and each
picture's source bounds together. The generated sheets have uneven row spacing,
so artwork is rendered using those bounds and an SVG clip rather than assuming
perfectly uniform cells. Keep the name and bounds at the same array index when
adding or replacing a picture. Update the bounds if the atlas image changes.

Each round selects six distinct entries using Fisher–Yates, duplicates them
into pairs and shuffles the 12 cards. Attack controls sit outside the card grid.

The school glue picture uses `glue-stick.png`, based on the yellow-cap/green-body
glue stick familiar to the students. Its source is overridden at school index 5;
the spoken name stays `풀`. Other entries still use the shared atlas.
