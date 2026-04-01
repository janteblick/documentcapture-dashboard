# DocumentCapture Dashboard — Design Spec
**Datum:** 2026-04-01  
**Status:** Goedgekeurd

---

## Samenvatting

Een Chrome/Edge-browserextensie (Manifest V3) die op één dashboard-tab een overzicht toont van alle openstaande factuurgoedkeuringen over 4 Continia Document Capture-clusters. De gebruiker logt één keer in via de instellingenpagina; de extensie beheert sessies en haalt data op in de achtergrond.

---

## Clusters

| Cluster    | URL                                      |
|------------|------------------------------------------|
| Sneyers    | https://sneyers.documentcapture.eu/      |
| Jorssen    | https://jorssen.documentcapture.eu/      |
| Gamotors   | https://gamotors.documentcapture.eu/     |
| Belien     | https://belien.documentcapture.eu/       |

Alle clusters gebruiken dezelfde credentials. Elke cluster-URL vertegenwoordigt een "cluster" dat intern meerdere bedrijven kan bevatten.

---

## Architectuur

```
extension/
├── manifest.json          # Manifest V3
├── background.js          # Service Worker: sessies, polling, data-opslag
├── dashboard.html         # Volledige dashboard-tab (geopend via extensie-icoon)
├── dashboard.js           # Dashboard-logica: leest chrome.storage, rendert UI
├── dashboard.css          # Stijlen voor dashboard
├── options.html           # Instellingenpagina: credentials + refresh-interval
├── options.js             # Opslaan/testen van credentials
└── icons/                 # Extensie-iconen (16, 48, 128px)
```

### Componenten

**Service Worker (`background.js`)**
- Beheert de 4 clustersessies (login-cookies)
- Pollt elke 5 minuten (instelbaar) alle clusters
- Slaat resultaten op in `chrome.storage.session`
- Herstelt verlopen sessies automatisch door opnieuw in te loggen

**Dashboard-tab (`dashboard.html` + `dashboard.js`)**
- Geopend door op het extensie-icoon te klikken
- Leest data uit `chrome.storage.session`
- Toont 4 cluster-secties met tellers, bedrijven en factuurlijsten
- "Vernieuwen"-knop triggert de service worker

**Instellingenpagina (`options.html` + `options.js`)**
- Gebruikersnaam + wachtwoord invoer
- "Onthoud me"-dropdown: 1 dag / 7 dagen / 30 dagen / altijd
- "Opslaan & testen"-knop: test login op alle 4 clusters en toont resultaat

---

## Data Flow

1. Service worker POST naar `https://{cluster}/Account/Login` met username + password
2. Bij succesvolle login: navigeer naar de goedkeuringslijst-pagina (exact pad bepaald tijdens implementatie via browser DevTools op live site)
3. Parse HTML: extraheer per bedrijf de lijst van openstaande facturen (factuurnummer, datum, bedrag, bedrijfsnaam)
4. Sla op in `chrome.storage.session` als:
   ```json
   {
     "sneyers": {
       "status": "ok",
       "lastUpdated": "2026-04-01T10:00:00Z",
       "companies": [
         {
           "name": "Bedrijf A",
           "pendingCount": 3,
           "invoices": [
             { "number": "FAC-001", "date": "2026-03-28", "amount": "1.250,00 €" }
           ]
         }
       ]
     },
     "jorssen": { "status": "error", "error": "Login mislukt" }
   }
   ```
5. Dashboard-tab leest deze data en rendert de UI

---

## Dashboard UI

### Layout
- **Header**: "DocumentCapture Dashboard" + laatste refresh-tijdstip + "Vernieuwen"-knop
- **4 cluster-secties** (één per cluster), elk met:
  - Clusternaam + totaalteller openstaande facturen (groot, prominent)
  - Per bedrijf binnen het cluster:
    - Bedrijfsnaam + subtotaal
    - Tabel: Factuurnummer | Datum | Bedrag
  - "Openen in DocumentCapture"-knop → opent cluster-URL in nieuwe tab
- **Statusbalk** onderaan: totaal alle clusters + foutmeldingen per cluster

### States
- **Laden**: spinner per cluster bij eerste load of vernieuwen
- **Geen facturen**: groene check + "Geen openstaande facturen"
- **Fout**: rode status + foutbericht (bijv. "Login mislukt", "Niet bereikbaar")
- **Niet geconfigureerd**: melding "Stel je credentials in" + link naar opties

---

## Credentials & Beveiliging

- Credentials opgeslagen in `chrome.storage.local` (alleen toegankelijk voor de extensie, versleuteld door Chrome)
- "Onthoud me"-periode: 1 dag / 7 dagen / 30 dagen / altijd
- Na verloop van de periode worden credentials gewist; clusters tonen "Inloggen vereist"
- Wachtwoord nooit zichtbaar in logs of dashboard-UI

---

## Foutafhandeling

| Situatie | Gedrag |
|---|---|
| Cluster niet bereikbaar | Rode status bij dat cluster; andere clusters werken normaal |
| Login mislukt | Rode status + melding "Ongeldige credentials" |
| Sessie verlopen (server-timeout) | Automatisch opnieuw inloggen met opgeslagen credentials |
| Credentials verlopen (onthoud-me) | Melding "Inloggen vereist" + link naar instellingen |
| Parse-fout (HTML-structuur veranderd) | Gele waarschuwing "Kon facturen niet uitlezen" + link om cluster handmatig te openen |

---

## Refresh

- Automatische achtergrond-refresh: elke 5 minuten (standaard, instelbaar in opties: 1 / 5 / 15 / 30 min)
- Handmatige refresh via "Vernieuwen"-knop op het dashboard
- Bij openen van de dashboard-tab: altijd eerst data ophalen als laatste refresh > 1 minuut geleden

---

## Installatie (developer mode)

Omdat de extensie niet via de Chrome Web Store wordt verspreid:
1. Ga naar `chrome://extensions/`
2. Schakel "Ontwikkelaarsmodus" in
3. Klik "Uitgepakte extensie laden" → selecteer de `extension/`-map
4. Klik op het extensie-icoon → dashboard opent

---

## Open punten (op te lossen tijdens implementatie)

- **Exact URL-pad van de goedkeuringslijst**: bepalen via browser DevTools (Network tab) terwijl ingelogd op een live cluster
- **HTML-structuur van de goedkeuringslijst**: bepalen welke CSS-selectors de bedrijven, factuurlijsten en telwaarden bevatten
- **Login-form action URL**: bepalen via DevTools (de form POST-target)
