# Open Edition

The site for our trip to Miami Art Week, December 4–7, 2026: plans, the house, getting around, the itinerary, wardrobe ideas, the soundtrack, costs, FAQs, RSVP and memories.

It's a static site with no build step on the server. Vercel serves `index.html` as is.

## Files

- `index.html`: the site
- `rsvp.js`: the four-step RSVP form. It opens a pre-filled email to hello@losaeguavoen.com
- `assets/`: photos and the Aspekta font files
- `src/Miami.dc.html`: the Claude Design source the site is built from
- `config.json`: the playlist and shared-album links
- `scripts/build.py`: rebuilds `index.html` from the source and config

## Making changes

1. Update `src/Miami.dc.html` (or `config.json` for links).
2. Run `python3 scripts/build.py`.
3. Commit and push to `main`. Vercel deploys automatically.

## Who's coming (guest list)

Guests unlock the section with a shared password, then add or edit their own profile (name, one line, city, Instagram, photo). Each browser keeps a private edit key, so people can only change their own profile.

- API: `api/guests.js` (GET list, POST save, DELETE remove)
- Storage: Vercel Blob, one JSON file per guest under `guests/`
- Environment variables on Vercel:
  - `GUEST_PASSWORD`: the shared password
  - `BLOB_READ_WRITE_TOKEN`: added automatically when a Blob store is connected to the project

## Memories (shared album)

After the trip, people unlock the album with the same password, then upload photos and videos and leave a favourite moment. Files go straight from the browser to Vercel Blob (`api/upload.js` issues the upload token). Each memory is stored as JSON under `memories/` (`api/memories.js`). `src/memories.js` is bundled to `memories.js` by the build script.

## Password page

`middleware.js` sends anyone without the site cookie to `/login`. One password (`GUEST_PASSWORD`) covers the site, the guest list and the album. Changing it on Vercel signs everyone out.

## Other settings

- `config.json`: `hostPhone`, `backupContact`, `payMethods` and `rooms` fill the emergency answer, payment line and rooms board. Run the build after editing.
- `KIT_ITEMS` (Vercel env var, one item per line): the kit contents, revealed from Friday, December 4.
- RSVPs are saved to Blob under `rsvps/` (`api/rsvps.js`) and feed the "Who lands when" board and song requests.
- `/recap` builds a recap page from the album.

## Privacy

The house address is not in the page or this repo. It's stored in the `HOUSE_ADDRESS` env var on Vercel and only sent to signed-in guests (`api/house.js`).

## The tape

`/tape` is a sideways, VHS-and-film-style reel of everyone's uploaded photos, videos and favourite moments, grouped into Friday to Monday. Scroll, drag, use the arrow keys, or press Play to run through it. Before the trip it shows a preview built from the site's own photos.

## Trip tools

- **Today's shot**: one photo prompt per day on the itinerary and in the upload form.
- **Same spot, every day**: a daily group photo (`kind: daily`), shown as a four-up strip in Memories.
- **Ride groups**: the arrivals board groups people by day, airport and landing window, and names who calls the Uber.
- **The tab** (`api/tab.js`): shared costs logged during the trip, settled into who owes who.
- **Calendar**: `openedition.ics` is built from the itinerary by `scripts/build.py`.
- **Screening mode** on `/tape`: full screen, sound on, plays from the start. `/tape?sample` shows a finished sample.

## The app (`/app`)

An installable app (add to home screen) for the four days in Miami. It stays locked behind a countdown until Friday, December 4.

- **Now**: what's on and what's next, today's shot, your 24-frame roll, your ride, the tab, the kit, the soundtrack.
- **Camera**: four lenses (Gallery, Golden hour, Night tape, Clean) baked into each photo; post as a moment, a fit or the daily group photo.
- **Darkroom**: photos develop the next morning at 9 (Monday's at 9pm).
- **Rooms**: the four days as cassette-style cards with the run of show and that day's developed frames.
- **Guests**: everyone's wall label and their frames.

Preview switches: `/app/?preview` (open early), `/app/?at=sat-16:45` (pretend time), `/app/?sample` (sample photos), `/app/?welcome` (replay onboarding).

## Spotted (the trip game)

In the app: a 16-square Art Week bingo card (photo proof optional, proof photos also go to the album), a live leaderboard (1 point a square, 3 per full line), and six shared tally counters anyone can add to. Data lives in Blob under `game/` (`api/game.js`). Preview with `/app/?sample`.
