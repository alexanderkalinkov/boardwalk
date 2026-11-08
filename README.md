# Boardwalk

Boardwalk is a free, crowdsourced airport companion. Add your flight and get a countdown to boarding, your gate, and an indoor map that shows how long the walk takes. There's no account, and your trips stay on your phone.

This repository is the **web app test build**. It runs in any phone browser and can be added to the home screen, where it opens full screen and works offline.

## What's in it

- **Airports:** Sofia Terminal 2 and Terminal 1, London Heathrow Terminal 5, and Amsterdam Schiphol. Use the airport button (top right) to switch between them.
- **Around the airport:** car parks, drop-off and pick-up, trains, metro, buses, shuttles, taxi stands and car hire, all searchable with walking routes from inside the terminal.
- **Street map:** the terminal plan sits on a real OpenStreetMap street map (tiles from OpenFreeMap, light and dark). If the plan is in the wrong spot, open Settings and privacy, then "Line up the map with the streets": drag, rotate and scale it, then tap Copy to send us the values.
- **Floors:** Sofia Terminal 2 has two levels (0 Arrivals, 1 Departures). The floor switcher on the right shows one level at a time. Routes use lifts, escalators and stairs, show "↑ Level 1" where you change floor, and switch floor as you walk. Turn on Step-free routes in Settings to use lifts only. Connector positions are a best guess until checked on site.
- **Live location:** tap the arrow button. GPS finds which airport you're at, and the blue dot follows you. Indoor GPS is rough (often 10–30 m), so the dot is smoothed and kept inside the building. If it's in the wrong place, tap where you really are and choose "I'm actually here"; the correction is remembered for that airport.
- **Compass:** the cone on the blue dot turns with your phone. On iPhone, Safari asks for motion access the first time you turn on live location.
- **Map styles:** Apple Maps style on iPhone and Google Maps style on Android. Switch in Settings and privacy, Look.
- **Privacy:** everything (trips, reports, places you add, location corrections) is stored only in the browser on your phone.

## Data

- **Building outlines, gates and toilets** come from OpenStreetMap (© OpenStreetMap contributors, ODbL), via the Overture Maps open data release. They're in `data/osm/` and turned into `js/outlines.js` by `tools/osm/build.py`; see `data/osm/README.md`. Heathrow T5A's outline is missing from OpenStreetMap, so it's drawn from the building's published size and its gates.
- **Shops, cafés, lounges, services and transport** come from public guides, listed inside the app under Settings and privacy, and are placed from their descriptions.
- **Best guesses to check on site:** where airside ends and the check-in hall begins, and (at Sofia T2) where the escalators, lift and stairs are. Sofia is the test airport.

## Project layout

- `index.html`: app markup
- `css/app.css`: styles, light and dark, Apple and Google looks
- `js/outlines.js`: generated terminal outlines, gates and toilets from OpenStreetMap (don't edit by hand)
- `js/airports.js`: airport data (zones, security, places, sources, geo-reference)
- `data/osm/`, `tools/osm/`: the OpenStreetMap extracts and the scripts that fetch them and build `js/outlines.js`
- `js/app.js`: map, routing, trips, live location and compass
- `vendor/`: MapLibre GL JS 4.7.1 (BSD-3-Clause) for the street map
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and home screen install

No build step: open `index.html` through any static web server, for example `python3 -m http.server`.

## Adding an airport

1. Add the airport's box to `tools/osm/fetch_overture.py` and run it.
2. Add it to `AIRPORTS` in `tools/osm/build.py`: an anchor point, the compass bearing for the map's "up", the OpenStreetMap ids of the terminal buildings, and how to split them into zones (airside, landside, floors). Run `python3 tools/osm/build.py --plot` and check the picture in `tools/osm/out/`.
3. Add an entry to `AIRPORTS` in `js/airports.js` and its key to `AIRPORT_LIST`, using `OUTLINES.<KEY>` for `geo`, `areas` and `gates`, plus security, `pois` and `sources`. Map units are metres from the anchor.
