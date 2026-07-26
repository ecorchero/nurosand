# Nurosand iOS — Meta Ray-Ban (DAT)

Separate folder for the Meta Wearables Device Access Toolkit iPhone sample.
This is **not** part of the Watch Xcode project.

## Layout

```text
ios-rayban/
  meta-wearables-dat-ios/          # cloned Meta DAT SDK + samples
    samples/CameraAccess/          # ← run this for live glasses video
    samples/DisplayAccess/         # Ray-Ban Display sample (optional)
  README.md                        # this file
```

## Open the video sample

```bash
open ios-rayban/meta-wearables-dat-ios/samples/CameraAccess/CameraAccess.xcodeproj
```

## Run on a real iPhone

1. Glasses paired in the **Meta AI** app (use whichever Meta account you want).
2. In Meta AI: turn on **Developer Mode**.
3. In Xcode → **Settings → Accounts**: click **+** and add the **other Apple ID** (do not sign out of yours).
4. CameraAccess target → **Signing & Capabilities**:
   - **Team** = that other Apple ID’s Personal Team
   - Bundle ID: change if needed (e.g. `otherperson.Nurosand.CameraAccess`) so it’s unique under that team
5. Destination: physical iPhone → Run.
6. In the app: **Connect** → register if prompted → start the camera stream.

## Wearables Developer Center

Without Developer Mode / proper registration, streaming may fail.
Register at: https://wearables.developer.meta.com/

You may need a project + release channel, and `MetaAppID` / `ClientToken` in the sample’s `Info.plist` (`MWDAT` keys) if Developer Mode isn’t enough.

## Next (Nurosand fusion)

Once frames show on the phone, we can forward JPEGs to the Mac hub:

`POST http://<mac-ip>:8765/frame`

Watch HR/IMU already posts to the same Mac receiver.
