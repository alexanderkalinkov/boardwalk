#!/usr/bin/env python3
"""Turn the OpenStreetMap extracts in data/osm/ into js/outlines.js.

For each airport this writes real terminal outlines (split into the app's walkable
zones), gate positions and toilets, all in the app's plan frame: metres from an anchor
point, rotated so the map's "up" is the given compass bearing. The projection matches
project()/unproject() in js/app.js exactly.

  python3 tools/osm/build.py            # write js/outlines.js
  python3 tools/osm/build.py --plot     # also draw tools/osm/out/<KEY>.png to check zones

Needs: shapely (and matplotlib for --plot). Data: (c) OpenStreetMap contributors, ODbL,
taken from the Overture Maps release named in data/osm/README.md.
"""
import json, math, os, re, sys
from shapely.geometry import shape, Polygon, MultiPolygon, Point, box
from shapely.ops import unary_union, nearest_points

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def rect(x0, y0, x1, y1):
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

# ---------------------------------------------------------------------------
# Per-airport setup. Zone clip polygons and extra shapes are in the plan frame
# (x right, y down, metres from the anchor, after rotation).
# ---------------------------------------------------------------------------
AIRPORTS = {
    'SOF2': dict(
        src='SOF', anchor=(42.6895, 23.4142), rot=344,
        buildings=['w53563578'],
        zones=[
            # departures level: the pier and the north half of the main hall are airside
            dict(b='S', name='Airside', l=1, clip=[[-400, -400], [400, -400], [400, 10], [-400, 10]]),
            dict(b='L', name='Check-in hall', l=1, clip=[[-400, 10], [400, 10], [400, 400], [-400, 400]]),
            # arrivals level: reclaim under the airside, arrivals hall under check-in
            dict(b='R', name='Baggage reclaim', l=0, nowalk=1, clip=[[-400, -60], [400, -60], [400, 10], [-400, 10]]),
            dict(b='L', name='Arrivals hall', l=0, clip=[[-400, 10], [400, 10], [400, 400], [-400, 400]]),
        ],
        outside=[dict(b='L', out=1, l=1, poly=[[-90, 125], [10, 88], [110, 118], [110, 150], [10, 120], [-90, 157]]),
                 dict(b='L', out=1, l=0, poly=[[-90, 125], [10, 88], [110, 118], [110, 150], [10, 120], [-90, 157]]),
                 dict(b='L', out=1, l=0, poly=[[95, 100], [175, 100], [175, 140], [95, 140]])],
        gate_zone='S', gate_level=1,
    ),
    'SOF1': dict(
        src='SOF', anchor=(42.6896, 23.4026), rot=16,
        buildings=['w89155443'],
        zones=[
            dict(b='S', name='Airside', clip=[[-400, -400], [400, -400], [400, -2], [-400, -2]]),
            dict(b='L', name='Landside', clip=[[-400, -2], [400, -2], [400, 400], [-400, 400]]),
        ],
        outside=[dict(b='L', out=1, poly=[[-120, 40], [130, 22], [130, 62], [-120, 72]])],
        gate_zone='S',
    ),
    'LHR5': dict(
        src='LHR5', anchor=(51.4715, -0.4855), rot=90,
        buildings=['w23479613', 'w23479729', 'w23479811'],
        # Terminal 5A's outline is missing from the extract: drawn from its published size
        # (396 x 176 m) and the positions of gates A1-A23 around it. Frame here is rot=0.
        extra_rot0=[dict(name='T5A', poly=rect(-256, -215, -80, 181))],
        zones=[
            dict(b='A', name='T5A', clip=rect(-400, 0, 400, 262)),
            dict(b='B', name='T5B', clip=rect(-400, -450, 400, -150)),
            dict(b='C', name='T5C', clip=rect(-400, -800, 400, -500)),
            dict(b='L', name='Frontal building', clip=rect(-400, 262, 400, 420)),
        ],
        outside=[dict(b='L', out=1, poly=rect(-200, 250, 160, 284))],
        gate_zones=['A', 'B', 'C'],
    ),
    'AMS': dict(
        src='AMS', anchor=(52.3090, 4.7640), rot=0,
        buildings=['w268641398', 'w268641330', 'w268641343', 'w268641332', 'w268641335', 'w268641334',
                   'w268641337', 'w268641325', 'w268641326', 'w749201920', 'w268641346', 'w923134614',
                   'w1468985448', 'w268641352', 'w268641409', 'w516883763', 'w521074365', 'w521074366',
                   'w516883761', 'w516883762'],
        # landside: a band along the south-west front (departure halls 1-3 and Schiphol Plaza)
        zones=[
            dict(b='M', name='Airside', clip_not=[[-298, -67], [-28, 173], [66, 67], [-204, -173]]),
            dict(b='L', name='Departure halls', clip=[[-298, -67], [-28, 173], [66, 67], [-204, -173]]),
        ],
        outside=[dict(b='L', out=1, poly=[[-278, -29], [-46, 178], [-24, 153], [-256, -54]])],
        gate_zone='M',
    ),
}

