# Billing-Entscheidungen — 18.09.2026

## Vom Nutzer bestätigt

- Cloudflare Free; kein bezahlter Hosting-Tarif.
- Kostenlose Testphase, danach kostenpflichtiges App-Abo.
- Im Trial höchstens 99 Produkte.

## Vorschlag, noch nicht vollständig bestätigt oder implementiert

- Bestehende Konfiguration: 14 Tage Trial, anschließend 99 EUR alle 30 Tage. Beide Werte zur endgültigen Bestätigung angefragt; 99 Produkte ist unabhängig vom Preis.
- 99 unterschiedliche erfolgreich importierte Quellprodukte je Händler-Shop während des Trials, Varianten zählen nicht separat. Wiederholung desselben Imports und fehlgeschlagene Importe verbrauchen keinen weiteren Platz. Löschen/erneutes Importieren soll keinen unbegrenzten Gratisimport ermöglichen; Wiederinstallation nach Datenschutzvorgaben und Shopify-Trial-Verhalten behandeln.
- Limit auf dem Server und atomar für parallele Importe durchsetzen. Anzeige allein reicht nicht. Ein begonnenes, teilweise fehlgeschlagenes Produkt muss reparierbar bleiben.
- Bei 99 Produkten weitere neue Importe sperren und Abo anbieten; keine automatische vorzeitige Abbuchung wegen Erreichen des Limits. Vorzeitigen Wechsel separat transparent bestätigen lassen.
- Ohne gültigen Trial oder Abo neue Importe und neue Vermittlungsaufträge sperren. Bereits angenommene/bezahlte Bestellungen, Tracking, Reklamationen und Abrechnungszugriff weiter ermöglichen.
- Bestehende Händlerprodukte nicht pauschal löschen, deaktivieren oder Bestände als Billing-Sperre verfälschen. Eine Auftragssperre in der App verhindert keine Kundenbestellung im Händler-Shop. Vor Produktivbetrieb Übergang/Verkaufsfähigkeit mit Fulfillment-Zuordnung lösen; sonst Risiko bezahlter, nicht ausführbarer Bestellungen. R10/R12 bleiben offen.
- App-Abo, Warenpreis und Versand getrennt ausweisen. Keine zusätzlichen App-Nutzungsgebühren im Trial vorgesehen. Bezahltes Produktlimit noch offen; kein unbegrenztes Kontingent versprechen.
- Status von Shopify verifizieren; Testabos niemals als Produktionszahlung werten. Kündigung, Zahlungsfehler und API-Ausfälle unterscheiden. Keine echten Gebühren aktivieren, bevor Preis, Ablauf und Tests abgeschlossen sind.

## Plattformreferenz

- Shopify-Abrechnung und Zustimmung: https://shopify.dev/docs/apps/launch/billing
- Trial mit Billing API: https://shopify.dev/docs/apps/launch/billing/manual-pricing/subscription-billing/offer-free-trials
- Shopify App Pricing (aktuelle Standardoption für neue öffentliche Apps; vorhandene Billing-API-Integration vor Einreichung auf Eignung prüfen): https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing

Stand: Anforderungen dokumentiert; das 99-Produkte-Limit ist noch nicht technisch umgesetzt oder deployed. Aktuelle Priorität bleibt die laufende Bestands-/Variantenkorrektur.
