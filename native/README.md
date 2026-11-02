# Open Edition — Expo Go

A native shell around the live app (openedition.vercel.app/app). Everything the guests
see comes from the website, so changes to the site show up here with no rebuild.

## Open it on your phone

1. Install **Expo Go** from the App Store or Play Store.
2. On your computer (Node 20+):

   ```
   git clone https://github.com/losavoen/openedition
   cd openedition/native
   npm install
   npx expo start --tunnel
   ```

3. Scan the QR code: iPhone → Camera app, Android → Expo Go.
4. Sign in with the trip password the first time. It remembers you after that.

**Preview PIN (limited access).** Anyone you send this to can type the 4-digit preview PIN
instead of the password. They get the full app on sample photos and people, so they can see how it
works. They can't see the house address, the site, real guests, real photos or the tab, and nothing
they do is posted. The PIN lives in Vercel as `VIEW_PIN`; change or delete it there to cut access.

`--tunnel` lets the phone connect even when it isn't on the same Wi-Fi as the computer.

## Share it with the group without your computer running

```
npm install -g eas-cli
eas login
eas update:configure
eas update --branch preview --message "Open Edition"
```

That gives a link and QR code anyone with Expo Go can open.

## What the shell adds over the website

- Full screen, with a status bar that follows Light / Black
- Photos shared as real files to iMessage, WhatsApp and the rest of the share sheet
- WhatsApp, Messages, Instagram, Spotify and Maps links open in their own apps
- Pull to refresh, swipe back, Android back button
- A clear "No signal" screen with Try again
