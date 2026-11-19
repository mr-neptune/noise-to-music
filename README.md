# Noise to Music

Random notes evolve, one optimization step at a time, into a short song in the genre you pick: classical, jazz, lo-fi, rock, funk, or a blend of two. Press play and listen to it learn.

Play it at **https://wayne-wen.dev/lab/**.

- A genetic algorithm (population 200) mutates and recombines melody, bass, counter-melody and chords on a 16th-note grid.
- The loss comes from per-genre style models trained offline on real music (the Lakh MIDI Dataset, jazz solos from the Weimar Jazz Database, and classical scores from the Mutopia Project and PDMX), measured against held-out real music.
- Classical also comes in four styles with their own models and accompaniment: Chopin, Mozart, Beethoven and Impressionist (Debussy, Ravel, Satie, Fauré).
- Any melody beat can be a triplet. Classical learns how often real scores use them (about one beat in eight), and new bar rhythms are drawn from the patterns real music uses.
- The song has sections (A A B A′, or 32 bars with a C section) and is scored both per section and as a whole: chord flow across section boundaries, contrast between sections, and a final cadence.
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
- [Mutopia Project](https://www.mutopiaproject.org/) scores: 473 public-domain and CC BY pieces by Chopin, Mozart, Beethoven, Bach, Schubert, Mendelssohn, Haydn, Dvořák and others. The typesetter and license of each are listed in [training/mutopia-credits.tsv](training/mutopia-credits.tsv).
- [PDMX](https://zenodo.org/records/15571083) (Long, Novack, Berg-Kirkpatrick and McAuley, *PDMX: A Large-Scale Public Domain MusicXML Dataset for Symbolic Music Processing*, 2024), CC BY 4.0: 3,783 public-domain and CC0 MuseScore scores of classical composers, including orchestral and band arrangements.
- [Weimar Jazz Database](https://jazzomat.hfm-weimar.de/) (WJazzD) by the Jazzomat Research Project, under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The jazz model is trained on its solo transcriptions.

`web/models.json` contains information from the Weimar Jazz Database, which is made available under the ODbL 1.0. The trained models are likewise made available under the [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
