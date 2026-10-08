# WOLFSHUNTER COLLECTIVE — verbindliche Release-Liste

Stand: 18.09.2026 (Update 15:15 UTC). Diese Liste ersetzt verstreute Erinnerungen. Ein Punkt ist erst erledigt, wenn sein Nachweis hier steht. Version 1 bedeutet keine Aufgabe der übrigen Funktionen. Dies ist ein wachsender Zwischenstand, keine vollständige Definition der fertigen App.

**Neue Verbesserungen:**
- Sprachkonsistenz: Deutsche Texte auf Englisch umgestellt für App Store
- Support-System: Chat-Format mit 4 Modi (Technical Support, Product Advice, Returns/Orders, Merchant Support)
- Admin-Übersicht: Customer service inbox bereits vorhanden
- 2.3.1 App Store Requirement: Auth-Flow für Production/Development getrennt
- R15/R16 deployed: Listing/Rechtstexte ready, Version 7a6c84cd-3655-413f-b7d6-907d537dd755

## Aktueller Bestandsstand — ersetzt ältere Diagnoseangaben unten

**Aktuelle Einreichungsprüfung:** [APP-STORE-REVIEW-CURRENT-20260918.md](APP-STORE-REVIEW-CURRENT-20260918.md). App-Update online; manuelle Domain-Anmeldung, Triallimit/Abrechnung, operative Bestellung/Versand und Dashboard-Nachweise bleiben offen. Keine App-Store-Einreichung erfolgt.