def P(a, lat, lon):
    """latitude/longitude -> plan x, y (same maths as project() in app.js)"""
    lat0, lon0 = a['anchor']; r = math.radians(a['rot'])
    e = (lon - lon0) * 111320 * math.cos(math.radians(lat0)); n = (lat - lat0) * 110540
    return (e * math.cos(r) - n * math.sin(r), -(e * math.sin(r) + n * math.cos(r)))

def rot0_to_plan(a, x, y):
    """a point in the unrotated frame (x east, y south) -> plan frame"""
    e, n = x, -y; r = math.radians(a['rot'])
    return (e * math.cos(r) - n * math.sin(r), -(e * math.sin(r) + n * math.cos(r)))

def to_plan(a, geom):
    def ring(cs): return [P(a, lat, lon) for lon, lat in cs]
    if geom.geom_type == 'Polygon':
        return Polygon(ring(geom.exterior.coords), [ring(i.coords) for i in geom.interiors])
    if geom.geom_type == 'MultiPolygon':
        return MultiPolygon([to_plan(a, g) for g in geom.geoms])
    if geom.geom_type == 'Point':
        return Point(*P(a, geom.y, geom.x))
    return Point(*P(a, geom.centroid.y, geom.centroid.x))

def load(src):
    return json.load(open(os.path.join(ROOT, 'data', 'osm', src + '.geojson')))['features']

def polys(g):
    if g.is_empty: return []
    if g.geom_type == 'Polygon': return [g]
    return [p for p in getattr(g, 'geoms', []) if p.geom_type == 'Polygon']

def r1(v): return round(v, 1)
def coords(p): return [[r1(x), r1(y)] for x, y in list(p.exterior.coords)[:-1]]

