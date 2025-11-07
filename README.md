# DLR React → GitHub Pages → PowerPoint


Interaktive DLR-Demo (React + Vite + Tailwind + lucide-react) mit Auto-Deploy auf **GitHub Pages**. Perfekt, um die Seite in PowerPoint über ein Web-Viewer Add-In einzubetten.

# Dynamic Line Rating (DLR) – Alpine Demo (React)

Interaktive DLR-Demo für den Alpenraum: Visualisiert, wie **Lufttemperatur**, **Wind (inkl. Böen)** und **Globalstrahlung (GHI)** die **Ampacity**, die **Leitertemperatur** und den **Durchhang (Sag)** beeinflussen. Enthält heuristische **Schnee-/Vereisungsindikatoren** und eine **wärmebilanzbasierte** Näherung nahe IEEE 738.

> ⚠️ **Hinweis:** Diese App ist **didaktisch**. Sie ersetzt **keine** leiterspezifische Planung/Operation, keine Freigaben und keine Netzbetriebsrichtlinien.

---

## Inhalt

* [Features](#features)
* [Technologie-Stack](#technologie-stack)
* [Quickstart](#quickstart)

  * [A. GitHub Pages (100% im Web, empfohlen)](#a-github-pages-100-im-web-empfohlen)
  * [B. Lokal entwickeln](#b-lokal-entwickeln)
  * [C. In PowerPoint einbetten](#c-in-powerpoint-einbetten)
* [Konfiguration & Parametrisierung](#konfiguration--parametrisierung)
* [Methodik](#methodik)

  * [1) Wärmebilanz & Leitertemperatur](#1-wärmebilanz--leitertemperatur)
  * [2) Ampacity (I_max) & DLR %](#2-ampacity-i_max--dlr-)
  * [3) Durchhang (Sag) – heuristische Visualisierung](#3-durchhang-sag--heuristische-visualisierung)
  * [4) Effektive Windgeschwindigkeit (Böen)](#4-effektive-windgeschwindigkeit-böen)
  * [5) Schnee/Vereisung – Heuristik](#5-schneevereisung--heuristik)
* [Grenzen & Annahmen](#grenzen--annahmen)
* [Validierungsideen](#validierungsideen)
* [Referenzen & weiterführende Literatur](#referenzen--weiterführende-literatur)

---

## Features

* **Alpen-range** der Eingangsgrößen: Temperatur **−20…+45 °C**, GHI **0…1200 W/m²**, Windmittel **0…12 m/s**, Böen **0…25 m/s**
* **Leiterstrom** als Steuergröße → **wärmebilanzbasierte** Leitertemperatur
* **Ampacity (I_max)** = maximaler Strom für **Tc_max = 80 °C** (per numerischer Suche)
* **DLR %** relativ zum **statischen Referenzfall** (35 °C, 0.6 m/s, 800 W/m²)
* **Schnee-/Vereisungsindikator** (logikbasiert)
* **Sag**-Visualisierung abhängig von **Leitertemperatur** und **Wind**
* **React + Vite + Tailwind**, buildbar als **Single-File HTML** (robust für Hosting/PowerPoint)

---

## Technologie-Stack

* **React 18** (Functional Components, Hooks)
* **Vite 5** (schneller Dev-Server, Produktion-Build)
* **Tailwind CSS 3** (stileskalierbar, utility-first)
* **lucide-react** (Iconset)
* **vite-plugin-singlefile** (optional; generiert eine inlined `index.html`)

---

## Quickstart

### A. GitHub Pages (100% im Web, empfohlen)

1. Repository erstellen (Public).
2. Projektdateien hinzufügen (siehe Struktur: `package.json`, `vite.config.ts`, `src/*`, …).
3. In `vite.config.ts` **base** auf `/<REPO_NAME>/` setzen.
4. GitHub Actions Workflow `.github/workflows/deploy.yml` einchecken (Build & Pages-Deploy).
5. `Settings → Pages → Source: GitHub Actions`.
6. Nach erfolgreichem Workflow die **Pages-URL** nutzen, z. B. `https://<USER>.github.io/<REPO_NAME>/`.

### B. Lokal entwickeln

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # ./dist
```

Optional Single-File-Output (via Plugin bereits aktiv): Die `./dist/index.html` enthält inline Assets.

### C. In PowerPoint einbetten

* **Interaktiv (empfohlen):** Pages-URL mit **Web Viewer/LiveWeb**-Add-In einfügen.
* **Offline:** `dist/index.html` per **LiveWeb** lokal referenzieren oder Bildschirmvideo einbetten.

---

## Konfiguration & Parametrisierung

Die Standardwerte/Parameter sind in `DynamicLineRating.tsx` oben definiert:

| Symbol         | Bedeutung                              | Default | Einheit |
| -------------- | -------------------------------------- | ------: | ------- |
| `TC_MAX`       | maximale Leitertemperatur              |      80 | °C      |
| `T_STATIC_REF` | statische Referenz-Lufttemperatur      |      35 | °C      |
| `V_REF`        | statische Referenz-Windgeschwindigkeit |     0.6 | m/s     |
| `GHI_REF`      | statische Referenz-GHI                 |     800 | W/m²    |
| `DIAM`         | Leiternenn-Durchmesser                 |   0.028 | m       |
| `R20_PER_M`    | Widerstand @20 °C                      |  3.0e−5 | Ω/m     |
| `ALPHA_R`      | Tempkoeff. Widerstand                  |  0.0039 | 1/K     |
| `EPS`          | Emissivität                            |     0.8 | –       |
| `ALPHA_SOLAR`  | Absorptivität                          |     0.5 | –       |

> **Anpassbar:** Für spezifische Leiter (z. B. ACSR-Typen) können `DIAM`, `R20_PER_M`, `EPS`, `ALPHA_SOLAR` aus Datenblättern/Normen ersetzt werden.

---

## Methodik

### 1) Wärmebilanz & Leitertemperatur

Wir lösen näherungsweise pro Meter Leiter die stationäre Wärmebilanz

[ q_\text{Joule}(I, T_c) + q_\text{Solar}(\text{GHI}) = q_\text{Conv}(v_\text{eff}, T_c-T_a) + q_\text{Rad}(T_c, T_a) ]

mit

* **Joule-Verlust:** ( q_\text{Joule} = I^2,R(T_c) ), ( R(T) = R_{20},[1 + \alpha_R,(T-20)] )
* **Solare Einstrahlung:** ( q_\text{Solar} = \alpha_\text{sol} \cdot \text{GHI} \cdot D ) (projizierte Fläche ≈ Durchmesser * 1 m)
* **Konvektion:** ( q_\text{Conv} = h_c(v_\text{eff}) ,(T_c-T_a),\pi D ), mit heuristischem ( h_c(v) \approx 5 + 8\sqrt{v+0.1} ) W/m²K
* **Strahlung:** ( q_\text{Rad} = \varepsilon,\sigma,(T_c^4 - T_a^4),\pi D )

Numerische Lösung für **T_c** mittels gedämpfter Fixpunkt-/Newton-Schritte; Begrenzung auf ([T_a-5,; T_{c,\max}]) mit **T_{c,max}=80 °C**.

### 2) Ampacity (I_max) & DLR %

* **Ampacity I_max:** größter Strom, so dass **T_c = 80 °C** (Numerik via Bisektion/Erhöhung von Obergrenzen).
* **DLR %:** ( \text{DLR} = 100% \cdot I_\text{max}(T_a, v_\text{eff}, \text{GHI}) / I_\text{max}(35,°\text{C}, 0.6,\text{m/s}, 800,\text{W/m²}) )

### 3) Durchhang (Sag) – heuristische Visualisierung

Sag steigt mit **Leitertemperatur** (thermische Ausdehnung) und wird vom **Wind** leicht optisch reduziert.

[ \text{Sag} \approx \text{Sag}*\text{ref},(1 + k,(T_c - T*\text{ref})) - c,v_\text{eff} ]

Die Parameter ((k, c)) sind **visualisierende** Heuristiken, **keine** mechanische Catenary-Lösung.

### 4) Effektive Windgeschwindigkeit (Böen)

Böen erhöhen den Wärmeübergang. Heuristik:

[ v_\text{eff} = v_\text{mean} + 0.35,(v_\text{gust} - v_\text{mean}) \quad (v_\text{gust} > v_\text{mean}) ]

### 5) Schnee/Vereisung – Heuristik

Regeln (ohne expliziten Niederschlag):

* Vereisung **hoch** bei: ( -10\le T_a\le 1~°C ), ( v\le 3~\text{m/s} ), niedrige Strahlung
* Vereisung **moderat** bei: ( -15\le T_a\le 2~°C ), ( v\le 5~\text{m/s} ), sehr niedrige Strahlung
* **Schnee (Nassschnee) möglich** bei: ( -5\le T_a\le 2~°C ), geringe Strahlung

Diese Indikatoren sind **vereinfachte** Signale für Betriebs-Hinweise.

---

## Grenzen & Annahmen

* **Leiterspezifika** (Durchmesser, Strangaufbau, Oberflächenbeschaffenheit) sind grob gesetzt → Ergebnisse **nicht** typgeprüft.
* **Konvektion** stark vereinfacht; exakte Formeln hängen von **Anströmwinkel**, **Reynolds-/Nusseltzahl** und **Anlage** ab.
* **Strahlung** nutzt GHI und pauschale optische Koeffizienten; kein Spektrum, keine Orientierung/Längsneigung.
* **Mechanik** (Sag) ist eine **qualitative** Visualisierung, keine Catenary-Berechnung.
* **Vereisung/Schnee**: nur Heuristik ohne Mikro-/Niederschlagsphysik.

---

## Validierungsideen

* Vergleich mit **IEEE 738**-Beispielrechnungen (Parameter adäquat setzen)
* Gegenüberstellung von **Betriebsdaten** (Leitertemp./Strom/Wind) an Testabschnitten
* Sensitivitätsanalysen: (\partial I_\text{max}/\partial v), (\partial I_\text{max}/\partial T_a), (\partial I_\text{max}/\partial \text{GHI})
* Nutzung von **NWP/Nowcasting** (INCA, AROME, AIFS) zur Szenariobetrachtung

---

## Referenzen & weiterführende Literatur

* **IEEE Std 738-2023**: Standard for Calculating the Current-Temperature Relationship of Bare Overhead Conductors (IEEE Xplore)
* CIGRÉ TB 601 (2014): *Guide for thermal rating calculations of overhead lines*
* Karimi, A. et al. (2018). *A review of Dynamic Line Rating systems for overhead lines.* **Renewable and Sustainable Energy Reviews**, 91, 600–619. doi:10.1016/j.rser.2018.04.021
* US DOE OE (2012): *Dynamic Line Rating Systems for Transmission Lines* (Tech. Report)
* ENTSO-E (2013+): *Operational Handbook* / *Methodologies for capacity calculation* (DLR-Kontext)

> Einige Quellen sind kostenpflichtig (IEEE/CIGRÉ). Für Open-Access-Übersichten eignen sich Review-Artikel (z. B. Karimi 2018). Für projektspezifische Parametrisierung bitte **Leiterdatenblätter** (Hersteller) heranziehen.

## 🚀 Quickstart (nur GitHub Web-UI)


1. **Repo erstellen** (Public).
2. Alle Dateien aus diesem README anlegen: *Add file → Create new file* (oder Upload).
3. In `vite.config.ts` die `base` an deinen **Repo-Namen** anpassen (siehe Datei).
4. Commit auf **main** → GitHub Action baut & deployed automatisch.
5. **Settings → Pages** → dort steht deine URL, z. B. `https://<USER>.github.io/<REPO>/`.


## 🧩 In PowerPoint einbetten
- *Einfügen → Add-Ins → Web Viewer/LiveWeb*
- **Seiten-URL** einfügen (siehe GitHub Pages)


## 🔧 Entwicklung lokal (optional)
```bash
npm install
npm run dev
npm run build
