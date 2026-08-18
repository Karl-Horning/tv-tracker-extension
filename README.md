# TV Tracker

A Chrome extension for tracking TV shows. See when each show last aired and when it is next on.

## Features

- **Status Board** — shows are grouped into four sections: Aired recently, Coming up, On hiatus, and No upcoming episode. A show can appear in more than one section at the same time.
- **Search** — search the TVmaze database to add shows by title.
- **Background refresh** — show data updates automatically every four hours.
- **Sort** — order tracked shows by title or air date, ascending or descending.
- **Import and export** — back up your tracked shows to a JSON file, or restore them on another browser.
- **Remove** — remove a show from your list at any time, with a confirmation prompt first.
- **Light and dark mode** — switch anytime from Settings. Follows your system preference until you choose one explicitly.

## Tech stack

- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Vitest](https://vitest.dev/)
- [axe-core](https://github.com/dequelabs/axe-core) (automated accessibility testing)
- [TVmaze public API](https://www.tvmaze.com/api)

## Notable decisions

- **Imported shows always refetch fresh data** — a backup file only stores show IDs and names, not episode data. Restoring from it re-fetches each show from TVmaze rather than trusting a snapshot that may be out of date.
- **Storage writes are batched, not per-show** — `chrome.storage.local` reads and writes aren't atomic. Adding or refreshing several shows with one write per show raced and silently dropped entries under concurrent calls; everything now goes through a single read-modify-write per batch.
- **Delete uses the native confirm() dialogue** — simpler and just as accessible as a custom modal.
- **Every colour pair meets WCAG AA contrast minimums** — 4.5:1 for text, 3:1 for interactive boundaries like borders and buttons, in both the light and dark themes.
- **Dark mode is calibrated, not inverted from light mode** — background and text tones avoid the glare of a near-black/near-white pairing, the same principle already used in light mode.
- **Settings live in a native `<details>` menu** — fully keyboard-operable with Tab, Enter, and Escape.

## Local development

```bash
git clone https://github.com/Karl-Horning/tv-tracker-extension.git
cd tv-tracker-extension
npm install
npm run build
```

Then load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

## Scripts

| Command               | Description                       |
| --------------------- | --------------------------------- |
| `npm run build`       | Type-check and compile to `dist/` |
| `npm run dev`         | Start the Vite dev server         |
| `npm test`            | Run all tests once                |
| `npm run test:watch`  | Run tests in watch mode           |

## Feedback and issues

Found a bug or have a suggestion? [Open an issue](https://github.com/Karl-Horning/tv-tracker-extension/issues).

## License

Released under the [MIT License](./LICENSE) by [Karl Horning](https://github.com/Karl-Horning).