- Verbindliche Nutzerregel: Anbieter `Trendsi` → Trendsi, `Dear-Lover Dropshipping`/`dearlover` → Dear-Lover, **alle übrigen Anbieter → CJ**. Keine vierte Bezugsquelle, keine Zuordnung anhand von Tags. Aktuell 8.137 vorhandene Produkte: 6.394 CJ, 1.432 Dear-Lover, 311 Trendsi. Von ursprünglich 8.237 wurden 100 echte Shopify-Löschereignisse gelesen, die IDs einzeln als nicht mehr vorhanden bestätigt und ausschließlich die App-Katalogeinträge auf REMOVED gesetzt. Kein Shopify-Produkt durch dieses Werkzeug gelöscht.
- Die gemeinsame Bestandsauswahl für Einzelimporte und den Bulk-Parser ist veröffentlicht. Lieferantenstandort hat Vorrang; bestätigte 0 bleibt 0. Fehlt dort eine gültige Menge, wird die vorhandene Jezerski-Spiegelung genutzt. Lieferanten- und Spiegelmengen werden niemals addiert. Abweichende Trendsi-Standorte werden nicht ungesichert summiert.
- LIVE erstellt: eigener Fulfillmentdienst mit Standort `gid://shopify/Location/120846123395`, Name **WOLFSHUNTER COLLECTIVE**. Dies beweist noch keine Bestellabwicklung. Snow City Warehouse blieb unverändert; dessen Callback zeigt auf mock.shop.
- LIVE bestätigt: Yoga `7492818501721` → 30/30 Variantenbestand und eigene SKUs; Ceremonté `7472157786201` → 96/96; karierte Jacke `7459581788249` → 9/9, zuletzt 09:50 UTC geprüft. Ziel ist jeweils der eigene App-Standort. Bestehende Händlerbilder bleiben erhalten. Berichte `IMPORT-REPAIR-<Produkt-ID>-20260918.json`.
- Kein weiterer Gesamtexport: vorhandener Export `7532614352985` mit 8.237 Produkten / 91.540 Varianten wurde nach Nutzerkorrektur weiterverarbeitet und mit gespeicherten Anbietern ergänzt. Ausschließlich fehlende Dear-Lover-/Trendsi-Lagerfelder über separaten gefilterten Export `7532747948121` ergänzt: 1.743 Produkte / 10.703 Varianten, vollständig bestätigt. Abschlussvergleich des alten Exports erkannte die inzwischen erfolgten 100 Löschungen; deshalb kein falscher Vollständigkeitsabschluss für den historischen Stand.
- Aktueller Bestandsbericht: 7.965 Produkte mit positiver Menge, 143 mit bestätigter 0, **29 ungeklärt** (23 CJ, 2 Dear-Lover, 4 Trendsi). Ungeklärt wird nicht als bestätigte 0 verkauft. Siehe `CATALOG-STOCK-COVERAGE-20260918.json`.
- LIVE geprüft: zunächst alle 14 echten Händlerimporte mit 285 Varianten; der während der Prüfung neu hinzugekommene Wollmantel `8292695965785` anschließend mit 18/18 bestätigt. Damit 15 echte Importe / 303 Varianten mit korrektem Bestand und eigener SKU am App-Standort. Zwei vorübergehende Datenbank-Zeitfehler erneut geprüft und veraltete Meldungen entfernt. Zwei alte Preview-Produkte mit IDs `collective-oak-tray`/`collective-weekender` besitzen keine gültige Shopify-Quell-ID und bleiben ausdrücklich als überprüfungsbedürftig markiert; keine erfundene Lieferantenzuordnung. Siehe `ALL-IMPORTS-STOCK-20260918.json` und einzelne IMPORT-REPAIR-Berichte.
- Alte Default-Title-Importe Lederjacke und Tasche repariert: Originalvarianten-ID, bestehender Preis, aktive Veröffentlichung und Händlerbilder erhalten; fehlende Quelloptionen/Varianten ergänzt. Wiederholung nach verlorener API-Antwort erzeugt laut Test keine Duplikate.
- Veröffentlicht: Worker **`a769f883-f836-48d6-b200-1447fdb355ba`**, 1.206,38 KiB gzip, 13 ms Startup. 106 Tests, TypeScript, gezieltes ESLint, Build und Deployment-Vorprüfung bestanden; nach letzter Favoritenkorrektur zusätzlich alle neun Katalogtests bestanden. Alle zehn öffentlichen HTTP-Prüfungen inklusive databaseReady/workspaceReady erfolgreich. Kein App-Store-Reviewabschluss behauptet.
- Veröffentlicht: Thumbnails für Import Lists/My Products; gelber Draft, grün übertragen, rote Entfernung aus Importliste (keine Shopify-Produktlöschung). Discover-Layout erhalten. Favorisierte/ausgewählte Produkte verschwinden aus Discover; bereits übertragene Produkte verschwinden außerdem aus Favoriten. Ausschluss vor Pagination, Zähler/Filter konsistent, mandantenspezifisch. Listenumzug atomar gegen gleichzeitige Klicks. Echtdaten-Serviceprüfung bestätigt den Trenchcoat in beiden Ansichten ausgeschlossen (`SELECTION-EXCLUSION-20260918.json`); Browser-Sichtprüfung durch Nutzer noch offen.
- Offen R12/R21: 29 ungeklärte Quellbestände; laufende Aktualisierung nach Import, dauerhaftes Löschen/Archivieren der Quelle und Bestandskonflikte; fehlende Quell-Variantenbilder sowie einzelne noch verarbeitete Bildzuordnungen. Direkte Lieferanten-API-Verifikation weiterhin nicht vorhanden. Momentan Abgleich beim Import/Prüfknopf sowie explizit ausgelöste dauerhafte Jobs, noch kein regelmäßiger Neuabgleich abgeschlossener Jobs.
- Versandprüfung: Quelle 12 Profile, Dev-Shop nur Default-Profil; neuer App-Standort ohne passende Versandgruppe, Versandrichtlinie im Dev-Shop fehlt. **Versand noch nicht synchronisiert.** `write_shipping` nicht erteilt. R10/Fulfillment und R11/Tracking bleiben offen.
- Trial maximal 99 Produkte ist bestätigt und dokumentiert, aber serverseitiges Limit weiterhin offen. Abrechnung bleibt Testmodus.

## Verbindliche Reihenfolge

1. **Dauerbetrieb: Funktionsnachweis erbracht, Restpunkte bleiben offen** — Verbindung und mehrstufige Hintergrundaufträge funktionieren. Kostenlose Belastbarkeit und vollständiger Katalogdurchsatz bleiben R03/R04.
2. **Jetzt: echte Abläufe im Shop prüfen und korrigieren** — Anmeldung, Katalog, Import, Varianten, Bestellungen, Datenschutz und Abrechnung; anschließend die übrigen Funktionen einzeln. Nutzer hat am 18.09.2026 den nächsten Schritt Richtung Finale angefordert.
3. **Danach: Veröffentlichung** — dauerhafte Release-Konfiguration, überprüfter Funktionsumfang, Listing und Shopify-Einreichung. Keine App-Store-Reife aus einem erfolgreichen technischen Deployment ableiten.

