# DLR React → GitHub Pages → PowerPoint


Interaktive DLR-Demo (React + Vite + Tailwind + lucide-react) mit Auto-Deploy auf **GitHub Pages**. Perfekt, um die Seite in PowerPoint über ein Web-Viewer Add-In einzubetten.


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
