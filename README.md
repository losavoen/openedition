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