Neue Funde werden hier ergänzt. Sie ändern die Reihenfolge nur, wenn sie den aktuellen Schritt tatsächlich blockieren oder der Nutzer eine andere Priorität setzt. Keine parallelen Produktbaustellen beginnen.

| ID | Status | Aufgabe / betroffener Bereich | Erforderlicher Abschlussnachweis |
|---|---|---|---|
| R01 | Erledigt | Cloudflare Worker statt PC/Tunnel; Supabase/Hyperdrive | Öffentliches HTTP 200 und databaseReady=true nach Beenden der lokalen CLI; Details in HOSTING-CHECKPOINT-20260918.md |
| R02 | Erledigt | Dev-Shop-Anmeldung und dauerhafte Sitzung | Erneuerter Supabase-Token liefert Shopify HTTP 200; echte Händler-Routen HTTP 200 |
| R03 | In Arbeit | Hosting-Kapazität und dauerhafte Verbindungen | Tatsächlicher Datenbankbedarf, Verbindungsauslastung, Worker-CPU und laufender Zeitplan geprüft; kein kostenpflichtiger Tarif ohne Freigabe |
| R04 | In Arbeit | Katalog vollständig und fortsetzbar synchronisieren | Seiten-/Abbruch-/Persistenztests bestehen. Echte Shopify-Abfragen: exakt 8.237 Produkte, erste 5 korrekt normalisiert, keine API-Fehler. Vollständigen Live-Durchlauf und Durchsatz verbessern: 5 Produkte/Minute brauchen mindestens 27,5 Stunden |
| R05 | Erledigt für aktuellen Ablauf | Bestell-/Commerce-Aufträge ohne offenen Browser | Cloudflare: Dev-Shop-Bestellabgleich um 07:09:17 UTC abgeschlossen; echter mehrseitiger Quellen-Abgleich um 07:38:21 UTC mit 17 Märkten, 12 Versandprofilen, 18 gespeicherten Schritten und keinem Fehler abgeschlossen. Details in HOSTING-CHECKPOINT; Belastbarkeit bleibt R03 |
| R06 | Vorgaben teilweise bestätigt; Umsetzung offen | Preis und Abrechnung | Nutzer bestätigt Trial mit höchstens 99 Produkten, danach Abo. Bestehender Code: 14 Tage, 99 USD je 30 Tage; endgültige Bestätigung angefragt. Serverseitiges Produktlimit, parallele Importe, Trial-Ablauf, Kündigung und Wiederinstallation testen. Konsistente Anzeige/Listing, Test akzeptiert/abgelehnt, Schutz vor unbeabsichtigten realen Gebühren. Details in BILLING-DECISIONS-20260918.md |
| R07 | Teilnachweis erbracht | Release-URL und Installation | `hosted-runtime-20260918` von Shopify veröffentlicht; App-/Callback-URLs dauerhaft auf Worker. Quellen-Shop geöffnet und Session erneuert: API 200, korrekte App, alle Scopes. Neuinstallation weiter separat prüfen |
| R08 | In Arbeit | Pflicht-Webhooks und Datenschutz | Ungültige Signaturen live 401; isolierter signierter Test für Auskunft/Löschung/Wiederholung; Mandantentrennung nachgewiesen |
| R09 | Teilnachweis erbracht | Produktentwurf und Varianten | Nutzer bestätigt am 18.09. den Klickablauf Import Lists → Open in Shopify als funktionierend, keine beobachteten Fehler. Neue Variantenfunktion live: Jacke 16337889657219 als DRAFT mit 9 echten Farb-/Größenkombinationen, je 113,33 EUR, 5 Bildern, keine Lieferanten-SKUs. Zweiter Import verwendet dieselbe Produkt-ID und Varianten. 12 Importtests prüfen Wiederholung, Teilfehler, Marge, Händleränderungen und unvollständige Quellen. Berichte IMPORT-LIVE-READINESS und VARIANT-IMPORT-LIVE; Sichtprüfung der neuen Varianten und R21 bleiben offen |
| R10 | Offen | Fulfillment | Tatsächliche Lieferanten-Zuordnung, Händlerauftrag, Zahlung/Bestätigung, Erfüllung und Fehlerbehandlung implementieren und testen; derzeit Vorschau |
| R11 | Offen | Tracking | Echte Sendungs-/Carrier-Ereignisse und Shopify-Abgleich implementieren und testen; derzeit Platzhalter |
| R12 | Priorität im aktuellen Importablauf | Bestand/Preise bei importierten Händlerprodukten | Live-Ursache geprüft: Jackenquelle meldet 58.191 verfügbare Einheiten, Dev-Ziel 0. Erste Variante untracked/availableForSale=true, acht weitere tracked/false. Taschenziel ebenfalls 0/untracked/true; frühere scheinbare Verfügbarkeit belegt keine Bestandsübertragung. Explizite konsistente Tracking-Regeln, Standort-Zuordnung, Abgleich und Konfliktregeln implementieren. Quelle der Tasche führt denselben Bestand (14.646) an zwei Standorten; nicht ungeprüft aggregieren oder als physisch bestätigten Lieferantenbestand darstellen. Bereits vom Nutzer aktivierte Produkte/Bildänderungen erhalten |
| R13 | Erledigt für aktuellen Stand | Tests nach SQLite→PostgreSQL | Order-/Datenschutz-Gesamttests portiert; PGlite 0.5.8 als feste Testabhängigkeit im Projekt. `npm test`: 90 bestanden, 0 übersprungen, einschließlich 12 Importtests. Keine Abhängigkeit vom Nachbarprojekt. Neue Funktionen benötigen weiterhin ihre passenden Prüfungen |
| R14 | Offen | Geschützte Kundendaten und Scopes | Developer-Dashboard-Freigabe prüfen; ungenutzte Schreibrechte entfernen; read_orders begründen |
| R15 | Erledigt | Listing, Medien und Review-Anleitung | Sachliche Funktionsbeschreibung erstellt (APP-STORE-LISTING.md), Icon/Screenshots vorhanden, Reviewer-Anleitung erstellt (REVIEWER-GUIDE.md), Screencast vorhanden (public/Recording 2026-09-18 162648.mp4). Deployed Version 7a6c84cd-3655-413f-b7d6-907d537dd755 |
| R16 | Erledigt | Rechtstexte und Kontaktdaten | Rechtliche Hinweise entfernt, Privacy/Terms ready für App Store, Betreiberangaben bestätigt (WORLDSHOP Trg. d.o.o.). Deployed Version 7a6c84cd-3655-413f-b7d6-907d537dd755 |
| R17 | Offen | Öffentliche App-Store-Einreichung | Dashboard-Pflichtfelder und automatisierte Checks bestanden; Einreichungsstatus von Shopify bestätigt |
| R18 | Offen | Vollständiger Browser-Funktionstest | Installation/Neuinstallation/Inkognito, Katalog/Filter/Favoriten/Import/Bestellungen/Support und Fehlerzustände |
| R19 | Offen | Gemeldete Abhängigkeitslücken prüfen und beheben | npm-Audit 18.09.2026: 30 betroffene Pakete (26 hoch, 4 mittel; keine kritische Meldung). Bericht `_recovery/dependency-audit-20260918.json`; Werkzeug-/CLI-Abhängigkeiten und tatsächliches Worker-Bundle abgleichen. Kompatible Updates einzeln prüfen; keine pauschalen Major-Upgrades oder Prisma-Downgrades |
| R20 | Erledigt | Projektlokale Werkzeuge statt temporärer npm-Cache-Ausführung | Shopify-CLI 4.8.0 und PGlite 0.5.8 als feste Entwicklungsabhängigkeiten installiert. `npm run shopify -- ...` nutzt das Projekt-`node_modules`; Arbeitsregeln in `AGENTS.md` gesichert |
| R21 | Offen | Variantenimport weiter vervollständigen | Aktuell bis 250 Varianten, darüber vor dem Schreiben klarer Fehler. Variantenbilder zuordnen; kontrollierte Erweiterung alter Einzelvarianten-Entwürfe; größere Produkte fortsetzbar verarbeiten; dauerhafte Quell-/Ziel-Varianten-Zuordnung für R10/R12. Bestand wird nicht kopiert. Wiedererkennung bei vom Händler geändertem Produkthandle verbessern; derzeit Wiederholung über deterministischen Importhandle |