def build(key, a):
    feats = load(a['src'])
    ids = {f['properties']['osm'].split('@')[0]: f for f in feats if f['properties'].get('osm')}
    shapes = []
    for bid in a['buildings']:
        f = ids.get(bid)
        if not f: raise SystemExit(f'{key}: building {bid} not in extract')
        shapes.append(to_plan(a, shape(f['geometry'])))
    for ex in a.get('extra_rot0', []):
        shapes.append(Polygon([rot0_to_plan(a, x, y) for x, y in ex['poly']]))
    foot = unary_union([s.buffer(0.5, join_style=2) for s in shapes]).buffer(-0.5, join_style=2)
    # fill courtyards: the app treats a zone as one walkable outline
    foot = unary_union([Polygon(p.exterior) for p in polys(foot)])
    foot = foot.simplify(0.8, preserve_topology=True)
    areas = []
    for z in a['zones']:
        part = foot.difference(Polygon(z['clip_not'])) if 'clip_not' in z else foot.intersection(Polygon(z['clip']))
        for p in polys(part):
            if p.area < 150: continue
            p = Polygon(p.exterior).simplify(0.5)
            ar = {'b': z['b'], 'poly': coords(p)}
            for k in ('name', 'l', 'nowalk', 'out'):
                if k in z: ar[k] = z[k]
            areas.append(ar)
    for z in a.get('outside', []):
        areas.append(dict(z))
    # gates: snap the OSM gate (often on the stand) to just inside the walkable outline
    gates = {}
    airside = unary_union([Polygon(x['poly']) for x in areas if x['b'] == a.get('gate_zone') or (a.get('gate_zones') and x['b'] in a['gate_zones'])]) if areas else foot
    for f in feats:
        p = f['properties']
        if p.get('class') != 'airport_gate': continue
        t = p.get('tags', {})
        ref = (t.get('ref') or p.get('name') or '').replace('Pier ', '').strip()
        if not re.fullmatch(r'[A-Z]?\d{1,3}[A-Za-z]?', ref): continue
        pt = to_plan(a, shape(f['geometry'])).centroid
        if airside.is_empty or airside.distance(pt) > 120: continue
        inside = airside.contains(pt)
        edge = nearest_points(airside.exterior if airside.geom_type == 'Polygon' else airside.boundary, pt)[0]
        # pick which polygon (zone) the gate belongs to
        zone = None
        for x in areas:
            if x['b'] in (a.get('gate_zones') or [a.get('gate_zone')]) and Polygon(x['poly']).distance(edge) < 1:
                zone = x; break
        vx, vy = pt.x - edge.x, pt.y - edge.y
        d = math.hypot(vx, vy)
        if inside or d < 2:
            # node sits on/inside the wall: face away from the polygon's centre of mass nearby
            loc = Polygon(zone['poly']) if zone else airside
            c = loc.intersection(pt.buffer(60)).centroid
            vx, vy = edge.x - c.x, edge.y - c.y; d = math.hypot(vx, vy) or 1
        ux, uy = vx / d, vy / d
        gx, gy = edge.x - ux * 9, edge.y - uy * 9
        if not airside.contains(Point(gx, gy)):
            q = nearest_points(airside, Point(gx, gy))[0]; gx, gy = q.x, q.y
        ang = math.degrees(math.atan2(ux, -uy)) % 360   # 0 = aircraft above the gate
        g = {'id': ref, 'x': r1(gx), 'y': r1(gy), 'a': round(ang), 'b': zone['b'] if zone else a.get('gate_zone')}
        if zone and 'l' in zone: g['l'] = zone['l']
        typ = t.get('aeroway:gate:type')
        if typ: g['type'] = typ
        if t.get('level') is not None: g['osmLevel'] = t.get('level')
        g['osm'] = p['osm'].split('@')[0]
        if ref not in gates: gates[ref] = g
    # toilets inside (or right by) the terminal
    toilets = []
    near = foot.buffer(4)
    for f in feats:
        p = f['properties']
        if p.get('class') != 'toilets': continue
        pt = to_plan(a, shape(f['geometry'])).centroid
        if not near.contains(pt): continue
        t = p.get('tags', {})
        lv = t.get('level') or t.get('floor')
        # which walkable zone (and floor, where the plan has floors) the toilet is in
        cand = [x for x in areas if not x.get('out') and Polygon(x['poly']).buffer(4).contains(pt)]
        try: lvn = int(str(lv).split(';')[0])
        except (TypeError, ValueError): lvn = None
        pick = next((x for x in cand if 'l' in x and x['l'] == lvn and not x.get('nowalk')), None) or \
               next((x for x in cand if not x.get('nowalk')), None)
        if not pick: continue
        q = Point(pt.x, pt.y)
        poly = Polygon(pick['poly'])
        if not poly.buffer(-3).contains(q):
            inner = poly.buffer(-5)
            if not inner.is_empty: q = nearest_points(inner, q)[0]
        tl = {'x': r1(q.x), 'y': r1(q.y), 'b': pick['b']}
        if 'l' in pick: tl['l'] = pick['l']
        toilets.append(dict(tl, **{'level': lv,
                        'wheelchair': t.get('wheelchair'), 'changing': t.get('changing_table'),
                        'airside': t.get('airside'), 'osm': p['osm'].split('@')[0]}))
    lat0, lon0 = a['anchor']
    return {'geo': {'lat': lat0, 'lon': lon0, 'x': 0, 'y': 0, 'rot': a['rot'], 's': 1},
            'areas': areas, 'gates': sorted(gates.values(), key=lambda g: g['id']), 'toilets': toilets,
            'buildings': [coords(p) for p in polys(foot)]}

