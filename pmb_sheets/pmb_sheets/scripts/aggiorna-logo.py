"""Mette nel programma i loghi ufficiali di pmb_sheets (../media/logo). Lo fa lo script comune, uguale per pmb_docs e pmb_sheets:
comune/scripts/aggiorna-logo.py (lì la spiegazione completa).

Uso, dalla cartella del progetto:  python scripts/aggiorna-logo.py
"""
import os
import runpy
import sys

COMUNE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'comune', 'scripts', 'aggiorna-logo.py')
sys.argv = [COMUNE, 'sheets']
runpy.run_path(COMUNE, run_name='__main__')
