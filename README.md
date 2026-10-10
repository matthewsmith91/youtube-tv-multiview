# TileTV

A Chrome extension that adds multiview to YouTube TV in the browser. Watch up to four streams in one tab and choose which ones you hear.

## Install

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Sign in at https://tv.youtube.com in a normal tab first.
4. Click the TileTV toolbar icon to open it.

After pulling changes, click the reload icon on TileTV in `chrome://extensions`, then reload the TileTV tab.

## Use

- **Layout:** 1, 2, 1+2, 2×2 or 1+3. Existing tiles keep playing when you change layout.
- **Pick a channel:** each tile is a full YouTube TV page. Browse the guide inside it, or paste a `tv.youtube.com/watch/...` link into the tile's bar and press Enter.
- **Audio:** 🔇/🔊 on a tile plays only that tile. Shift+click adds or removes it from the mix. The tiles you can hear have a green border.
- **Keys:** `1`–`4` (or `Alt+1`–`4` while a tile has focus) to switch audio, add Shift to mix, `M` to mute all, `F` for fullscreen.
- **Clean view:** hides everything in each tile except the video, including YouTube TV's controls and captions. Turn it off to change channels.
- **⤢ or double-click a tile's bar:** enlarge that tile. The others keep playing behind it.

Your layout, channels and audio choices are saved.

## How it works

| File | Role |
| --- | --- |
| `manifest.json` | Manifest V3 config. Only has access to `tv.youtube.com`. |
| `background.js` | Opens the TileTV page from the toolbar icon and cleans up its header rule when the tab closes. |
| `tiletv.html` / `.css` / `.js` | The grid page: layouts, tile bars, audio selection, saved state. |
| `content.js` | Runs in each tile. Mutes or unmutes the `<video>`, applies clean view, reports the tile's URL. |

YouTube TV normally refuses to load in a frame. `tiletv.js` adds a `declarativeNetRequest` session rule, limited to the TileTV tab, that removes the `X-Frame-Options` and `Content-Security-Policy` headers from tv.youtube.com frames in that tab only. The page and the tiles talk with `postMessage`, and each side checks the other's origin.

## Notes

- YouTube TV limits how many streams can play at once on your plan (usually 3). A fourth tile may show an error.
- TileTV is not affiliated with or endorsed by YouTube or Google.

## License

[MIT](LICENSE)
