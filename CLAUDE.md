# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview
This is a **client-side vanilla JavaScript web application** that generates custom LEGO brick mosaics from user-uploaded images. All processing happens in the browser - no image data is sent to any server, preserving privacy. The application creates downloadable PDF building instructions for physical LEGO mosaics using existing LEGO Art sets.

## Project Structure
```
/
├── index.html       - Main HTML page with UI (Bootstrap via CDN)
├── brickMosaic.js   - All application logic (1374 lines)
├── favicon.ico      - Site favicon
├── cf_about.png     - About/profile image
└── LICENSE          - MIT License
```

**All files are in the root directory - no subdirectories.**
This is a pure static application with **no build process**, **no package.json**, and **no dependencies** to install. All dependencies (Bootstrap, jsPDF) are loaded via CDN.

## Commands

### Run Locally
Since this is a static site, you can:
- Simply open `index.html` directly in a web browser
- Or serve with any static HTTP server:
  ```bash
  python -m http.server 8000
  # then visit http://localhost:8000
  ```
  ```bash
  npx serve .
  ```

### Build
No build step required - all files are already source-ready and served as-is.

### Tests
No test framework set up. Manual testing in browser is the current approach.

## Architecture

### Technology Stack
- **Language:** Vanilla JavaScript (ES6+)
- **Styling:** Bootstrap 5.0.0-beta2 (via CDN)
- **PDF Generation:** jsPDF 1.5.3 (via CDN)
- **Image Processing:** HTML5 Canvas API
- **Hosting:** GitHub Pages (static hosting)

### Key Architecture Points
- **100% client-side:** No backend, all computation happens in the user's browser
- **No frameworks:** Pure vanilla JS, no React/Vue/Angular
- **Privacy-focused:** User images never leave the browser

### Supported LEGO Art Sets
Configuration for 11 LEGO Art sets is **hardcoded in `getPartListOfOneSet()`** in `brickMosaic.js`:
1. The Beatles
2. Marilyn Monroe
3. Iron Man
4. The Sith
5. Hogwarts
6. Mickey Mouse
7. Personalized Portrait
8. World Map
9. Art Project
10. Elvis Presley
11. Batman

Each set includes: RGB color values, quantity available per set, brick type, and LEGO element ID.

### Core Algorithm

The mosaic generation uses a two-phase approach:

1. **Initial Assignment**
   - Resize input image to target mosaic dimensions
   - Add small random noise to break color ties
   - Calculate color distance (squared RGB distance) between each pixel and available brick colors
   - Greedily assign best available color to each pixel

2. **Refinement (Optimization)**
   - Iteratively tries swapping bricks between pixels to improve overall color matching
   - Continues until no more improvements can be made
   - Significantly improves final result quality

### Color Matching
- Default: Squared Euclidean distance in RGB space
- Optional: CIE LAB color space with DeltaE (perceptually uniform) available but currently commented out

### Main Functions in `brickMosaic.js`
- `init()` - Initializes UI state and event handlers
- `rgb2hsv()`, `hsv2rgb()`, `adjustImageHSV()`, `adjustImageContrast()` - Image preprocessing
- `rgb2lab()`, `lab2rgb()`, `deltaE()` - Color space conversions
- `getPartListOfOneSet()`, `updatePartList()` - LEGO set data management
- `generateValidColoring()` - Core two-phase mosaic generation algorithm
- `drawMosaic()` - Render preview on canvas
- `generateInstructions()`, `generatePDFTitlePage()`, `generatePDFSectionPage()` - PDF generation

### User Workflow
1. Upload source image (processed locally)
2. Adjust image (crop/scale, hue/saturation/value/contrast)
3. Select mosaic dimensions (width × height in studs)
4. Specify which LEGO Art sets are available (and how many of each)
5. Run algorithm to generate mosaic
6. Download PDF instructions with section-by-section building guide

## Code Guidelines

When modifying this codebase:
- Keep it vanilla JavaScript - no build tools or package dependencies
- Maintain the client-side-only / privacy-focused approach
- All dependencies must remain on CDN to keep deployment simple
- LEGO set configuration lives in `getPartListOfOneSet()`
