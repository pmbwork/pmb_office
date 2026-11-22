# agente-suite-office (copia)

Questa cartella contiene una **copia** dell'agente: l'originale, con le istruzioni complete, è in
`vault di lavoro di PMB, .claude/agenti/agente-suite-office/` (regole: `vault di lavoro di PMB, .claude/regole_progetti/regole_agente_suite_office.md`).
Non modificare qui `verifica.mjs` e `analizza-scancode.mjs`: si aggiornano dall'originale con `aggiorna-progetto.ps1`.

Di questo progetto è invece `registro-provenienza.json`: percorsi del progetto, licenze ammesse e vietate, file che possono contenere
avvisi altrui, origine di ogni file binario. Una voce si aggiunge solo dopo aver verificato origine e licenza.

Uso a mano, dalla cartella del progetto:  `node agente-suite-office/verifica.mjs [--rapporto rapporto.md] [--senza-rigenerare]`