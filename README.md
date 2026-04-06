# PhotoMover

A fast, minimal desktop app for importing and organizing photos from SD cards. Review every shot before it lands on your drive — tag, move, and delete in one pass.

![PhotoMover setup screen](docs/screenshots/setup.png)

---

## Features

- **Auto-detects SD cards** — plugging in a card surfaces it instantly as a source option
- **Visual review grid** — browse all photos as thumbnails before committing to anything
- **Tag-based workflow** — mark each photo as *Transfer*, *Delete*, or leave it untagged; filter the grid by any tag
- **Full-screen preview** — click any photo to open a lightbox with keyboard navigation
- **Move, don't copy** — source files are deleted after a successful transfer; identical duplicates at the destination are cleaned up too
- **Auto-organizes by date** — photos land in `Destination/YYYY/Month/filename.jpg`; files without EXIF go to `Unsorted/`
- **Collision-safe** — if a filename already exists it becomes `IMG_0001_1.jpg`, `IMG_0001_2.jpg`, etc.
- **Skips true duplicates** — identical files already at the destination are skipped automatically
- **Live transfer progress** — byte-level progress bar with current file name
- **Transfer summary** — transferred / skipped / error counts on completion
- **Persistent config** — source and destination paths are remembered between sessions

---

## Screenshots

| Setup | Review Grid | Transfer |
|-------|-------------|----------|
| ![Setup](docs/screenshots/setup.png) | ![Grid](docs/screenshots/grid.png) | ![Transfer](docs/screenshots/transfer.png) |

| Done |
|------|
| ![Done](docs/screenshots/done.png) |

---

## Folder Structure

Photos are organized automatically by the date taken from EXIF metadata:

```
Destination/
├── 2024/
│   ├── April/
│   │   ├── IMG_0001.jpg
│   │   └── IMG_0002.jpg
│   └── March/
│       └── DSC_0099.jpg
├── 2023/
│   └── December/
└── Unsorted/          ← photos with no EXIF date
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | [Electron](https://www.electronjs.org/) 31 |
| UI | [React](https://react.dev/) 18 + [TypeScript](https://www.typescriptlang.org/) 5 |
| Bundler | [electron-vite](https://electron-vite.org/) + Vite 5 |
| Styling | [Tailwind CSS](https://tailwindcss.com/) 3 |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| EXIF | [exifr](https://github.com/MikeKovarik/exifr) |
| Thumbnails | [Jimp](https://github.com/jimp-dev/jimp) |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- npm 9+

### Install

```bash
git clone git@github.com:alminisl/PhotoMover.git
cd PhotoMover
npm install
```

### Run in development

```bash
npm run dev
```

### Build for production

```bash
npm run package
```

The packaged installer will be output to `dist/`.

---

## Usage

1. **Insert your SD card** — PhotoMover detects it automatically and shows it as a source option. You can also browse to any folder manually.
2. **Pick a destination** — choose the folder where organized photos should land. Both paths are saved for next time.
3. **Load Photos** — scans the source and streams thumbnails into the review grid.
4. **Tag your shots:**
   - Hover a photo → click the **arrow** icon to mark it for transfer
   - Click the **trash** icon to mark it for deletion
   - Use **Tag all** in the action bar to mark everything at once
5. **Transfer** — hit the Transfer button; a progress bar tracks the operation file by file.
6. **Review the summary** — see how many files were transferred, skipped, or errored. Start a new import or go back to review more.

---

## License

MIT
