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
