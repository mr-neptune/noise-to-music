# Training the genre style models

This directory trains the per-genre models that `web/engine.js` uses as its loss.
Training happens offline. The browser only loads the result, `web/models.json`.

## Data

The source data is not committed. It is downloaded into `~/data/midi`:

- [Lakh MIDI Dataset](https://colinraffel.com/projects/lmd/) by Colin Raffel (CC BY 4.0): `lmd_matched` and `clean_midi`.
- [tagtraum genre annotations](https://www.tagtraum.com/msd_genre_datasets.html) for the Million Song Dataset (`msd_tagtraum_cd1.cls`). They give `lmd_matched` its Jazz and RnB labels.
- Artist lists over `clean_midi` for rock, funk, and extra jazz and R&B.
- Classical scores from the [Mutopia Project](https://www.mutopiaproject.org/), in `~/data/mutopia`. Only pieces in the public domain or under CC BY (no ShareAlike) are used: 1,127 movements in 4/4, 2/2, 2/4, 6/8, 12/8 or 6/4 from 473 pieces. [mutopia-credits.tsv](mutopia-credits.tsv) lists each piece with its typesetter and license. They are engraved scores, so their rhythms are exact, triplets included. Pieces in 3/4 and 3/8 are skipped, since the engine writes in 4/4.
- The [Weimar Jazz Database](https://jazzomat.hfm-weimar.de/) (WJazzD) from the Jazzomat Research Project: 456 transcribed jazz solos with beat-level chord changes and bass pitches, in one SQLite file in `~/data/wjazzd`. The jazz model uses the 432 solos in 4/4. WJazzD is released under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). `web/models.json` contains information from it and is made available under the ODbL as well.

Lo-fi has no MIDI dataset of its own. It is trained on jazz and R&B files under 95 BPM.

## Pipeline

```sh
npm install

# 1. Features: melody, bass, a chord per half bar, key, tempo (16th-note grid).
#    list.tsv lines are "<genre>\t<path>".
for i in 0 1 2 3 4 5; do node extract.mjs ~/data/midi/list.tsv ~/data/midi/extracted/part$i.jsonl $i 6 & done; wait
#    Classical scores: find the bar line after a pickup (ALIGN) and mark the
#    melody's triplet beats (TRIPLETS). Compound meters (6/8, 12/8) become
#    4/4 with triplet beats. list.tsv lines are "mutopia\t<path>".
ALIGN=1 TRIPLETS=1 node extract.mjs ~/data/mutopia/list.tsv ~/data/midi/extracted/mutopia.jsonl

#    Jazz solos from the Weimar Jazz Database (positions and chord symbols
#    come straight from the database).
node wjazzd.mjs ~/data/wjazzd/wjazzd.db ~/data/midi/extracted/wjazz.jsonl

# 2. Train. Every 10th file per genre is held out.
HOLDOUT=~/data/midi/extracted/holdout.json node train.mjs main.jsonl mutopia.jsonl wjazz.jsonl > ../web/models.json

# 3. Baselines. Score the held-out 4-bar windows with the browser's own code
#    (engine.js) and store the 10th percentile of each loss component. For
#    classical, the melody rhythm must fall between the 20th and 50th
#    percentiles, so the most predictable rhythm doesn't win.
node baseline.mjs ../web/models.json ~/data/midi/extracted/holdout.json
```

## What the models hold

All tables are key-independent except `degree`, which only uses files in the genre's mode.
Each component's loss is `max(0, value - baseline)`.

| Table | What it models |
| --- | --- |
| `melPat` / `bassPat` | 16-step onset patterns per bar: the top patterns, with a per-step Bernoulli backoff. Melody patterns have 4 more bits, one per beat, for triplet beats. The optimizer also draws new bar rhythms from them. |
| `ivUni` / `ivBi` | Melodic intervals (±12 semitones), unigram and bigram |
| `melRel` | Melody pitch relative to the chord root, by beat strength and chord class |
| `chordT` | Next half-bar chord given the current quality and the bar position (root motion and quality) |
| `hr` | Number of chord changes per 4 bars |
| `degree` | Chord root degree and quality relative to the tonic |
| `bassRel` / `bassIv*` | Bass pitch relative to the chord root, and bass intervals |
| `fill`, `notesPerBar`, `melCenter`, `melSpan`, `sim02`, `sim13` | Articulation, density, register and phrase repetition |

## Classical weighting

Mozart's and Dvořák's orchestral works would otherwise make up half the classical bars, so each composer counts for at most 5,000 bars and Chopin counts triple. Chord labels in busy scores pick up passing tones (Cmaj9, C5), so classical folds them into common-practice chords: 5, maj7 and maj9 become major, 9 becomes 7, and m9 becomes m7.
