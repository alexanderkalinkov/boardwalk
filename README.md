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

Places, hours and gates come from public guides, listed inside the app under Settings and privacy. The floor plans are schematic sketches, not surveys. Sofia is the test airport and is meant to be checked in person.

## Project layout

- `index.html`: app markup
- `css/app.css`: styles, light and dark, Apple and Google looks
- `js/airports.js`: airport data (areas, gates, places, sources, geo-reference)
- `js/app.js`: map, routing, trips, live location and compass
- `vendor/`: MapLibre GL JS 4.7.1 (BSD-3-Clause) for the street map
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and home screen install

No build step: open `index.html` through any static web server, for example `python3 -m http.server`.

## Adding an airport

Add an entry to `AIRPORTS` in `js/airports.js` and its key to `AIRPORT_LIST`. Each entry needs walkable `areas` (rectangles in metres), `gates` (with the side the aircraft parks on), `pois`, `sources`, and a `geo` anchor (a map point, its latitude and longitude, and the compass bearing of the map's "up").
