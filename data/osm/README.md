# OpenStreetMap extracts

`SOF.geojson`, `LHR5.geojson` and `AMS.geojson` hold the buildings, building parts, gates and toilets
around each airport, taken from the [Overture Maps](https://overturemaps.org) release `2026-10-21.0`
(only features whose source is OpenStreetMap).

Data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The app credits
OpenStreetMap on the map and lists it under each airport's sources.

- Refresh the extracts: `python3 tools/osm/fetch_overture.py` (needs `pyarrow requests shapely`)
- Rebuild `js/outlines.js`: `python3 tools/osm/build.py` (add `--plot` to draw `tools/osm/out/*.png`)

Known gap: Heathrow Terminal 5A's outline is missing from the extract, so `tools/osm/build.py`
draws it from its published size and the gate positions.
