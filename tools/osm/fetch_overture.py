#!/usr/bin/env python3
"""Download OpenStreetMap buildings, gates and toilets around each airport from the
Overture Maps open data release on Amazon S3 (anonymous HTTPS, byte-range reads), and
write data/osm/<AIRPORT>.geojson.

Overture redistributes OpenStreetMap under the ODbL. This route is used because the
OpenStreetMap APIs (Overpass, api.openstreetmap.org) block automated cloud machines.

  python3 tools/osm/fetch_overture.py            # uses RELEASE below
Needs: pyarrow, requests, shapely.
"""
import io, json, os, re, sys
from concurrent.futures import ThreadPoolExecutor
import requests, pyarrow.parquet as pq, shapely.wkb, shapely.geometry

RELEASE = '2026-10-21.0'
BASE = 'https://overturemaps-us-west-2.s3.amazonaws.com/'
BOXES = {  # west, south, east, north
    'SOF': [23.385, 42.680, 23.430, 42.700],
    'LHR5': [-0.500, 51.465, -0.475, 51.480],
    'AMS': [4.745, 52.298, 4.780, 52.318],
}
KEEP = ('airport_gate', 'toilets', 'atm', 'information', 'elevator', 'drinking_water', 'vending_machine')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
S = requests.Session()

class RangeFile(io.RawIOBase):
    def __init__(self, key):
        self.url = BASE + key; self.pos = 0
        self.size = int(S.head(self.url).headers['Content-Length'])
    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos
    def seek(self, o, w=0):
        self.pos = o if w == 0 else (self.pos + o if w == 1 else self.size + o); return self.pos
    def read(self, n=-1):
        if n < 0: n = self.size - self.pos
        if n <= 0 or self.pos >= self.size: return b''
        end = min(self.size, self.pos + n) - 1
        d = S.get(self.url, headers={'Range': f'bytes={self.pos}-{end}'}).content
        self.pos += len(d); return d
    def readinto(self, b):
        d = self.read(len(b)); b[:len(d)] = d; return len(d)

def keys(prefix):
    out, tok = [], None
    while True:
        u = BASE + '?list-type=2&prefix=' + prefix + ('&continuation-token=' + requests.utils.quote(tok) if tok else '')
        t = S.get(u).text
        out += re.findall(r'<Key>([^<]*)', t)
        m = re.search(r'<NextContinuationToken>([^<]*)', t)
        if not m: return [k for k in out if k.endswith('.parquet')]
        tok = m.group(1)

def overlaps(bb, box): return bb['xmin'] <= box[2] and bb['xmax'] >= box[0] and bb['ymin'] <= box[3] and bb['ymax'] >= box[1]

def scan(theme):
    """find the row groups whose bounding-box statistics touch any airport box"""
    def one(k):
        md = pq.ParquetFile(RangeFile(k)).metadata
        ix = {md.schema.column(i).path: i for i in range(md.num_columns)}
        hits = []
        for g in range(md.num_row_groups):
            rg = md.row_group(g); st = lambda c: rg.column(ix[c]).statistics
            bb = {'xmin': st('bbox.xmin').min, 'xmax': st('bbox.xmax').max, 'ymin': st('bbox.ymin').min, 'ymax': st('bbox.ymax').max}
            if any(overlaps(bb, b) for b in BOXES.values()): hits.append(g)
        return k, hits
    with ThreadPoolExecutor(32) as ex:
        return {k: h for k, h in ex.map(one, keys(f'release/{RELEASE}/{theme}/')) if h}

def main():
    feats = {n: [] for n in BOXES}
    for theme, kind in [('theme=buildings/type=building', 'building'), ('theme=buildings/type=building_part', 'building_part'),
                        ('theme=base/type=infrastructure', 'infrastructure')]:
        for key, groups in scan(theme).items():
            pf = pq.ParquetFile(RangeFile(key))
            cols = [c for c in pf.schema_arrow.names if c in ('geometry', 'bbox', 'sources', 'names', 'class', 'num_floors', 'source_tags')]
            for g in groups:
                for r in pf.read_row_group(g, columns=cols).to_pylist():
                    if kind == 'infrastructure' and r.get('class') not in KEEP: continue
                    src = (r.get('sources') or [{}])[0]
                    if 'OpenStreetMap' not in str(src.get('dataset')): continue
                    for n, box in BOXES.items():
                        if not overlaps(r['bbox'], box): continue
                        tags = r.get('source_tags'); tags = dict(tags) if isinstance(tags, list) else (tags or {})
                        p = {'kind': kind, 'osm': src.get('record_id'), 'class': r.get('class'), 'name': (r.get('names') or {}).get('primary')}
                        if tags: p['tags'] = tags
                        if r.get('num_floors'): p['floors'] = r['num_floors']
                        feats[n].append({'type': 'Feature', 'properties': p,
                                         'geometry': shapely.geometry.mapping(shapely.wkb.loads(r['geometry']))})
        print(theme, 'done', file=sys.stderr)
    for n, f in feats.items():
        json.dump({'type': 'FeatureCollection', 'features': f}, open(os.path.join(ROOT, 'data', 'osm', n + '.geojson'), 'w'), separators=(',', ':'))
        print(n, len(f), file=sys.stderr)

if __name__ == '__main__':
    main()
