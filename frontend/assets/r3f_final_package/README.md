# R3F Final Package

Hotovy prenosny balicek pro zobrazeni `final.glb` v `Vite + React + R3F`.

## Spusteni

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Struktura

- `public/assets/final.glb` - exportovany asset
- `src/scene/HeroScene.jsx` - hero kamera, svetla, postprocessing
- `src/App.jsx` - canvas wrapper

## Co uz je nastavene

- hero kamera pro ritualni interier
- area light rig
- jemny bloom a vignette
- temny background
- pripraveny import `final.glb`

## Integrace do jine slozky

Zkopiruj cely obsah `r3f_final_package/` do cilove slozky projektu a spust:

```bash
npm install
npm run dev
```
