# RadOnc DoseCheck

A lightweight checklist app to verify radiotherapy plan constraints (education/research use).

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Deploy
- Vercel: import repo, Framework = Vite (auto), build = `npm run build`, output = `dist/`
- Netlify: drag `dist/` after running `npm run build`
- GitHub Pages: follow Vite static deploy guide
