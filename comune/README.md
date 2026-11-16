# comune: codice condiviso da pmb_sheets e pmb_docs

Qui va il codice usato da entrambe le app della suite pmb_office (formati di file: CSV, ZIP, XML, ecc.). Dalle app si importa con `@comune/...` (alias definito in `tsconfig.json` e `vite.config.ts` di ogni app). Niente codice che dipenda da una sola delle due app.