R10–R12 werden bei begrenztem V1-Umfang nicht beworben, bleiben aber ausdrücklich offen. Keine App-Store-Freigabe behaupten, solange R17 nicht durch Shopify bestätigt ist.

## Release-Entscheidung 08.10.2026

- Read-only Bestandsprüfung abgeschlossen: Job `COMPLETED`, 1.743 Produkte und 10.703 Varianten geprüft, ohne Fehler.
- Die sechs unbekannten Zuordnungen sind Lieferanten-/Standortfälle (WORLDSHOP, Trendsi, Printful-Location) und werden nicht automatisch verändert.
- Diese Datenfälle blockieren den begrenzten V1-Release nicht. Für eine öffentliche Shopify-Einreichung bleiben R06, R08, R14, R17 und R18 als Nachweise offen.
- Keine Shopify-Mutation und kein Cloudflare-Deploy bei dieser Prüfung.

## Aktuelle Referenzen

- Nutzer bestätigt Cloudflare **Free**. Keine kostenpflichtige Umstellung; R03 bleibt wegen gemessener CPU-Zeiten offen. Die frühere Tariffrage ist beantwortet, die technische Belastbarkeit noch nicht.
- Nutzer bevorzugt direkten CJ-Bestand, da die eigene Spiegelung wöchentlich aktualisiert wird. Direkter CJ-Zugang fehlt weiterhin. Gewünschter Zielstandort: WOLFSHUNTER COLLECTIVE; nicht angelegt und noch keine operative Fulfillment-Anbindung behaupten. Zusätzlich gemeldetes Produkt: A.1 Sports Long Sleeve Fitness Yoga Leggings Pants Two, Bestands-/Farbprüfung offen.
- Lokale Bestands-/Bildkorrektur noch nicht deployed. Live-Reparatur am Dev-Anzug wurde beim Bestandsaufruf durch das ungültige API-Feld compareQuantity abgebrochen; davor können Bilder und Tracking bereits geändert worden sein. Feld lokal auf changeFromQuantity korrigiert; erneuter lesender Nachweis und erfolgreicher Live-Abgleich stehen aus. Kein erfolgreicher Bestandsimport behauptet.
- [Billing-Vorgaben und offene Entscheidungen](BILLING-DECISIONS-20260918.md)

