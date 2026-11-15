# 节奏 / Rhythm Motion

A small browser port of the original Pure Data virtual drumstick game. No build step or runtime dependencies.

Click the drum, touch it, or press Space. Press **开始** for a 32-beat round after a four-beat count-in. A hit plays `true.wav`; an offbeat strike plays `false.wav`. Before a round, the pad is free play.

**动作** enables phone motion input. iOS Safari requests motion permission on that button press. Android Chrome works when its device and browser settings permit motion sensors. Use the deployed HTTPS page in a full browser; desktop, denied permissions and unavailable sensors still support clicking. Motion stays on the device. Returning to the background stops audio and sensors; re-enable them after returning.

Defaults: 60 BPM and ±150 ms, matching the PD patch. Each target beat scores once. A completed round reports hits, missed beats and offbeat strikes. **设置** controls the timing window, motion sensitivity, volume and optional reference beats. For lower latency, use the phone speaker or wired headphones; Bluetooth delay affects perceived timing.

```sh
npm start
npm test
```

Open http://127.0.0.1:4173 locally. Deploy the repository root with GitHub Pages (main branch, `/`). Phone motion requires HTTPS; a plain HTTP LAN preview does not provide it. Open `index.html` through a server, rather than a `file://` URL.

## Source

- `assignment3.pd`: original Pure Data patch.
- `example.wav`, `true.wav`, `false.wav`: original three audio samples, preserved without modification.
- `rhythm.mjs`, `motion.mjs`: timing judgement and movement peak detection.
- `audio.mjs`, `app.js`: Web Audio, permissions and UI.

The unfinished direction-based sound-selection mode in the original report is not part of this port. Motion triggering uses a rotation/acceleration peak with hysteresis and a 180 ms cooldown so it can work across phone orientations. Physical-device latency and gesture sensitivity vary; adjust sensitivity if needed.