def plot(key, a, out):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(13, 13))
    feats = load(a['src'])
    for f in feats:  # context: other buildings nearby
        if f['properties']['kind'] != 'building': continue
        for p in polys(to_plan(a, shape(f['geometry']))):
            xs, ys = zip(*p.exterior.coords); ax.plot(xs, ys, color='#bbb', lw=.6)
    cols = {'S': '#4a90d9', 'M': '#4a90d9', 'A': '#4a90d9', 'B': '#7aa9e0', 'C': '#9bbbe6', 'L': '#e0a24a', 'R': '#999'}
    for ar in out['areas']:
        xs, ys = zip(*(ar['poly'] + ar['poly'][:1]))
        ax.fill(xs, ys, color=cols.get(ar['b'], '#8c8'), alpha=.25 if ar.get('l', 1) else .1)
        ax.plot(xs, ys, color=cols.get(ar['b'], '#8c8'), lw=1)
    for g in out['gates']:
        ax.plot(g['x'], g['y'], 'o', color='g', ms=3)
        ax.annotate('', xy=(g['x'] + 20 * math.sin(math.radians(g['a'])), g['y'] - 20 * math.cos(math.radians(g['a']))), xytext=(g['x'], g['y']), arrowprops=dict(arrowstyle='->', color='g', lw=.6))
        ax.text(g['x'] + 2, g['y'] + 2, g['id'], fontsize=6)
    for t in out['toilets']:
        ax.plot(t['x'], t['y'], 's', color='m', ms=3); ax.text(t['x'] + 2, t['y'] - 2, 'WC' + str(t['level'] or ''), fontsize=5, color='m')
    b = [1e9, 1e9, -1e9, -1e9]
    for ar in out['areas']:
        for x, y in ar['poly']: b = [min(b[0], x), min(b[1], y), max(b[2], x), max(b[3], y)]
    ax.set_xlim(b[0] - 80, b[2] + 80); ax.set_ylim(b[3] + 80, b[1] - 80); ax.set_aspect('equal')
    ax.set_xticks(range(int(b[0] // 50 * 50) - 100, int(b[2]) + 100, 50)); ax.set_yticks(range(int(b[1] // 50 * 50) - 100, int(b[3]) + 100, 50))
    ax.tick_params(labelsize=6); ax.grid(alpha=.3)
    os.makedirs(os.path.join(ROOT, 'tools', 'osm', 'out'), exist_ok=True)
    plt.savefig(os.path.join(ROOT, 'tools', 'osm', 'out', key + '.png'), dpi=72, bbox_inches='tight'); plt.close(fig)

def main():
    res = {}
    only = [k for k in sys.argv[1:] if not k.startswith('--')]
    for key, a in AIRPORTS.items():
        if only and key not in only: continue
        res[key] = build(key, a)
        if '--plot' in sys.argv: plot(key, a, res[key])
        print(key, len(res[key]['areas']), 'areas', len(res[key]['gates']), 'gates', len(res[key]['toilets']), 'toilets', file=sys.stderr)
    if only: return
    js = ('/* Generated by tools/osm/build.py from data/osm/ — do not edit by hand.\n'
          '   Terminal outlines, gates and toilets: (c) OpenStreetMap contributors, ODbL 1.0. */\n'
          "'use strict';\nvar OUTLINES=" + json.dumps(res, separators=(',', ':'), ensure_ascii=False) + ';\n')
    open(os.path.join(ROOT, 'js', 'outlines.js'), 'w').write(js)

if __name__ == '__main__':
    main()