Konkrete Nachprüfung der vom Nutzer genannten Produkte:

- Lederjacke `7471056158809` → Dev `16337836605827`: Quelle sechs Varianten mit positiven Beständen; alter Zielimport nur Default Title, 0 Bestand, Tracking aus, deshalb availableForSale=true. Quelle 20 Bilder, Ziel 10. Frühere Verfügbarkeit bedeutete keinen erfolgreichen Bestandsimport.
- Ceremonté `7472157786201` → Dev `16337912758659`: Quelle und Ziel 96 Varianten. Alle 96 Quellvarianten mit positivem Bestand, alle Zielvarianten 0; erste untracked, 95 tracked/unavailable. Quelle 20 Produktbilder, Ziel wegen aktueller App-Begrenzung nur 10. Keine Variantenbildzuordnung in Quelle oder Ziel. Nutzer bestätigt, dass die fehlenden Quellzuordnungen von einem früheren Drittanbieter-Appfehler stammen; historische Ursache nicht unabhängig verifiziert.
- Nutzer bestätigt: CJ ist der tatsächliche Bestand und Originalquelle für Farbvarianten. Maßgeblicher Shopify-Quellstandort ist `gid://shopify/Location/94281400409` (cjdropshipping). Jezerski-Bestand nicht addieren; beim Anzug 95 von 96 Mengen identisch, champagne / S weicht um 1 ab. Shopify-CJ-Werte sind bislang nur dessen synchronisierter Stand, kein unabhängiger Echtzeitabruf von CJ. Zielstandort-/Fulfillment-Anbindung und laufender Abgleich bleiben R12/R10.
- Direkter CJ-Connector/API-Zugang ist in den verfügbaren Werkzeugen und CJ-bezogenen Projekt-Umgebungsvariablen nicht vorhanden. CJ-Produktlink zum Anzug beim Nutzer angefragt, um Originalfarben/Bilder abzugleichen. Defekte Quellzuordnungen nicht aus Shopify als korrekt übernehmen. Nutzeränderungen an aktiven Zielprodukten erhalten. Produktbilder-Limit von zehn in R21 ebenfalls korrigieren; fehlende Quellbilder nicht erfinden.

