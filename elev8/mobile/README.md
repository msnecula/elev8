# Elev8 Comply — iOS and Android apps

The apps are a thin native shell ([Capacitor](https://capacitorjs.com)) that opens
**https://www.elev8comply.com**. Everything you ship to the website shows up in the
apps immediately — you only rebuild the apps to change the icon, name, version or
native settings.

| | |
| --- | --- |
| App name | Elev8 Comply |
| Bundle ID / package | `com.elev8comply.app` |
| Who signs in | Staff and clients (same logins as the website) |
| Push notifications | Not in v1 |
| Offline | Shows a "You're offline" screen with **Try again** |

Files: `capacitor.config.json` (name, ID, the website address), `ios/` (Xcode project),
`android/` (Android Studio project), `assets/` (1024px icon and splash artwork),
`www/offline.html` (the offline screen).

---

## iPhone / iPad (on your Mac)

### One-time setup

1. Install **Xcode** from the Mac App Store and open it once to finish installing.
2. Install **Node.js 20 or newer** from https://nodejs.org.
3. In Terminal:

   ```bash
   git clone https://github.com/msnecula/elev8.git
   cd elev8/elev8/mobile
   npm install
   npx cap sync ios
   npx cap open ios
   ```

4. In Xcode, click **App** (blue icon, top of the left sidebar) → **Signing & Capabilities**:
   - Check **Automatically manage signing**.
   - **Team**: pick your Apple Developer team.
   - **Bundle Identifier** should read `com.elev8comply.app`.

### Try it

Pick an iPhone simulator (or your plugged-in iPhone) at the top of Xcode and press **▶ Run**.
Sign in with a test account and click through the app.

### Upload to TestFlight

1. In **App Store Connect** (appstoreconnect.apple.com) → **Apps** → **+** → **New App**:
   platform iOS, name **Elev8 Comply**, bundle ID `com.elev8comply.app`, SKU `elev8comply`.
2. In Xcode, set the device to **Any iOS Device (arm64)**, then **Product → Archive**.
3. When the Organizer opens: **Distribute App → App Store Connect → Upload**.
4. After processing (10–30 minutes), the build appears under **TestFlight**. Add yourself
   and staff as **internal testers** — no Apple review needed — and install it with the
   TestFlight app.

### Submit to the App Store

In App Store Connect → the app → the version page:

- **Screenshots**: 6.9" iPhone and 13" iPad (take them in the simulator with ⌘S).
- **Description, keywords, support URL** (`https://www.elev8comply.com`),
  **privacy policy URL** (`https://www.elev8comply.com/privacy`).
- **App Privacy**: name, email address and phone number are collected, linked to the
  user, used for app functionality; no tracking.
- **App Review Information → Sign-in required**: give Apple a working test login (a
  client account and a staff account) and a note: *"Elev8 Comply is an invite-only
  compliance workflow app for elevator companies and the building owners they serve.
  Accounts are created by the company's administrator; users cannot self-register."*
- Choose the build from TestFlight and **Submit for Review**.

Heads-up: Apple sometimes rejects apps that mostly show a website (guideline 4.2,
"minimum functionality"). If that happens, the usual fix is adding native features —
push notifications for dispatches and 48-hour alerts is the obvious next step for v2.

### Each new version

Bump the version in Xcode (**App → General → Version**, e.g. 1.1, and **Build** +1),
then Archive and upload again. Website changes never need a new app version.

---

## Android (later — needs a Google Play developer account)

1. Install **Android Studio** (developer.android.com/studio) on the Mac.
2. In `elev8/elev8/mobile`: `npx cap sync android` then `npx cap open android`.
3. Try it on an emulator: **▶ Run**.
4. For the Play Store: **Build → Generate Signed App Bundle** → create a new **keystore**.
   **Back up the keystore file and its passwords** — without them you can never update the app.
5. In the Play Console, create the app and upload the `.aab`. New *personal* developer
   accounts must run a closed test with at least 12 testers for 14 days before going
   public; *organization* accounts (with a D-U-N-S number) skip that.

Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle` for each new release.

---

## Changing the icon or splash

Replace the images in `assets/` (`icon-only.png` 1024×1024, `splash.png` 2732×2732), then on
the Mac run `npm run icons` and `npx cap sync`.
