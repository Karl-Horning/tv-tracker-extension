# TV Tracker

A Chrome extension for tracking TV shows. See when each show last aired and when it is next on, all in one place.

## Features

- **Status Board** — shows are grouped into four sections: Aired recently, Coming up, On hiatus, and No upcoming episode. A show can appear in more than one section at the same time.
- **Search** — search the TVmaze database to add shows by title.
- **Background refresh** — show data updates automatically every four hours.
- **Remove** — remove a show from your list at any time.

## Tech Stack

- **Language**: TypeScript
- **Build**: Vite
- **Testing**: Vitest, axe-core (automated accessibility)
- **Data**: [TVmaze public API](https://www.tvmaze.com/api)

## Installation

### From source

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

## Feedback and Issues

Found a bug or have a suggestion? [Open an issue](https://github.com/Karl-Horning/tv-tracker-extension/issues).

## License

Released under the [MIT License](./LICENSE) by [Karl Horning](https://github.com/Karl-Horning).