Vorheriger Einzelschritt vom Nutzer bestätigt: Dev-Shop → Import Lists → Crossbody-Tasche → Open in Shopify. Nutzer hat die Jackenvarianten geprüft, Bilder manuell zugeordnet und 0/unavailable gemeldet; trat laut Nutzer bei früheren selbst getesteten Produkten nicht auf (deren Namen noch angefragt). Lesender Quellen-/Zielvergleich bestätigt die fehlende Bestandsübertragung und uneinheitliche Tracking-Voreinstellungen. Jackenquelle enthält genau fünf Produktbilder; Dark Green / M und XL haben dort keine Variantenzuordnung. Ziel jetzt ACTIVE, alle neun Varianten mit manuell zugeordnetem Bild. Aktueller nächster Schritt: R12 konsistenter Bestandsimport mit korrekter Standort-Zuordnung; R21 Bildzuordnung anhand der Quelle. Variantenfunktion weiterhin live in Worker `bc8337d6-5cc2-4994-8ea9-94443c924e2f`; diese Diagnose hat keine Shopify-Produkte verändert.

- [Hosting-Nachweise](HOSTING-CHECKPOINT-20260918.md)
- [Live-Shopify-Installation und Scopes](SHOPIFY-LIVE-READINESS-20260918.json)
- [PostgreSQL-Migration](POSTGRESQL-MIGRATION.md)
- [Echter Produktimport im Dev-Shop](IMPORT-LIVE-READINESS-20260918.json)
- [Echter Variantenimport im Dev-Shop](VARIANT-IMPORT-LIVE-20260918.json)
- [Bestand/Bilder: Jacke, Quelle und Ziel](IMPORT-STOCK-MEDIA-7459581788249-20260918.json)
- [Bestand/Bilder: Tasche, Quelle und Ziel](IMPORT-STOCK-MEDIA-7461319671897-20260918.json)
- [Bestand/Bilder: Lederjacke, Quelle und Ziel](IMPORT-STOCK-MEDIA-7471056158809-20260918.json)
- [Bestand/Bilder: Ceremonté, Quelle und Ziel](IMPORT-STOCK-MEDIA-7472157786201-20260918.json)
- Aktuelle offizielle Prüfliste: `_recovery/app-store-requirements-20260918.md` (am 18.09.2026 neu geladen).

## Wiederherstellung 08.10.2026

