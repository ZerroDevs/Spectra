# Spectra · Intelligence & Forensic Workspace

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Web%20%7C%20Mobile%20%7C%20Desktop-38bdf8?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-slate?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Author-@ZerroDevs-0284c7?style=for-the-badge&logo=github&logoColor=white" alt="Author">
  <img src="https://img.shields.io/badge/Version-v3.0.0-64748b?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Zero-Telemetry-10b981?style=for-the-badge" alt="Zero Telemetry">
</p>

---

## Overview

**Spectra v3.0.0** is an enterprise-grade, 100% client-side intelligence workspace and forensic analysis suite engineered for processing, parsing, correlating, and auditing complex account records. Built with an Apple/Vercel-inspired *Stealth Platinum & Ice Slate* design system, Spectra delivers high-throughput forensic analysis with zero server roundtrips, zero outbound telemetry, and full offline capability.

Whether conducting deep-dive pairwise hardware collision checks, tracking multi-account synchrony during live moderation shifts, compiling publication-ready case dossiers, or transpiling foreign server dumps, Spectra runs entirely inside your browser's secure sandbox.

---

## Architecture & Module Catalog

Spectra provides a modular platform architecture organized into specialized forensic intelligence workbenches:

### 1. Core Workbenches
* **Operations Dashboard (`index.html`)**: Central mission control featuring live system vitals, quick-action shortcuts, customizable drag-and-drop dashboard widgets, and platform health telemetry.
* **Workspace Inspector (`workspace.html#main`)**: High-throughput log parser, dual-pane mirror editor, regex token classification, automated deduplication, and Discord markdown generator.
* **Ban Command Matrix (`workspace.html#ban`)**: Fast moderation command synthesizer (`/ban`, `/unban`), custom reason templates, duration chips, and a serial copy pipeline with strike-through tracking.
* **Workspaces & Tenancy (`workspace.html#workspaces`)**: Case isolation partitions, multi-tenancy management, tab cloning, and local database backup/restore.

### 2. Forensic Intelligence & Analytics
* **Incident Timeline & Stream (`timeline.html`)**: Chronological event reconstruction, cross-account synchrony detection (<60s time-delta cluster alerts), and Discord timestamped markdown generation (`<t:unix:F>`).
* **Hardware & Network Collision Matrix (`matrix.html`)**: Pairwise cross-identity overlap heatmap table, weighted correlation scoring (HWID 50%, IP 40%, /24 Subnet 20%, Discord 30%), and /24 subnet grouping.
* **Syndicate Alt Graph (`graph.html`)**: Interactive force-directed canvas visualizing multi-account rings, shared hardware identifiers, and coordinated griefer clusters.
* **Forensic Diff Comparator (`diff.html`)**: Side-by-side delta comparator highlighting new twinks, altered hardware IDs, and mutating identifiers across historical log snapshots.
* **Deep Analytics (`analytics.html`)**: Telemetry metrics, identity velocity distribution, reason frequency charts, and activity trend graphs.

### 3. Security, Privacy & Tactical Operations
* **Tactical Watchlist & Second-Screen HUD (`live.html`)**: Distraction-free live shift radar with synthetic Web Audio alarms, persistent suspect pinboard, and fast `Ctrl+K` triage lookup.
* **Security Audit & Blacklist Database (`audit.html`)**: Searchable repository of confirmed griefers, ban records, incident notes, and reusable userscript blocklist rules.
* **Encrypted Data Vault & Migration (`vault.html`)**: Web Crypto API AES-GCM 256-bit password-protected `.spectra` vault bundles, browser LocalStorage diagnostics meter, and zero-trace emergency data purge.
* **Server Rulebook & Ban Customizer (`rules.html`)**: Customizable server rule profile manager, duration matrix configurations, and official citation chips.

### 4. Ingestion & Case Reporting
* **Log Parser & Transpiler (`converter.html`)**: Universal ingestion adapter for server logs from txAdmin, ESX, QBCore, vRP, Discord bots, and CSV/TSV dumps with 1-click injection into Workspace.
* **Case Dossier & Evidence Generator (`reports.html`)**: Publication-ready investigation case file compiler with 1-click IP/HWID privacy redaction, rule citation chips, and clean Print/PDF exports.

