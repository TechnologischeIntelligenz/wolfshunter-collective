# Arbeitsweise in diesem Projekt

- Aktuellen Stand zuerst in `docs/RELEASE-TRACKER.md` und `docs/HOSTING-CHECKPOINT-20260918.md` lesen. Die Release-Liste ist ein wachsender Zwischenstand; offene Funktionen bleiben sichtbar.
- Reihenfolge des Nutzers beachten: Dauerbetrieb/Verbindung, echte Funktionsabläufe, anschließend Veröffentlichung. Keine parallelen Produktbaustellen aufmachen. Fortschritt kurz und konkret auf Deutsch erklären.
- PowerShell-Dateien ausdrücklich mit `-Encoding UTF8` lesen und UTF-8 schreiben. Zugriffsfehler nicht mit Zeichenkodierungsfehlern verwechseln.
- Abhängigkeiten liegen in diesem Projekt unter `node_modules`. Shopify über `npm.cmd run shopify -- ...` oder `node node_modules/@shopify/cli/bin/run.js ...` starten; keine hartcodierten `_npx`-Cache-Pfade verwenden. Wrangler ebenfalls aus diesem Projekt ausführen.
- Der App-Server läuft dauerhaft auf Cloudflare, die Datenbank in Supabase. Lokale CLI-Prozesse sind keine Hosting-Abhängigkeit. `www.wolfshunter.com` bleibt der Shop.
- Datenbankabfragen begrenzen und Fortschritte dauerhaft speichern. Keine großen Datenplattformen oder bezahlten Ressourcen ohne konkreten Bedarf beziehungsweise bestehende Autorisierung hinzufügen.
- Testdaten und echte Shop-Daten unterscheiden. Die vorhandenen Löschtests betreffen App-Daten isolierter Test-Shops; sie löschen keinen Shopify-Shop.
- Secrets aus `.env*`, `.dev.vars*` und `_recovery` niemals ausgeben oder veröffentlichen. `shopify app info --json` kann Umgebungswerte enthalten und ist kein sicherer Statusbericht.
- Eine veröffentlichte Shopify-App-Version bedeutet keine öffentliche App-Store-Zulassung. Nur belegte Ergebnisse als erledigt markieren.