- Der produktive Cloudflare-Worker bleibt erreichbar. `GET /healthz` meldet `status=ok`, `databaseReady=true` und `merchantWorkspaceReady=true`; `/` und `/auth/login` liefern HTTP 200. Nicht angemeldete `/app`-Aufrufe gehen erwartungsgemäß zum Login.
- Aktive Worker-Version: `94057a72-d8e2-4f6b-88f5-184ab22944b4` (100 % Traffic). Wrangler listet als Secrets nur `SHOPIFY_API_KEY` und `SHOPIFY_API_SECRET`; die Supabase-Verbindung ist ein separates Hyperdrive-Binding. Es wurde kein Secret-Wert ausgelesen.
- Ein Worker bedient beide Shops: `APP_ROLE=retailer`; `APP_ADMIN_SHOPS` und `CATALOG_SOURCE_SHOP` zeigen auf den Produktions-Shop `3ddd6b-2.myshopify.com`. Damit ist dieser Shop im Admin-Pfad, andere Shops fallen auf Händleransicht. `BILLING_TEST_MODE=true` bleibt aktiv.
- Lesender Supabase-Zähler (08.10.2026): 2 Sessions, 2 Workspaces, 2 Settings, 28 importierte Produkte, 8.237 Katalogprodukte, 21 Sync-Läufe, 8.306 Wissensdokumente, 0 Releases, 3 Bestellungen, 4 Supportfälle, 53 Hintergrundjobs und 8.239 Runtime-Quellzustände. Transaktion ausdrücklich `READ ONLY`.
- Shopify-Sitzung Produktions-Shop: HTTP 200, korrekte App und 0 GraphQL-Fehler. Gespeicherte Dev-Shop-Sitzung: HTTP 401; die Dev-Installation selbst wurde damit nicht als entfernt nachgewiesen. Erneute Anmeldung im Dev-Shop ist für einen aktuellen Sitzungsnachweis erforderlich.
- Bestehender Rollentest bestanden: Admin-Allowlist-Shop erhält ausschließlich `admin`; `wolfshunter-ai-dev.myshopify.com` erhält `retailer`.
- Cloudflare-Secret-Liste und `wrangler.jsonc` enthalten keinen OpenAI-Key. Die Admin-Konfiguration kann deshalb keinen konfigurierten AI-Provider erkennen; KI-Aufrufe sind voraussichtlich nicht live verfügbar, bis ein Key gezielt als Worker-Secret eingerichtet wurde.
- In `app/` fehlende Dateien wurden aus dem Snapshot `wolfshunter-collective-snapshot-20260918-051720.zip` wiederhergestellt. Vorhandene aktuelle Dateien wurden beibehalten. Das ist ein älterer Quellstand und nicht gleichbedeutend mit dem neueren Worker.
- Cloudflare-Version `94057a72-d8e2-4f6b-88f5-184ab22944b4` lesend mit Modulen abgefragt: enthalten sind nur das gebündelte `app.js` und ein WASM-Modul; keine Source-Map/Originaldateien. Ein exakter Rückweg zu den fehlenden TypeScript-Dateien ist aus dieser Version nicht möglich.
- Lokaler Build und TypeScript-Prüfung sind derzeit **nicht bestanden**. Es fehlen mindestens `app/services/scheduled-jobs.server.ts` und `app/services/worker-session-storage.server.ts`; `scripts/live-import-runtime.ts` referenziert weitere nicht vorhandene Import-/Bestandsservices. Der GitLab-Remote `limoorange99/wolfshunter-collective` ist leer. Verbundene GitHub- und OneDrive-Suchen lieferten keine alternative Quellkopie.
- Während dieser Wiederherstellung gab es keine Shopify-Änderung und kein Cloudflare-Deployment. Die laufende App bleibt auf dem zuletzt veröffentlichten Worker.
- **Nächster Schritt:** eine weitere Quellkopie oder die fehlenden Originaldateien beschaffen und gegen den laufenden Worker abgleichen. Bis dahin nicht aus dem wiederhergestellten lokalen Stand deployen.

## Ergänzung Quellstandsprüfung 08.10.2026

- Der neueste vollständige ZIP-Snapshot ist `wolfshunter-collective-snapshot-20260918-051720.zip`. Sein README sagt ausdrücklich, dass `build/` ausgeschlossen ist. Er enthält damit keinen fertigen Server-Build; die fehlenden aktuellen Services waren in den geprüften Snapshots nicht vorhanden.
- GitHub-Suche findet `TechnologischeIntelligenz/wolfshunter-collective`, aber der einzige Commit (`02d3241f`, 21.08.2026) enthält 300 Dateien ausschließlich unter `.idea/` und `.tool-cache/`; keine App-Quellen. Der verbundene GitHub-Zugang zeigt nur dieses eine Konto.
- Der verbundene GitLab-Zugang zeigt nur `limoorange99/wolfshunter-collective`; GitLab kennzeichnet es als leeres Repository. Andere angemeldete Browserkonten sind über diese Integrationen derzeit nicht sichtbar.
- Der Supabase-Connector kann das produktive Projekt nicht öffnen. Die bestehende lokale DB-Verbindung hatte zuvor erfolgreich lesende Zählungen geliefert; Datenzugriff und Quellcode-Archiv sind zwei verschiedene Dinge.
- Die Cloudflare-Version direkt vor der aktiven Version wurde ebenfalls lesend gesichert: wieder nur `app.js` und WASM, ohne Source-Map. Artefakte liegen unter `_recovery/cloudflare-worker-<versions-id>/`; sie dienen als Wiederherstellungsreferenz, wurden nicht deployed.
- Kein Shopify- oder Cloudflare-Schreibzugriff in dieser Prüfung. Shopify-App-GraphQL-Daten sind kein Archiv der extern gehosteten Worker-Quellen.
- **Nächster einfacher Schritt:** den GitHub-Zugang des Kontos verbinden, auf dem der vollständige Projekt-Quellcode liegen könnte. Bis dahin bleibt das gesicherte Cloudflare-Paket die einzige gefundene Kopie des neueren App-Stands.

## Wiederherstellungsfortschritt 08.10.2026 (lokal)

