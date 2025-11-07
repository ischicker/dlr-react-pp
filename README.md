# Dynamic Line Rating (DLR) – Alpine Demo (React)

Interaktive Web-Demo zur Berechnung des **Dynamic Line Ratings (DLR)** für den Alpenraum. Das Tool zeigt, wie **Temperatur**, **Wind (inkl. Böen)**, **Globalstrahlung**, **Leiterstrom** und das gewählte **Wärmebilanz-Modell (IEEE-like / CIGRÉ-like)** die **Leitertemperatur**, **Ampacity**, **DLR %**, **Durchhang (Sag)** und **Schnee/Vereisungsrisiken** beeinflussen.

> ❗ Hinweis: Dieses Tool ist **didaktisch**. Es ersetzt keine konforme Auslegung nach IEEE 738 oder CIGRÉ TB 601.

---

## Inhalt

* [Features](#features)
* [Modellwahl: IEEE ⇄ CIGRÉ](#modellwahl-ieee--cigré)
* [Advanced Parameters](#advanced-parameters)
* [Technologie-Stack](#technologie-stack)
* [Quickstart](#quickstart)
* [Konfiguration & Parametrisierung](#konfiguration--parametrisierung)
* [Methodik](#methodik)
* [Grenzen & Annahmen](#grenzen--annahmen)
* [Validierungsideen](#validierungsideen)
* [Referenzen](#referenzen)

---

## Features

✅ **Modellschalter:** *IEEE-like* ↔ *CIGRÉ-like*
✅ **Leiterstrom** als direkter Input
✅ **Alpen-range** der Atmosphärenparameter (−20… +45 °C, Wind 0–12 m/s, Böen 0–25 m/s, GHI 0–1200 W/m²)
✅ **Wärmebilanz**: Joule, solare Einstrahlung, Konvektion, Strahlung
✅ **Ampacity-Berechnung (Tcₘₐₓ=80 °C)**
✅ **DLR %** relativ zum konservativen statischen Referenzfall
✅ **Effektive Windgeschwindigkeit (inkl. Böen)**
✅ **Sag-Visualisierung** basierend auf Tc
✅ **Schnee-/Vereisungsindikatoren**
✅ **Single-File-Build** für GitHub Pages oder PowerPoint-Einbettung

---

## Modellwahl: IEEE ⇄ CIGRÉ

### IEEE-like Modell

Heuristische Konvektionsformel:

```
h_c(v) = 5 + 8 * sqrt(v + 0.1)
```

* sehr robust
* didaktisch gut nachvollziehbar
* leichte Überschätzung der Kühlung bei starkem Wind möglich

### CIGRÉ-like Modell (inspiriert durch TB 601)

Zerlegung in **natürliche** und **erzwungene Konvektion**:

```
q_nat = Cn * (ΔT)^1.25 * D^0.75
q_for = Cf * v^m * (ΔT)^n * D^0.75
q_conv = q_nat + q_for
```

* realistischere Windabhängigkeit
* Exponenten m≈0.5, n≈1.25 typisch
* Koeffizienten **didaktisch**, nicht standardkonform

Der Nutzer kann live zwischen beiden Modellen umschalten.

---

## Advanced Parameters

Die App kann durch leiterspezifische Parameter erweitert werden. Diese Werte liegen im Code (oder können als UI-Slider addiert werden):

| Parameter     | Bedeutung                      | Typischer Bereich |
| ------------- | ------------------------------ | ----------------- |
| `DIAM`        | Leiterdurchmesser              | 18–34 mm          |
| `R20_PER_M`   | Widerstand @20°C               | 2.2e-5–4.0e-5 Ω/m |
| `ALPHA_R`     | Temperaturkoeff. Widerstand    | 0.0038–0.0040     |
| `EPS`         | Emissivität                    | 0.5–0.9           |
| `ALPHA_SOLAR` | Absorptivität Solar            | 0.3–0.6           |
| `TC_MAX`      | maximal zul. Leiter-Temperatur | 70–120°C          |
| `CIGRE_CN`    | natürliche Konvektion          | 2–5               |
| `CIGRE_CF`    | erzwungene Konvektion          | 5–12              |
| `CIGRE_M`     | Windexponent                   | 0.4–0.6           |
| `CIGRE_N`     | ΔT-Exponent                    | 1.2–1.3           |

Optional kann ein **Dropdown mit Leitertypen** (ACSR, AAAC, ACCC …) ergänzt werden.

---

## Technologie-Stack

* **React 18**
* **Vite 5** (mit Single-File-Bundling)
* **Tailwind CSS**
* **lucide-react** für Icons

---

## Quickstart

### 1) Lokal starten

```bash
npm install
npm run dev
```

➡ Öffnet [http://localhost:5173](http://localhost:5173)

### 2) Build erstellen

```bash
npm run build
```

Der Output liegt in `dist/` – `index.html` ist **inline**, ideal für PowerPoint.

### 3) GitHub Pages Deployment

* Repo → Settings → Pages → „GitHub Actions“
* Workflow `.github/workflows/deploy.yml` vorhanden
* Live unter `https://<user>.github.io/<repo>/`

### 4) PowerPoint Integration

Optionen:

* **Live-Webseite einbinden** (Add-In „Web Viewer“ oder Office 365 Web Viewer)
* **Offline:** `dist/index.html` lokal per „LiveWeb“ anzeigen lassen
* Alternativ: Screencast/Animation einbinden

---

## Konfiguration & Parametrisierung

Die zentralen Parameter stehen in `DynamicLineRating.tsx` im oberen Block:

* Tc_max = 80 °C (konfigurierbar)
* statischer Referenzfall: **35 °C**, **0.6 m/s**, **800 W/m²**
* Alpenbereich: −20…+45°C, Wind 0–12 m/s, Böen 0–25 m/s, Strahlung 0–1200 W/m²
* Joule, Konvektion, Strahlung und Solarheating vollständig implementiert

---

## Methodik

### Wärmebilanz (stationär)

Für jeden Leitermeter lösen wir:

```
q_joule(I,Tc) + q_solar(GHI)  =  q_conv(v_eff, ΔT) + q_rad(Tc,Ta)
```

**Joule:**

```
q_joule = I² * R(Tc)
R(Tc) = R20 * (1 + α_R (Tc − 20))
```

**Solareinstrahlung:**

```
q_solar = α_solar * GHI * D
```

**Konvektion IEEE-like:**

```
h = 5 + 8 * sqrt(v + 0.1)
q_conv = h * (Tc − Ta) * πD
```

**Konvektion CIGRÉ-like:**

```
q_nat = Cn (ΔT)^1.25 D^0.75
q_for = Cf v^m (ΔT)^n D^0.75
q_conv = q_nat + q_for
```

**Strahlung:**

```
q_rad = ε σ (Tc⁴ − Ta⁴) πD
```

Die Gleichung wird numerisch (gedämpfte Newton/Fixed-Point) gelöst.

### Ampacity (I_max)

Der maximal zulässige Strom ist jeniger, der **Tc = Tc_max** ergibt.
Gelöst per adaptiver Bisektion.

### DLR %

```
DLR = I_max(aktuell) / I_max(referenz) * 100
```

### Effektive Windgeschwindigkeit (inkl. Böen)

```
v_eff = v_mean + 0.35 * (v_gust − v_mean)
```

### Durchhang (Sag)

Visuelles Modell:

```
sag = sag_ref * (1 + k (Tc − T_ref)) − c * v_eff
```

Keine mechanische Catenary-Lösung – rein didaktisch.

### Schnee- & Vereisungsindikatoren (Heuristik)

* Vereisung hoch: −10…+1 °C, niedrige Strahlung, schwacher Wind
* Vereisung moderat: −15…+2 °C
* Nassschnee möglich: −5…+2 °C

---

## Grenzen & Annahmen

⚠ didaktisches Modell – nicht normkonform
⚠ CIGRÉ-Parameter sind heuristisch
⚠ Keine mechanische Sag-/Spanfeldberechnung
⚠ Keine Niederschlagsphysik, nur heuristische Ablagerungsregeln
⚠ Emissivität & Absorptivität: typische Defaultwerte

---

## Validierungsideen

* Vergleich gegen IEEE 738-Beispiele
* Gegenüberstellung mit SCADA-Daten (Tc, I, Wind)
* Sensitivität: ∂I_max/∂v, ∂I_max/∂Ta, ∂I_max/∂GHI
* Nutzung von INCA, AROME, AIFS für Szenariobewertung

---

## Referenzen

* IEEE Std 738-2023 – Current-Temperature Relationship of Bare Overhead Conductors
* CIGRÉ TB 601 (2014) – Thermal rating of overhead lines
* Karimi et al. (2018), *Dynamic Line Rating systems*, Renewable & Sustainable Energy Reviews
* US DOE OE (2012): Dynamic Line Rating Systems
* ENTSO-E Operational
