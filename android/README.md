# Android Trusted Web Activity (Play Store)

This folder is a Bubblewrap configuration for the paid Google Play edition of **Leonida Map & Guide**. The TWA wraps the existing static PWA once it is published at:

[https://yjerv.github.io/gta6-tracker/](https://yjerv.github.io/gta6-tracker/)

It does not contain a generated Android Gradle project yet. Generate that on Yuan’s laptop with [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) from this `twa-manifest.json`. Do not commit keystore files or passwords.

## App identity

| Field | Value |
| --- | --- |
| Package ID | `uk.co.yjerv.leonidaguide` |
| App name | Leonida Map & Guide |
| Short / launcher name | Leonida Guide |
| Version | `1.0.0` (`appVersionCode`: 1) |
| Launch URL | `https://yjerv.github.io/gta6-tracker/` |
| Display | standalone, portrait |
| Price | £2.99 paid app, no ads, no in-app purchases |

## Signing key (laptop only)

The upload keystore path in `twa-manifest.json` matches Yuan’s laptop convention:

- Path: `C:/Users/yuanj/keystores/leonida-guide-upload.keystore`
- Alias: `upload`

**Never put the keystore password, key password, or the `.keystore` file in this repository, in chat, or in a script.** Create the keystore on the laptop if it does not already exist, and keep the passwords in a password manager.

Example (run locally, you will be prompted for passwords):

```bash
keytool -genkeypair -v -keystore "C:/Users/yuanj/keystores/leonida-guide-upload.keystore" -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

## Digital asset links

After you sign the first upload AAB, add the SHA-256 fingerprint of the **upload** (and later the Play App Signing **app**) certificate to:

`https://yjerv.github.io/gta6-tracker/.well-known/assetlinks.json`

Bubblewrap can print the JSON once the keystore is available locally:

```bash
npx @bubblewrap/cli fingerprint generateAssetLinks
```

Until that file is live on GitHub Pages, the TWA may fall back to a Custom Tab instead of a fullscreen app.

## Generate the Android project

From a working copy of this branch, on the laptop (Node 18+):

```bash
npx @bubblewrap/cli init --manifest=android/twa-manifest.json
# or, if the project was already generated:
npx @bubblewrap/cli update
npx @bubblewrap/cli build
```

`build` will ask for the keystore passwords interactively. It produces an upload AAB for Play Console. Listing copy, the feature graphic, screenshots, and the privacy policy are in `play-store/` and `privacy.html`.

## Enable GitHub Pages first

The TWA host is `yjerv.github.io` with start URL `/gta6-tracker/`. In the repository Settings → Pages, deploy from the branch you want to publish (usually `main` after this Play Store PR is reviewed and merged) and the `/` root folder. Confirm these URLs resolve before shipping the AAB:

- https://yjerv.github.io/gta6-tracker/
- https://yjerv.github.io/gta6-tracker/manifest.webmanifest
- https://yjerv.github.io/gta6-tracker/privacy.html
- https://yjerv.github.io/gta6-tracker/icons/icon-512.png