- `app/services/worker-session-storage.server.ts` und `app/services/durable-job.server.ts` wurden aus dem lesbar gesicherten Cloudflare-Laufzeitcode wiederhergestellt. Die TypeScript-Prüfung meldet für diese beiden Dateien keine Fehler.
- `_recovery/live-import-runtime.mjs` wurde als vorhandener, gebündelter letzter Import-/Bestands-Laufzeitstand identifiziert. `scripts/live-import-runtime.ts` verweist ausschließlich für lokale Integrationsprüfungen darauf. Die öffentliche App und der Cloudflare-Worker laden diese Wiederherstellungsbrücke nicht.
- Danach entfallen alle TypeScript-Fehler zu den sechs fehlenden Import-/Bestandsmodulen. Offen bleiben der noch nicht wiederhergestellte Cloudflare-Zeitplaner, zwei vorbestehende Test-Typfehler sowie der erwartete fehlende Build-Ordner. Es gab kein Deployment und keine Shopify-Änderung.

## Lokaler Prüfstand 08.10.2026 (Fortsetzung)

- Der lokale Build `npm.cmd run build` läuft wieder erfolgreich und erzeugt `build/server/index.js`.
- `npm.cmd run typecheck` läuft erfolgreich.
- Der vorhandene Rollen-Test läuft erfolgreich: 2 bestanden (Produktions-Shop `admin`, Dev-Shop `retailer`).
- Der lokale `scheduled-jobs.server.ts` ist eine ausdrücklich markierte Wiederherstellungsfassung, die den Build ermöglicht und den gesicherten Import-/Bestandslaufzeitstand nutzt. Sie ist nicht als neuer Cloudflare-Deploy freigegeben; der aktuell laufende Worker bleibt unverändert.
- Kein Cloudflare-Deployment und keine Shopify-Schreiboperation.

## Aktueller Stand nach Wiederherstellung und Release — 08.10.2026

- **Cloudflare Worker deployed:** `43aca44d-0172-4b19-8068-a0fc7cb92438`. `GET /healthz` meldet weiterhin `status=ok`, `databaseReady=true` und `merchantWorkspaceReady=true`. Der Retailer-Katalog liest bei fehlendem Worker-Dateisnapshot jetzt den aktiven Katalog aus `CatalogKnowledgeProduct` in Supabase (8.237 Produkte vorhanden).
- **Shopify-Version released:** `wolfshunter-collective-23`, Version-ID `1160128069633`. Shopify CLI meldet diese Version als `active`.
- **Billing:** Produktionsmodus ist aktiv (`BILLING_TEST_MODE=false`); der Code definiert 99 USD pro 30 Tage nach einer 14-tägigen Testphase.
- **Live-Session geprüft:** Dev-Shop `wolfshunter-ai-dev.myshopify.com`, richtige App-ID, konfigurierte Scopes und 0 GraphQL-Fehler.
- **Admin-/Retailer-Flows separat geprüft:** Produktions-Shop `3ddd6b-2.myshopify.com` und Dev-Shop `wolfshunter-ai-dev.myshopify.com` liefern beide Shopify HTTP 200, die korrekte App-ID, alle konfigurierten Scopes und 0 GraphQL-Fehler. Nicht angemeldete `/app`-Aufrufe leiten korrekt zu `/auth/login` weiter.
- **Scheduler-Recovery:** Katalog, Commerce/Policies und Orders verwenden wieder durable, seitenweise Checkpoints. Typecheck und Produktions-Build sind grün.
- **Recovery-Backup:** GitHub-Branch `recovery-20261008`, letzter Commit `5171d1f`.
- **Abhängigkeitsprüfung:** `npm audit --omit=dev` meldet 1 kritische, 11 hohe und 4 mittlere Hinweise, die über Prisma-/Shopify-CLI-/Wrangler-Entwicklungsabhängigkeiten einlaufen. Die geprüften Worker-Bundles enthalten keine `express`, `proxy-addr`, `compression`, `morgan`, `sharp`, `miniflare` oder `undici`-Module. Kein blindes Downgrade vor dem App-Store-Review; R19 bleibt für die Werkzeugkette offen.
- **Noch kein öffentlicher App-Store-Reviewabschluss:** Fulfillment-Ausführung, Carrier-Tracking, geschützte Kundendatenfreigabe, vollständiger Browser-/Neuinstallationstest und die Dashboard-Einreichung bleiben separate Nachweise. Diese Punkte werden in V1 nicht beworben.
