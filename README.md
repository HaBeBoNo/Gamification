# Gamification

A Vite + React + Tailwind CSS v4 application.

## How Tailwind is wired

Tailwind CSS is loaded via `src/styles/globals.css`, which starts with `@import "tailwindcss";`. This file is imported directly from the JS entrypoint `src/main.jsx`. The Vite plugin `@tailwindcss/vite` handles CSS processing.

## Run locally

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.