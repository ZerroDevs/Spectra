# Spectra · Intelligence & Moderation Workspace

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Web%20%7C%20Mobile%20%7C%20Desktop-38bdf8?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-slate?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Author-@ZerroDevs-0284c7?style=for-the-badge&logo=github&logoColor=white" alt="Author">
  <img src="https://img.shields.io/badge/Version-2.5.0-64748b?style=for-the-badge" alt="Version">
</p>

---

## ⚡ Overview

**Spectra** is a high-performance, client-side intelligence workspace and moderation analysis suite engineered for processing, parsing, and auditing complex account logs. Built with an Apple/Vercel-inspired *Stealth Platinum & Ice Slate* design system, Spectra delivers desktop-grade functionality with a mobile-first responsive architecture.

Whether managing large-scale server audits, investigating multi-account griefing, or generating structured punishment commands, Spectra runs entirely in the browser with zero external dependencies and full offline capability.

---

## ✨ Key Features

### 🔍 Intelligence Inspector & Data Processor
- **High-Throughput Log Parsing**: Cleans and normalizes raw account records, identifiers, and timestamps instantly.
- **Discord Markdown Engine**: Formats output with optional Discord code blocks (`` ` `` / `` ``` ``), bracket formatting, and configurable tags.
- **Live Mirror Editor**: Synchronized line-numbered text areas with real-time token highlighting and search navigation.
- **Data Hygiene Tools**: Built-in deduplication, serial grouping, age-based ranking, and incremental data merging.

### 🔨 Command Engine (Ban Generator)
- **Automated Command Synthesis**: Translates parsed logs into exact server moderation commands (`/ban`, `/unban`) in a single click.
- **Configurable Presets & Durations**: Pre-loaded with common moderation rules alongside a dynamic Custom Preset Builder.
- **Quick Preset Chips**: Fast one-tap rule selection bar for rapid workflows.
- **Serial Copy Pipeline**: Step-by-step `Copy Next` queue with real-time progress indicators and visual strike-through tracking.
- **Discord Dispatch**: Ready-to-send Discord webhook integrations for moderation audit logging.

### 🛡️ Detection & Threat Heuristics
- **(M)or(T) Main/Twink Detector**: Automatically tags and correlates primary and alternate accounts based on activity patterns.
- **Serial Correlation**: Links hardware/software serial identifiers directly with player accounts.
- **Griefer Warning System**: Instant heuristic alerts highlighting rule-breaking clusters with dedicated clean-copy tools.

### 📱 Mobile-First Architecture
- **Responsive Drawer & Switchers**: Dedicated mobile sliding drawer navigation and segmented view switchers (`Input` vs `Output`, `Accounts` vs `Commands`).
- **Touch-Optimized Toolbars**: Horizontal swipeable toolbars with pinned category chips and momentum scrolling.
- **Zero Zoom Friction**: Form elements and inputs calibrated specifically to prevent mobile browser auto-zoom.

### 🎨 Stealth Slate Design System
- **Curated Color Harmony**: Ice Sky Blue (`#38bdf8`) paired with Deep Slate (`#0b0f17`) and crisp Platinum accents (`#e2e8f0`).
- **Dual High-Contrast Themes**: Seamless toggling between Stealth Dark and Refined Light modes.
- **Pure Vector UI**: 100% SVG iconography with zero emoji clutter for a sleek, enterprise dashboard look.

### 💾 Privacy & Workspace State
- **100% Client-Side**: All data processing is executed in your browser. No logs are ever uploaded to remote servers.
- **Multi-Tab Workspaces**: Create, rename, archive, and switch between isolated investigation workspaces.
- **Full Backup & Restore**: Export and import complete workspace configurations via JSON backups.

---

## 🚀 Getting Started

No build steps, installations, or dependencies are required. Spectra is completely standalone.

### 1. Clone the Repository
```bash
git clone https://github.com/ZerroDevs/multi-checkers.git
cd multi-checkers
```

### 2. Launch
- **Windows**: Double-click `start.bat` to launch with your default browser.
- **Cross-Platform**: Open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari).
- **Local Dev Server** (Optional):
  ```bash
  npx serve .
  ```

---

## ⌨️ Hotkeys & Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `Ctrl + Enter` | Process Data | Inspector Input |
| `Tab` | Insert `(M)` Tag | Inspector Output |
| `` ` `` (Backtick) | Insert `(T)` Tag | Inspector Output |
| `Esc` | Revert Last Action | Inspector Output |
| `1` | Insert `(Non-RP) !!` | Inspector Output (when Hotkeys active) |
| `2` | Insert `(Fail-RP) !!` | Inspector Output (when Hotkeys active) |
| `3` | Insert `(Provoking) !!` | Inspector Output (when Hotkeys active) |
| `4` | Insert `(GR3.1) !!` | Inspector Output (when Hotkeys active) |
| `5` | Insert `(GR3.2) !!` | Inspector Output (when Hotkeys active) |

---

## 🛠️ Tech Stack

- **Core**: Vanilla HTML5, Modern ECMAScript (ES6+)
- **Styling**: Vanilla CSS3 Custom Properties (Design Tokens, Glassmorphism, CSS Grid & Flexbox)
- **Icons**: Handcrafted SVG Vector Glyphs
- **Storage**: Browser LocalStorage API (Workspace Partitioning)

---

## 👤 Author

Developed with care by **[@ZerroDevs](https://github.com/ZerroDevs)**.

- **GitHub Profile**: [@ZerroDevs](https://github.com/ZerroDevs)
- **Repository**: [multi-checkers](https://github.com/ZerroDevs/multi-checkers)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
