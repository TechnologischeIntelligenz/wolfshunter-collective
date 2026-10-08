# Aktuelle Shopify-App-Store-Prüfung — 18.09.2026

**Ergebnis: App-Update online; öffentliche Einreichung noch nicht fertig vorbereitet. Keine Einreichung ausgelöst.**

Geprüfter Worker: `a769f883-f836-48d6-b200-1447fdb355ba`. Die offizielle Prüfliste wurde erneut live heruntergeladen: `_recovery/app-store-review-current.txt`. Frühere Berichte waren nicht die Quelle der Anforderungen.

## Zusammenfassung

- ✅ Wahrscheinlich erfüllt: **25**
- ❌ Wahrscheinlich nicht erfüllt: **1**
- ⚠️ Weitere Prüfung nötig: **5**
- ⏭️ Übersprungene Gruppen: **10**

Diese 31 allgemeinen Anforderungen sind Shopifys Auswahl für lokale Codeprüfungen. Weitere Anforderungen, die tatsächliche App-Kategorie, Dashboard-Checks und die offizielle Shopify-Prüfung bleiben zusätzlich relevant. Die Anzahl positiver Codebefunde bedeutet keine Freigabe.

## Anforderungen mit Prüfbedarf

### 1.1.1 — Session-Token-Authentifizierung

**Befund:** Shopify-SDK, App Bridge und serverseitige Sitzungen sind vorhanden. localStorage betrifft nur das Schließen des Support-Popups.

**Offen:** Vollständige Neuinstallation im Inkognito-Modus mit blockierten Drittanbieter-Cookies.

### 1.1.4 — Sachlich zutreffende Angaben

**Befund:** Katalog und Bestand verwenden reale Daten; ungeklärte Mengen sind gekennzeichnet. Fulfillment ist als Vorschau markiert. Nutzungsbedingungen beschreiben noch eine App-Store-Version ohne Bestellfunktionen, obwohl Bestellabgleich implementiert ist.

**Offen:** Listing, Texte und tatsächlich freigegebener Leistungsumfang müssen übereinstimmen. Listing nicht eingesehen.

### 1.2.2 — Korrekte Shopify-Abrechnung

**Befund:** `billing.check`/`billing.request` existieren; Worker fest auf `BILLING_TEST_MODE=true`. Angezeigt werden 14 Tage und 99 EUR je 30 Tage. Das bestätigte Limit von 99 Trial-Produkten wird noch nicht serverseitig durchgesetzt.

**Offen:** Endgültiger Preis/Trialdauer, Zustimmung, Ablehnung, Kündigung und Wiederinstallation testen. Keine echten Gebühren aktivieren, bevor diese Punkte geklärt sind.

### 2.3.3 — App-Aufruf nach Installation

**Befund:** SDK-Callback und permanente URLs bestehen; bestehende Shops können die App öffnen.

**Offen:** Durchgängiger neuer Installationslauf bis in die Händleroberfläche.

### 2.3.4 — Authentifizierung nach Wiederinstallation

**Befund:** SDK und PrismaSessionStorage unterstützen erneuerte Sitzungen.

**Offen:** Tatsächliche Deinstallation/Wiederinstallation mit erneuertem Token und korrektem Abonnementstatus.

## Wahrscheinlich nicht erfüllte Anforderung

### 2.3.1 — Installation auf einer Shopify-Oberfläche beginnen

**Befund:** `app/routes/auth.login/route.tsx` zeigt auch im Produktionsbuild ein Formular zur manuellen Shop-Domain-Eingabe.

**Bedeutung:** Das widerspricht der aktuellen Anforderung an den Installations-/Konfigurationsablauf. Öffentlichen Einstieg über Shopify führen und vorhandene authentifizierte Aufrufe erhalten.

## Konkrete Release-Arbeiten

