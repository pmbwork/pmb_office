#!/bin/bash
# Suite pmb_office per Mac: un solo pacchetto .pkg che installa pmb_docs e pmb_sheets in Applicazioni, con una casella per programma
# (come la suite di Windows, suite/pmb_office-suite.nsi). Gira solo su un Mac: la lancia il workflow build-mac di GitHub.
# Uso:  crea-suite-mac.sh <pmb_docs.app> <pmb_sheets.app> <cartella di uscita>
# Il pacchetto non è firmato: al primo avvio il Mac chiede conferma (tasto destro sul file > Apri).
set -euo pipefail
DOCS_APP="$1"; SHEETS_APP="$2"; USCITA="$3"
QUI="$(cd "$(dirname "$0")" && pwd)"
LAVORO="$(mktemp -d)"
trap 'rm -rf "$LAVORO"' EXIT

versione_di() { /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$1/Contents/Info.plist"; }
V_DOCS="$(versione_di "$DOCS_APP")"; V_SHEETS="$(versione_di "$SHEETS_APP")"
# la versione della suite è la data, come su Windows (AAAA.M.G)
# (oppure quella data dal workflow, per esempio 2026.11.14.2 per un secondo rilascio nello stesso giorno)
V_SUITE="${VERSIONE_SUITE:-$(date +%Y).$(date +%-m).$(date +%-d)}"
[[ "$V_SUITE" =~ ^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || { echo "Versione della suite non valida: $V_SUITE"; exit 1; }

# un pacchetto per programma; non "spostabile": va sempre in /Applications, anche se il Mac ha una copia del programma altrove
componente() { # <app> <identificativo> <versione> <uscita.pkg>
  local radice="$LAVORO/radice-$2"; mkdir -p "$radice"
  ditto "$1" "$radice/$(basename "$1")"
  pkgbuild --analyze --root "$radice" "$LAVORO/$2.plist" >/dev/null
  /usr/libexec/PlistBuddy -c 'Set :0:BundleIsRelocatable false' "$LAVORO/$2.plist"
  pkgbuild --root "$radice" --component-plist "$LAVORO/$2.plist" --install-location /Applications --identifier "$2" --version "$3" "$4"
}
componente "$DOCS_APP" com.pmb.docs.pkg "$V_DOCS" "$LAVORO/pmb_docs.pkg"
componente "$SHEETS_APP" com.pmb.sheets.pkg "$V_SHEETS" "$LAVORO/pmb_sheets.pkg"

# testi dell'installazione: benvenuto e licenza (GPL-3.0)
mkdir -p "$LAVORO/risorse"
sed -e "s/@V_DOCS@/$V_DOCS/g" -e "s/@V_SHEETS@/$V_SHEETS/g" -e "s/@V_SUITE@/$V_SUITE/g" "$QUI/benvenuto.html" > "$LAVORO/risorse/benvenuto.html"
# il logo ufficiale di pmb_office, sullo sfondo dell'installazione
cp "$QUI/../../media/logo/Logo PMB Office (512x512).png" "$LAVORO/risorse/logo.png"
# la licenza: nel repository è nella radice, nel vault in repo-github/
if [ -f "$QUI/../../LICENSE" ]; then cp "$QUI/../../LICENSE" "$LAVORO/risorse/LICENSE.txt"; else cp "$QUI/../../repo-github/LICENSE" "$LAVORO/risorse/LICENSE.txt"; fi
sed -e "s/@V_DOCS@/$V_DOCS/g" -e "s/@V_SHEETS@/$V_SHEETS/g" -e "s/@V_SUITE@/$V_SUITE/g" "$QUI/distribution.xml" > "$LAVORO/distribution.xml"

mkdir -p "$USCITA"
NOME="pmb_office_${V_SUITE}_universal.pkg"
productbuild --distribution "$LAVORO/distribution.xml" --resources "$LAVORO/risorse" --package-path "$LAVORO" "$USCITA/$NOME"

# che cosa c'è dentro (come CONTENUTO.txt della suite di Windows)
{
  echo "pmb_office $V_SUITE per Mac (Apple Silicon e Intel)"
  echo "pmb_docs $V_DOCS"
  echo "pmb_sheets $V_SHEETS"
  echo "SHA-256 $(shasum -a 256 "$USCITA/$NOME" | cut -d' ' -f1)  $NOME"
} > "$USCITA/CONTENUTO.txt"
pkgutil --check-signature "$USCITA/$NOME" || true   # non firmato: lo dice e basta
pkgutil --payload-files "$USCITA/$NOME" | grep -E '\.app/Contents/Info.plist$' || true
cat "$USCITA/CONTENUTO.txt"
