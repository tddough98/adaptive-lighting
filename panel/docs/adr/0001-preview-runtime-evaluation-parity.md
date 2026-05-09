# Preview and Runtime Evaluation Must Match

The React Dashboard preview and Home Assistant runtime must evaluate the same Lighting Plan into the same Lighting State for the same time and sun context. This is stricter than accepting a visually similar preview, but it prevents users from saving a Lighting Plan whose actual Enhanced Mode behavior differs from what the dashboard showed. TypeScript and Python may keep separate implementations, but they need shared reference fixtures or equivalent tests to enforce parity.