1. Produktions-Anmeldeeinstieg korrigieren; Installation/Wiederinstallation testen.
2. 99-Produkte-Triallimit atomar implementieren, Billing-Lebenszyklus testen und Preis/Trialdauer endgültig festlegen.
3. Gewünschten Lieferanten-/Bestellablauf fertigstellen: Der eigene Lagerstandort allein erfüllt keine Bestellung. Fulfillment-Anforderung, Lieferantenzahlung/-annahme und Tracking sind nicht durchgängig implementiert. Artikelkosten werden noch nicht in Shopifys Kostenfeld übertragen. Versandprofile/-richtlinie sind nicht synchronisiert; `write_shipping` fehlt.
4. Wiederkehrende Bestands-/Löschaktualisierung und Konfliktbehandlung abschließen. Import/Prüfknopf sowie ausdrücklich gestartete Hintergrundaufträge funktionieren; 29 Quellprodukte haben ungeklärte Mengen.
5. Protected-Customer-Data-Freigabe, benötigte Scopes, Betreiberangaben, Privacy-/Support-Prozess und Leistungsbeschreibung prüfen. Pflicht-Webhooks und tenantgetrennte Datenschutzfunktionen bestehen; rechtliche und Dashboard-Freigaben sind nicht nachgewiesen.
6. Listing, Bilder/Icon, Kontakt, Reviewer-Anleitung/Screencast und automatisierte Dashboard-Checks abschließen; danach Einreichung über Shopify.

## Inzwischen erledigte frühere Blocker

Permanentes HTTPS-Hosting, PostgreSQL/Supabase, gültige Worker-URLs, Bestand/SKU-Reparatur, Legacy-Varianten, Thumbnails sowie Ausschluss übertragener Produkte aus Katalog und Favoriten. 106 Tests, Typprüfung, gezieltes Linting, Build, Deployment-Vorprüfung und zehn Live-HTTP-Prüfungen bestanden. Finaler Favoritenfilter zusätzlich mit neun Katalogtests und dem echten Trenchcoat-Datensatz geprüft. Alte Angaben zu fehlendem Hosting, SQLite oder 21 Tests sind historisch.

## Übersprungene Gruppen

- 5.1 Online store — Keine Theme-App-Extension.
- 5.2 Payment — Keine Payment-Extension/Gateway-Scopes.
- 5.3 Payment facilitator — Opt-in nicht angefordert.
- 5.4 Purchase option — Keine Subscription-Contract-/Payment-Mandate-Scopes; App-Abrechnung ist hiervon getrennt.
- 5.5 Product sourcing — Formale Gruppe laut Liste Opt-in; nicht im 31-Punkte-Zähler enthalten. Die für das gewünschte Geschäftsmodell offensichtlichen Bestell-, Kosten- und Versandlücken sind oben trotzdem ausdrücklich erfasst.
- 5.6 Checkout customization — Keine Checkout-UI-Extension.
- 5.7 Sales channel — Keine channel_config-Extension.
- 5.8 Post purchase — Keine Post-Purchase-Extension.
- 5.9 Mobile app builders — Opt-in nicht angefordert.
- 5.10 Donation — Opt-in nicht angefordert.

## Prüfmatrix

Wahrscheinlich erfüllt: 1.1.2, 1.1.3, 1.1.6, 1.1.7, 1.1.8, 1.1.9, 1.1.10, 1.1.13, 1.1.14, 1.1.15, 1.1.16, 1.2.1, 1.2.3, 2.2.1, 2.2.3, 2.2.4, 2.2.6, 2.2.7, 2.3.2, 3.1.1, 3.2.1, 3.2.2, 3.2.3, 3.2.4, 3.2.5.

Belege: Admin GraphQL, AppProvider mit CDN-App-Bridge vor weiteren SDK-Skripten, authentifizierte Händleraktionen, Shopify-Abrechnung, gültiges Live-HTTPS; keine untersagten Zahlungs-, Theme-, Marketplace-, POS-, Checkout-, Werbe- oder Kreditfunktionen gefunden. Die fünf speziellen Scopes aus Gruppe 3.2 werden nicht angefordert.

## Quellen

- [Aktuelle Codeprüfliste](https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements)
- [App-Store-Anforderungen](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
- [Best Practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices)
- [Shopify-Abrechnung](https://shopify.dev/docs/apps/launch/billing)
- [Einreichung zur Prüfung](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review)