---

## Technical Highlights

* **100% Client-Side Privacy**: All data ingestion, string manipulation, cryptographic operations, and correlation algorithms execute locally in browser memory. No logs or identifiers are transmitted to remote servers.
* **AES-GCM 256-Bit Cryptography**: Vault export bundles utilize the browser's native Web Crypto API with PBKDF2 key derivation (100,000 iterations) and AES-GCM 256-bit encryption.
* **Mobile-First Responsive Drawer**: Dedicated full-screen touch navigation drawer (`100vw`) with accessible tap targets (>= 48px), instant search filtering, and clean header auto-pruning on viewports <= 768px.
* **Pure Vector UI**: Handcrafted SVG vector icons throughout all components with zero emoji clutter for a clean, professional aesthetic.
* **Harmonious Dual Themes**: Sleek Stealth Dark (`#070711` / `#0b0f17`) and Refined Light (`#f8fafc` / `#ffffff`) modes with instant theme persistence.

---

## Developer Automation & SEO Suite

Spectra includes built-in automation tools to streamline search engine optimization and build maintenance:

### 1. Automated Sitemap & Robots Generator
The repository includes an autonomous generator script that scans all HTML pages, extracts titles and meta descriptions, computes change frequencies and priorities, and outputs clean `sitemap.xml` and `robots.txt` files.

* **Run via npm**:
  ```bash
  npm run seo
  ```
* **Run via Node.js**:
  ```bash
  node scripts/generate-seo.js
  ```
* **Run with custom domain**:
  ```bash
  node scripts/generate-seo.js --base-url https://your-custom-domain.com
  ```
* **1-Click Windows Execution**:
  Double-click `generate-seo.bat` in the project root.

### 2. Script Syntax Validation
Validate all JavaScript files across the project:
```bash
npm run lint:js
```

---

## Getting Started

No build steps, compiler toolchains, or heavy dependencies are required. Spectra runs directly in any modern web browser.

### 1. Clone the Repository
```bash
git clone https://github.com/ZerroDevs/Spectra.git
cd Spectra
```

### 2. Launching Locally
* **Windows 1-Click**: Double-click `start.bat` to launch the platform in your default browser.
* **Local Web Server**:
  ```bash
  npx serve .
  ```
* **Direct File Access**: Open `index.html` (Dashboard) or `workspace.html` (Workspace Inspector) directly in Google Chrome, Microsoft Edge, Brave, or Mozilla Firefox.

---

## Keyboard Shortcuts Reference

| Shortcut | Context / Scope | Action |
| :--- | :--- | :--- |
| `Ctrl + Enter` | Workspace Inspector Input | Process and parse raw input data |
| `Ctrl + K` | Tactical Watchlist HUD | Focus global triage search input |
| `Esc` | Anywhere | Close Tools Drawer, dismiss modals, or revert last action |
| `Tab` | Workspace Inspector Output | Insert `(M)` Main Account tag |
| `` ` `` (Backtick) | Workspace Inspector Output | Insert `(T)` Twink / Alt tag |
| `1` | Workspace Inspector Output | Insert `(Non-RP) !!` tag |
| `2` | Workspace Inspector Output | Insert `(Fail-RP) !!` tag |
| `3` | Workspace Inspector Output | Insert `(Provoking) !!` tag |
| `4` | Workspace Inspector Output | Insert `(GR3.1) !!` tag |
| `5` | Workspace Inspector Output | Insert `(GR3.2) !!` tag |

---

## Technology Stack

* **Markup**: Semantic HTML5 with accessible ARIA landmarks
* **Logic**: Vanilla ECMAScript (ES6+) with Web Crypto API and LocalStorage
* **Styles**: Vanilla CSS3 Custom Properties (Design Tokens, Glassmorphism, CSS Grid & Flexbox)
* **Graphics**: Handcrafted pure SVG vectors (zero unicode emojis)
* **Automation**: Node.js standard library build utilities

---

## License & Attribution

Developed and maintained by **[@ZerroDevs](https://github.com/ZerroDevs)**.

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
