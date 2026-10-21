# Easy Track

Ein deutsches Ernährungstagebuch für Smartphone, Tablet und Desktop. Die App funktioniert ohne Anmeldung und speichert alle persönlichen Daten ausschließlich im Local Storage des verwendeten Browsers.

## Starten

Voraussetzung: Node.js 22 oder neuer.

```sh
npm start
```

Danach **http://localhost:4173** öffnen. Für die App selbst müssen keine Pakete installiert werden. Unter Windows kann alternativ `start.cmd` gestartet werden. Den Server während der Nutzung geöffnet lassen. `Strg+C` beendet ihn.

Zum Starten von Tests:

```sh
npm ci
npm run check
npm test
```

Der Ordner `dist/` ist die vollständige statische Website und lässt sich auf einem beliebigen HTTPS-Webserver bereitstellen. Kein Build und kein Backend erforderlich. Die HTML-Datei bitte über HTTP/HTTPS öffnen, nicht durch Doppelklick als `file://`.

## Funktionen

- **Heute:** lokale Datumsnavigation, Kalorienring, Tagesziel, verbleibende Kalorien und sachliche Anzeige bei Überschreitung, Makros und vier Mahlzeitenbereiche.
- **Erfassen:** Suche nach Name/Marke, Favoriten, deduplizierte letzte Lebensmittel, Gramm, Milliliter und klar definierte Portionen, Dezimalkomma, sofortige Nährwertvorschau und Feldvalidierung.
- **Lebensmittel:** 16 explizit gekennzeichnete Beispiellebensmittel sowie eigene Lebensmittel mit optionaler Marke und Portionsdefinition; bearbeiten und löschen.
- **Einträge:** Menge, Datum und Mahlzeit ändern; löschen und zehn Sekunden lang rückgängig machen; einzelne Einträge oder vollständige Mahlzeiten auf ein frei gewähltes Datum und in einen Mahlzeitenbereich kopieren.
- **Rezepte:** Namen, Beschreibung, Zutatenmengen und Portionen verwalten; automatisch berechnete Gesamtwerte und Werte pro Portion; bearbeiten, duplizieren, löschen und auch halbe Portionen eintragen.
- **Verlauf:** Montag–Sonntag-Diagramm mit anklickbaren Tagen, Tagesdetails, Wochenkalorien, Anzahl erfasster Tage und Durchschnitt nur über Tage mit Einträgen.
- **Ziele:** manuelle Kalorienziele und optionale Makroziele mit Gültigkeitsdatum. Frühere Tage behalten ihr bisheriges Ziel. Es wird kein persönlicher Bedarf errechnet.
- **Einstellungen:** Hell-/Dunkelmodus, deutsche Zahlen und Datumsangaben, JSON-Export, geprüfter Import mit Ersetzungsbestätigung und vollständiges Zurücksetzen mit Bestätigung.
- **Bedienung:** mobile Navigation unten, Desktop-Seitenleiste, native modale Dialoge mit Escape und Fokusführung, Tastaturfokus, beschriftete Eingaben und Berücksichtigung reduzierter Bewegung.

## Speicherung und Datenmodell

Die Daten liegen unter `easy-track.v1` im Local Storage. Gespeichert wird erst nach einer erfolgreichen Browser-Schreiboperation; Speicherfehler werden angezeigt. Einträge enthalten eine eigenständige Kopie der Lebensmittel- beziehungsweise Rezeptnährwerte. Änderungen und Löschungen in der Sammlung verändern deshalb keine historischen Einträge.

Datumswerte sind lokale Kalendertage im Format `YYYY-MM-DD`. Zieländerungen werden nach diesem Datum ausgewertet. Mengen und Nährwerte werden intern ungerundet berechnet und nur für die Anzeige gerundet. Milliliter und Gramm werden nicht ineinander umgerechnet. Rezeptportionen basieren auf der hinterlegten Anzahl von Portionen des gesamten Rezepts.

JSON-Importe werden vor dem Ersetzen auf Formatversion, Datentypen, Wertebereiche, Datumswerte, IDs, Duplikate und konsistente Nährwertberechnungen geprüft. Fehlerhafte Importe lassen vorhandene Daten unverändert. Beschädigte lokale Daten werden nicht automatisch überschrieben; ein Download der Originaldaten ist möglich.

## Projektstruktur

```text
dist/index.html       Einstieg und Dialog-/Statusbereiche
dist/app.js           Wiederverwendbare Ansichten, Formulare und Abläufe
dist/model.js         Berechnungen, Snapshots, Ziele, Beispiele, Importprüfung
dist/styles.css       Responsive Gestaltung und beide Farbschemata
server.mjs            Lokaler statischer Entwicklungsserver
tests/model.test.mjs  Rechen- und Datenmodelltests
tests/app.test.mjs    Integrationstests mit Formularen, Events und Local Storage
```

## Prüfung

12 automatisierte Tests bestehen. Sie prüfen insbesondere Anlegen und Erfassen, Mengenänderungen und Summen, Löschen/Rückgängig, Mahlzeitenkopien, Rezeptzutaten und Teilportionen, unveränderliche historische Nährwerte, Zielwechsel, Reload, Export-/Import-Rundlauf, fehlerhafte Importe, ungültige Mengen, Datumsgrenzen und Schutz beschädigter Daten.

Zusätzlich im integrierten Chromium-Browser geprüft: eigenes Lebensmittel mit Dezimalkomma anlegen, 1,5 Portionen erfassen, korrekte Kalorien-/Makroanzeige, Neuladen sowie die responsive Ansicht bei 390 Pixel Breite. Die Integrationstests verwenden jsdom; sie ersetzen keine umfassende Prüfung in Safari/Firefox oder mit einem Screenreader.

## Grenzen dieser ersten Version

- Die Beispieldaten sind **nicht verifiziert** und keine vollständige Lebensmitteldatenbank. Maßgeblich sind die Angaben des jeweiligen Produkts.
- Daten sind an Browser, Gerät und Website-Adresse gebunden. Ein anderer Port, eine andere Domain oder ein anderes Browserprofil besitzt einen separaten Speicher. Beim Wechsel die Daten exportieren und wieder importieren.
- Browserdaten können gelöscht werden; regelmäßige JSON-Backups sind sinnvoll. Der Browser begrenzt den verfügbaren lokalen Speicher. Bei Erreichen des Limits zeigt die App einen Speicherfehler statt eines erfolgreichen Speicherns an.
- Kein Barcode-Scanner, keine Fotoerkennung, kein Wasser-/Gewichtsverlauf, keine Gesundheitsintegrationen, keine Konten und keine Cloud-Synchronisierung.
- Keine installierbare Offline-PWA. Lokal muss der mitgelieferte Server laufen; bei Hosting wird die App über die jeweilige Website geladen. Die optionalen Webfonts werden von Google Fonts geladen, mit Systemschriften als Fallback. Tagebuchdaten werden dabei nicht übertragen.
- Die lokale Vorschau kann ausdrücklich als „Test“ gekennzeichnete Daten aus der Browserprüfung enthalten. Frische Browserprofile und neue Hosting-Adressen beginnen leer.
