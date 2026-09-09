# Moe's Kebap CMS

Kleines Lernprojekt: Node.js + Express + EJS + PostgreSQL. Verwaltet Speisekarte,
Hero-Slogan und Kategorie-Bilder über einen passwortgeschützten Admin-Bereich.

## Lokal starten

Voraussetzung: eine laufende PostgreSQL-Datenbank (lokal installiert oder z.B. via Docker).

```bash
npm install
npm run setup-db   # einmalig: Tabellen anlegen + mit data/content.json befüllen
npm start           # Server startet auf http://localhost:3000
```

Admin-Bereich: `/admin` (Passwort siehe `.env`, lokal `ADMIN_PASSWORD`).

## Nötige Umgebungsvariablen

Lokal in `.env` (liegt NICHT im Git), beim Hoster im jeweiligen Environment-Variables-Bereich:

| Variable | Zweck |
|---|---|
| `ADMIN_PASSWORD` | Passwort für `/admin` |
| `SESSION_SECRET` | zufälliger geheimer String für sichere Sessions |
| `DATABASE_URL` | Verbindungs-String zur PostgreSQL-Datenbank |
| `PORT` | wird vom Hoster meist automatisch gesetzt |
| `NODE_ENV=production` | aktiviert sichere Cookies (nur über HTTPS) |

## Deployment (Railway empfohlen)

1. Projekt auf GitHub pushen (`.env` bleibt dank `.gitignore` draußen!)
2. Bei railway.app einloggen, "New Project" → "Deploy from GitHub repo"
3. Im selben Railway-Projekt "New" → "Database" → "PostgreSQL" hinzufügen -
   Railway setzt `DATABASE_URL` dann automatisch als Variable
4. Unter "Variables" zusätzlich `ADMIN_PASSWORD`, `SESSION_SECRET`, `NODE_ENV=production` eintragen
5. Einmalig `npm run setup-db` in der Railway-Konsole ausführen
6. Fertig - **kein Volume nötig**, die Datenbank läuft komplett getrennt vom App-Server
   und übersteht jedes Redeploy von ganz allein

## Projektstruktur

```
server.js          - der komplette Server (Routen, Auth, Datenbank-Zugriff)
setup-db.js         - einmaliges Skript: Tabellen anlegen + Erstbefüllung
data/content.json   - Ausgangsdaten für setup-db.js (nicht die Laufzeit-Quelle!)
views/               - EJS-Templates (öffentliche Seite + Admin-Formulare)
public/              - statische Dateien (Bilder, Impressum, Datenschutz)
```
