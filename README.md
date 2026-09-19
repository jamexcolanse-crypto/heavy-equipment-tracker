# El Salvador City Motorpool 🚜

### Heavy Equipment Fleet & Maintenance Management System
**City Engineering Office &bull; City Motorpool Division &bull; El Salvador City, Misamis Oriental**
*Featuring Multi-Sheet Excel (`.xlsx`) Export, Hour Meter PM Tracking, Philippine Peso (Php) Cost Tracking, and Light Mode Interface*

---

## 🌟 Key Features

1. **Municipal Heavy Equipment Fleet Registry**
   - Manage excavators, crawler bulldozers, wheel loaders, articulated haulers, mobile telescopic cranes, motor graders, and track loaders (`ESC-EQ-001` through `ESC-EQ-007`).
   - Track Asset ID, Make, Model, Serial/VIN Number, Year, Current Operating Hours (SMU), Project Site Location (e.g. Barangay Molugan Coastal Dike, Barangay Cogon, Poblacion, Taytay), and Assigned Operator.
   - Real-time operational status indicators: `OPERATIONAL`, `DUE SOON`, `OVERDUE PM`, and `IN SHOP / REPAIR`.

2. **Maintenance Work Orders & Repair Cost Tracking**
   - Log **Preventive Maintenance (PM)**, **Breakdown Repairs**, **Routine Inspections**, and **Safety/Load Certifications**.
   - Streamlined financial accounting: directly tracks **Repair Cost (Php)** in **Philippine Pesos**, eliminating complex labor-hour calculations while retaining complete records of replacement parts and consumables.
   - Fast, multi-criteria search across Work Orders, Equipment IDs, Mechanics, and Parts.
   - Filters by Service Type, Work Order Status, and Specific Machine.

3. **Preventive Maintenance (PM) Alert Center**
   - Automated monitoring of engine hours (SMU) against recommended PM cycles (250h, 500h, 1000h).
   - Visual progress bars showing percentage elapsed towards the next PM service.
   - Dynamic alerts for impending service (within 50h) and overdue machines requiring immediate workshop intake.

4. **Multi-Sheet Excel (`.xlsx`) Export Engine**
   - Generates comprehensive, styled multi-tab Microsoft Excel (`.xlsx`) workbooks offline via bundled SheetJS:
     - **Sheet 1: `Maintenance Records`** — Complete service order history with dates, hours, parts used, repair costs (Php), and mechanic notes.
     - **Sheet 2: `Fleet Inventory`** — Machinery specifications, serial numbers, current meter readings, next service targets, and project sites.
     - **Sheet 3: `Cost & Analytics Summary`** — Financial summary by machine (total repair spend in Php, breakdown vs PM ratio, and cost per operating hour).
   - Also provides one-click CSV export and dedicated Equipment History Excel exports.

5. **Printable Work Order Cards & Equipment Dossiers**
   - Generates clean, printer-friendly work order sheets with technician and City Engineer approval sign-off blocks.

6. **100% Client-Side, Offline & Zero Setup**
   - Runs directly in Google Chrome or Microsoft Edge without Node.js, Python, or local web servers.
   - Bundles all dependencies offline (`xlsx.full.min.js`, `chart.umd.min.js`).
   - Stores data in browser `localStorage` with full JSON Backup and Restore support.

---

## 🚀 Quick Start

1. Double-click **`Launch-App.bat`** or open **`index.html`** in Google Chrome.
2. Explore the preloaded municipal fleet for El Salvador City.
3. Click the green **"Export to Excel (.xlsx)"** button in the top right to generate a complete municipal maintenance workbook.
4. Use **"Log Maintenance"** to record new work orders with direct **Repair Cost (Php)**.

---

## 📁 File Structure

```
heavy-equipment-maintenance/
├── index.html           # Main dashboard interface, light mode layout, and modals
├── app.js               # Application state, PM calculator, filters, and Php formatting
├── style.css            # Light mode theme stylesheet, print formatting, and status badges
├── export-excel.js      # SheetJS multi-sheet Excel generator (.xlsx)
├── demo-data.js         # El Salvador City Motorpool demo fleet and maintenance logs
├── Launch-App.bat       # 1-click Windows launcher
└── vendor/
    ├── xlsx.full.min.js # SheetJS library (bundled offline)
    └── chart.umd.min.js # Chart.js library (bundled offline)
```
"# heavy-equipment-tracker" 
"# heavy-equipment-tracker" 
"# heavy-equipment-tracker" 
