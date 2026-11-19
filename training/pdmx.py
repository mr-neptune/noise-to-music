"""Pick classical scores from PDMX for training and write an extract list.

PDMX (Long et al., 2024, CC BY 4.0) holds MuseScore scores that are public
domain or CC0. Uses the deduplicated subset without license conflicts, skips
simplified arrangements, and labels each score with a style from its
composer.

Usage: python3 pdmx.py <PDMX.csv> <pdmx dir> > list.tsv   (lines: "pdmx-<style>\t<path>")
"""

import csv
import re
import sys
from collections import Counter
from pathlib import Path

STYLES = {
    'chopin': ['chopin'],
    'mozart': ['mozart'],
    'beethoven': ['beethoven'],
    'impressionist': ['debussy', 'ravel', 'satie', 'faure', 'fauré'],
    'classical': ['bach', 'haydn', 'schubert', 'schumann', 'liszt', 'mendelssohn', 'brahms', 'tchaikovsky',
                  'grieg', 'rachmaninoff', 'rachmaninov', 'handel', 'händel', 'vivaldi', 'dvorak', 'dvořák',
                  'scarlatti', 'clementi', 'czerny', 'burgmuller', 'burgmüller', 'mussorgsky', 'borodin',
                  'rimsky', 'saint-saens', 'saint-saëns', 'elgar', 'verdi', 'puccini', 'rossini', 'paganini',
                  'albeniz', 'albéniz', 'granados', 'sibelius', 'smetana', 'bizet', 'offenbach', 'strauss'],
}
SIMPLIFIED = re.compile(r'\b(easy|easier|simplif\w*|beginner\w*|for kids|very easy|level \d|grade \d)\b', re.I)


def style_of(row):
    who = ' '.join((row.get('composer_name') or '', row.get('artist_name') or '')).lower()
    for style, names in STYLES.items():
        if any(n in who for n in names):
            return style
    return None


def main():
    csv.field_size_limit(10**9)
    root = Path(sys.argv[2])
    counts, kept = Counter(), Counter()
    for row in csv.DictReader(open(sys.argv[1], encoding='utf-8', errors='replace')):
        if row.get('subset:no_license_conflict') != 'True' or row.get('subset:deduplicated') != 'True':
            continue
        if row.get('license') not in ('cc-zero', 'publicdomain'):
            continue
        style = style_of(row)
        if not style:
            continue
        counts[style] += 1
        text = ' '.join(row.get(k) or '' for k in ('title', 'subtitle', 'song_name', 'tags'))
        if SIMPLIFIED.search(text) or not row.get('mid') or row['mid'] == 'NA':
            continue
        path = root / row['mid'].lstrip('./')
        if not path.exists():
            continue
        kept[style] += 1
        print(f'pdmx-{style}\t{path}')
    print('matched', dict(counts), 'kept', dict(kept), file=sys.stderr)


if __name__ == '__main__':
    main()
