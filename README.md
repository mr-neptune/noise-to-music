# Noise to Music

Random notes evolve, one optimization step at a time, into a short song in the genre you pick: classical, jazz, lo-fi, rock, funk, or a blend of two. Press play and listen to it learn.

Play it at **https://wayne-wen.dev/lab/**.

- A genetic algorithm (population 200) mutates and recombines melody, bass, counter-melody and chords on a 16th-note grid.
- The loss comes from per-genre style models trained offline on real MIDI (the Lakh MIDI Dataset), measured against held-out real music.
- The song has sections (A A B A′) and is scored both per section and as a whole: chord flow across section boundaries, contrast between sections, and a final cadence.
- Everything runs in the browser with the Web Audio API. Nothing is sent anywhere.

## Layout

| Path | What it is |
| --- | --- |
| `web/` | The page: `index.html` (UI, synth, drawing), `engine.js` (optimizer and critic, also runs in Node) and `models.json` (trained style models). Static files, no build step. |
| `training/` | The offline pipeline that turns MIDI into `web/models.json`. See [training/README.md](training/README.md). |

## Run locally

```sh
cd web && python3 -m http.server 8000
# open http://localhost:8000/
```

## How it is deployed

[wayne-wen.dev](https://github.com/mr-neptune/mr-neptune.github.io) includes this repository as a git submodule. Its `wrangler deploy` copies `web/` to `/lab/` on the site.

## Data credits

- [Lakh MIDI Dataset](https://colinraffel.com/projects/lmd/) by Colin Raffel, CC BY 4.0.
- [tagtraum genre annotations](https://www.tagtraum.com/msd_genre_datasets.html) by Hendrik Schreiber.
