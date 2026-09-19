/**
 * El Salvador City Motorpool - Main Application Controller
 * Handles state management, UI rendering, PM logic, and persistence.
 * Rebranded for El Salvador City Municipal Heavy Equipment Fleet.
 * Currency: Philippine Peso (Php)
 * Cost Model: Direct Repair Cost (Labor Cost removed)
 * Theme: Light Mode
 */

class ESCMotorpoolApp {
  constructor() {
    this.fleet = [];
    this.logs = [];
    this.filteredLogs = [];
    this.activeTab = "overview";
    this.overviewStatusFilter = "all";
    this.currentDetailEquipmentId = null;
    this.currentDetailHistoryFilter = "all";
    this.charts = {
      machineSpend: null,
      typeSpend: null
    };

    this.init();
  }

  init() {
    this.loadData();
    this.initSelects();
    this.setupEventListeners();
    this.updateKPIs();
    this.renderActiveView();
  }

  // ==========================================
  // STORAGE & DATA INITIALIZATION
  // ==========================================
  loadData() {
    try {
      const storedFleet = localStorage.getItem("esc_motorpool_fleet");
      const storedLogs = localStorage.getItem("esc_motorpool_logs");

      if (storedFleet && storedLogs) {
        this.fleet = JSON.parse(storedFleet);
        this.logs = JSON.parse(storedLogs);
      } else {
        // First run or migration: load El Salvador City demo fleet & logs
        this.fleet = JSON.parse(JSON.stringify(DEMO_FLEET));
        this.logs = JSON.parse(JSON.stringify(DEMO_LOGS));
        this.saveData();
      }
    } catch (e) {
      console.error("Failed to read localStorage:", e);
      this.fleet = JSON.parse(JSON.stringify(DEMO_FLEET));
      this.logs = JSON.parse(JSON.stringify(DEMO_LOGS));
    }

    // Ensure all logs have clean repairCost and synchronized totalCost
    this.logs.forEach(log => {
      const cost = Number(log.repairCost != null ? log.repairCost : (log.totalCost || 0));
      log.repairCost = cost;
      log.totalCost = cost;
      delete log.laborHours;
      delete log.laborRatePerHour;
      delete log.laborCost;
      delete log.partsCost;
    });

    this.recalculateAllFleetStatuses();
    this.filteredLogs = [...this.logs];
  }

  saveData() {
    try {
      localStorage.setItem("esc_motorpool_fleet", JSON.stringify(this.fleet));
      localStorage.setItem("esc_motorpool_logs", JSON.stringify(this.logs));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
      this.showToast("Local storage save error: storage might be full", "error");
    }
  }

  recalculateAllFleetStatuses() {
    const today = new Date().toISOString().split("T")[0];

    this.fleet.forEach(eq => {
      if (eq.status === "In Shop" || eq.status === "Grounded") {
        return; // Retain explicit down states
      }

      const hoursLeft = eq.nextServiceHours != null ? (eq.nextServiceHours - eq.currentHours) : 9999;
      const isDateOverdue = eq.nextServiceDate && eq.nextServiceDate < today;

      if (hoursLeft <= 0 || isDateOverdue) {
        eq.status = "Overdue";
      } else if (hoursLeft <= 50) {
        eq.status = "Due Soon";
      } else {
        eq.status = "Operational";
      }
    });
  }

  formatPhp(amount) {
    const val = Number(amount || 0);
    return `Php ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatPhpRound(amount) {
    const val = Math.round(Number(amount || 0));
    return `Php ${val.toLocaleString()}`;
  }

  initSelects() {
    // Populate equipment filter in logs view
    const logEqSelect = document.getElementById("logFilterEquipment");
    if (logEqSelect) {
      const currentVal = logEqSelect.value;
      logEqSelect.innerHTML = '<option value="">All Machines</option>';
      this.fleet.forEach(eq => {
        const opt = document.createElement("option");
        opt.value = eq.id;
        opt.textContent = `${eq.id} - ${eq.name}`;
        logEqSelect.appendChild(opt);
      });
      logEqSelect.value = currentVal;
    }

    // Populate fleet type filter
    const fleetTypeSelect = document.getElementById("fleetFilterType");
    if (fleetTypeSelect) {
      const currentVal = fleetTypeSelect.value;
      fleetTypeSelect.innerHTML = '<option value="">All Equipment Types</option>';
      EQUIPMENT_TYPES_SAFE().forEach(type => {
        const opt = document.createElement("option");
        opt.value = type;
        opt.textContent = type;
        fleetTypeSelect.appendChild(opt);
      });
      fleetTypeSelect.value = currentVal;
    }

    // Populate modal equipment type dropdown
    const modalTypeSelect = document.getElementById("eqFormType");
    if (modalTypeSelect && modalTypeSelect.options.length <= 1) {
      modalTypeSelect.innerHTML = "";
      EQUIPMENT_TYPES_SAFE().forEach(type => {
        const opt = document.createElement("option");
        opt.value = type;
        opt.textContent = type;
        modalTypeSelect.appendChild(opt);
      });
    }

    // Populate modal equipment dropdown in log form
    const logFormEqSelect = document.getElementById("logFormEquipment");
    if (logFormEqSelect) {
      logFormEqSelect.innerHTML = '<option value="">-- Select Heavy Equipment Asset --</option>';
      this.fleet.forEach(eq => {
        const opt = document.createElement("option");
        opt.value = eq.id;
        opt.textContent = `${eq.id} | ${eq.name} (${eq.currentHours} hrs)`;
        logFormEqSelect.appendChild(opt);
      });
    }

    // Populate overview filter type
    const overviewTypeSelect = document.getElementById("overviewFilterType");
    if (overviewTypeSelect) {
      const cur = overviewTypeSelect.value;
      overviewTypeSelect.innerHTML = '<option value="">All Categories</option>';
      EQUIPMENT_TYPES_SAFE().forEach(type => {
        const opt = document.createElement("option");
        opt.value = type;
        opt.textContent = type;
        overviewTypeSelect.appendChild(opt);
      });
      overviewTypeSelect.value = cur;
    }

    // Populate overview filter site
    const overviewSiteSelect = document.getElementById("overviewFilterSite");
    if (overviewSiteSelect) {
      const cur = overviewSiteSelect.value;
      overviewSiteSelect.innerHTML = '<option value="">All Project Sites</option>';
      const sites = Array.from(new Set(this.fleet.map(e => e.siteLocation).filter(Boolean)));
      sites.forEach(site => {
        const opt = document.createElement("option");
        opt.value = site;
        opt.textContent = site;
        overviewSiteSelect.appendChild(opt);
      });
      overviewSiteSelect.value = cur;
    }
  }

  setupEventListeners() {
    // Close modal when clicking outside content
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.classList.remove("active");
        }
      });
    });

    // Close settings dropdown when clicking outside
    document.addEventListener("click", (e) => {
      const settingsContainer = document.getElementById("settingsDropdown");
      const settingsBtn = e.target.closest("button[onclick*='toggleSettingsMenu']");
      if (!settingsBtn && settingsContainer && !settingsContainer.contains(e.target)) {
        settingsContainer.classList.add("hidden");
      }
    });

    // Keyboard Escape to close open modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.active").forEach(m => m.classList.remove("active"));
        const settings = document.getElementById("settingsDropdown");
        if (settings) settings.classList.add("hidden");
      }
    });
  }

  // ==========================================
  // TAB NAVIGATION & RENDERING
  // ==========================================
  switchTab(tab) {
    this.activeTab = tab;

    // Update tab button styles
    ["overview", "logs", "fleet", "pmSchedule", "analytics"].forEach(t => {
      const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
      const view = document.getElementById(`view${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (btn) {
        if (t === tab) btn.classList.add("active");
        else btn.classList.remove("active");
      }
      if (view) {
        if (t === tab) view.classList.remove("hidden");
        else view.classList.add("hidden");
      }
    });

    this.renderActiveView();
  }

  renderActiveView() {
    this.updateKPIs();
    if (this.activeTab === "overview") {
      this.renderOverview();
    } else if (this.activeTab === "logs") {
      this.filterLogs();
    } else if (this.activeTab === "fleet") {
      this.renderFleet();
    } else if (this.activeTab === "pmSchedule") {
      this.renderPMSchedules();
    } else if (this.activeTab === "analytics") {
      this.renderAnalytics();
    }
  }

  updateKPIs() {
    const total = this.fleet.length;
    const operational = this.fleet.filter(e => e.status === "Operational").length;
    const inShop = this.fleet.filter(e => e.status === "In Shop" || e.status === "Grounded").length;
    const alerts = this.fleet.filter(e => e.status === "Overdue" || e.status === "Due Soon").length;

    let totalSpend = 0;
    this.logs.forEach(l => {
      totalSpend += Number(l.repairCost != null ? l.repairCost : (l.totalCost || 0));
    });

    const elTotal = document.getElementById("kpiTotalFleet");
    const elOp = document.getElementById("kpiOperational");
    const elShop = document.getElementById("kpiInShop");
    const elAlerts = document.getElementById("kpiAlerts");
    const elSpend = document.getElementById("kpiTotalSpend");
    const badgeOverview = document.getElementById("tabBadgeOverview");
    const badgeLogs = document.getElementById("tabBadgeLogs");
    const badgeFleet = document.getElementById("tabBadgeFleet");
    const badgeAlerts = document.getElementById("tabBadgeAlerts");

    if (elTotal) elTotal.textContent = total;
    if (elOp) elOp.textContent = operational;
    if (elShop) elShop.textContent = inShop;
    if (elAlerts) elAlerts.textContent = alerts;
    if (elSpend) elSpend.textContent = this.formatPhp(totalSpend);
    if (badgeOverview) badgeOverview.textContent = total;
    if (badgeLogs) badgeLogs.textContent = this.logs.length;
    if (badgeFleet) badgeFleet.textContent = total;
    if (badgeAlerts) badgeAlerts.textContent = alerts;
  }

  // ==========================================
  // TAB 0: EQUIPMENT OPERATIONAL STATUS OVERVIEW
  // ==========================================
  filterOverviewByStatus(status) {
    this.overviewStatusFilter = status;

    const pills = [
      { id: "pillStatusAll", val: "all" },
      { id: "pillStatusOperational", val: "Operational" },
      { id: "pillStatusDueSoon", val: "Due Soon" },
      { id: "pillStatusOverdue", val: "Overdue" },
      { id: "pillStatusInShop", val: "In Shop" },
      { id: "pillStatusGrounded", val: "Grounded" }
    ];

    pills.forEach(p => {
      const el = document.getElementById(p.id);
      if (el) {
        if (p.val === status) {
          el.className = "px-3.5 py-1.5 rounded-lg font-bold bg-amber-100 text-amber-900 border border-amber-400 flex items-center gap-1.5 transition-all shadow-sm";
        } else {
          el.className = "px-3.5 py-1.5 rounded-lg font-semibold bg-white text-slate-700 hover:text-slate-900 border border-slate-300 flex items-center gap-1.5 transition-all";
        }
      }
    });

    this.renderOverview();
  }

  resetOverviewFilters() {
    this.overviewStatusFilter = "all";
    if (document.getElementById("overviewSearchInput")) document.getElementById("overviewSearchInput").value = "";
    if (document.getElementById("overviewFilterType")) document.getElementById("overviewFilterType").value = "";
    if (document.getElementById("overviewFilterSite")) document.getElementById("overviewFilterSite").value = "";
    this.filterOverviewByStatus("all");
  }

  quickChangeEquipmentStatus(equipmentId, newStatus) {
    const eq = this.fleet.find(e => e.id === equipmentId);
    if (!eq) return;

    eq.status = newStatus;
    if (newStatus === "Operational") {
      const hoursLeft = eq.nextServiceHours != null ? (eq.nextServiceHours - eq.currentHours) : 9999;
      if (hoursLeft <= 0) eq.status = "Overdue";
      else if (hoursLeft <= 50) eq.status = "Due Soon";
    }

    this.saveData();
    this.updateKPIs();
    this.showToast(`Updated ${eq.id} status to: ${eq.status}`, "success");
    this.renderActiveView();
  }

  exportOverviewExcel() {
    try {
      const filename = exportOverviewStatusToExcel(this.fleet, this.logs);
      this.showToast(`Exported status overview: ${filename}`, "success");
    } catch (e) {
      console.error(e);
      this.showToast("Failed to export status overview to Excel", "error");
    }
  }

  renderOverview() {
    const search = (document.getElementById("overviewSearchInput")?.value || "").toLowerCase().trim();
    const typeFilter = document.getElementById("overviewFilterType")?.value || "";
    const siteFilter = document.getElementById("overviewFilterSite")?.value || "";

    // Count stats across entire fleet
    const countAll = this.fleet.length;
    const countOp = this.fleet.filter(e => e.status === "Operational").length;
    const countDue = this.fleet.filter(e => e.status === "Due Soon").length;
    const countOver = this.fleet.filter(e => e.status === "Overdue").length;
    const countShop = this.fleet.filter(e => e.status === "In Shop").length;
    const countGrounded = this.fleet.filter(e => e.status === "Grounded").length;

    const elCountAll = document.getElementById("overviewCountAll");
    const elCountOp = document.getElementById("overviewCountOperational");
    const elCountDue = document.getElementById("overviewCountDueSoon");
    const elCountOver = document.getElementById("overviewCountOverdue");
    const elCountShop = document.getElementById("overviewCountInShop");
    const elCountGrounded = document.getElementById("overviewCountGrounded");

    if (elCountAll) elCountAll.textContent = countAll;
    if (elCountOp) elCountOp.textContent = countOp;
    if (elCountDue) elCountDue.textContent = countDue;
    if (elCountOver) elCountOver.textContent = countOver;
    if (elCountShop) elCountShop.textContent = countShop;
    if (elCountGrounded) elCountGrounded.textContent = countGrounded;

    // Filter fleet
    const filtered = this.fleet.filter(eq => {
      if (this.overviewStatusFilter !== "all" && eq.status !== this.overviewStatusFilter) return false;
      if (typeFilter && eq.type !== typeFilter) return false;
      if (siteFilter && eq.siteLocation !== siteFilter) return false;

      if (search) {
        const blob = [
          eq.id,
          eq.name,
          eq.make,
          eq.model,
          eq.serialNumber,
          eq.siteLocation,
          eq.assignedOperator,
          eq.status
        ].join(" ").toLowerCase();
        if (!blob.includes(search)) return false;
      }
      return true;
    });

    const tbody = document.getElementById("overviewTableBody");
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-12 text-slate-500">
            <svg class="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            <p class="text-base font-semibold text-slate-700">No equipment matches the selected operational status or filters</p>
            <p class="text-xs text-slate-500 mt-1">Try resetting the status pill filter or search term</p>
          </td>
        </tr>
      `;
      this.updateOverviewFooter(0, countOp, countOver + countDue + countShop, 0);
      return;
    }

    let totalOpHours = 0;

    tbody.innerHTML = filtered.map(eq => {
      const hours = Number(eq.currentHours || 0);
      totalOpHours += hours;

      const hoursLeft = eq.nextServiceHours != null ? (eq.nextServiceHours - hours) : null;
      let statusBadge = "";
      if (eq.status === "Overdue") {
        statusBadge = `<span class="badge badge-overdue">OVERDUE PM</span>`;
      } else if (eq.status === "Due Soon") {
        statusBadge = `<span class="badge badge-due-soon">DUE SOON</span>`;
      } else if (eq.status === "In Shop") {
        statusBadge = `<span class="badge badge-in-shop">IN SHOP</span>`;
      } else if (eq.status === "Grounded") {
        statusBadge = `<span class="badge bg-slate-200 text-slate-700 border border-slate-300">GROUNDED</span>`;
      } else {
        statusBadge = `<span class="badge badge-operational">OPERATIONAL</span>`;
      }

      // Interval progress
      const interval = eq.pmIntervalHours || 250;
      const hoursSince = eq.lastServiceHours ? (hours - eq.lastServiceHours) : interval;
      const progressPercent = Math.min(Math.max((hoursSince / interval) * 100, 0), 100);

      // Total spend for this unit
      const eqLogs = this.logs.filter(l => l.equipmentId === eq.id);
      let eqSpend = 0;
      eqLogs.forEach(l => { eqSpend += Number(l.repairCost != null ? l.repairCost : (l.totalCost || 0)); });

      return `
        <tr class="hover:bg-slate-50">
          <td class="font-mono text-xs">
            <button onclick="app.openEquipmentDetailModal('${eq.id}')" class="text-left group cursor-pointer" title="Click to open equipment repair history & profile">
              <span class="font-bold text-blue-700 group-hover:text-blue-900 group-hover:underline flex items-center gap-1">
                <span>${eq.id}</span>
                <svg class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              </span>
              <span class="text-[10px] text-slate-500 block mt-0.5">SN: ${eq.serialNumber || 'N/A'}</span>
            </button>
          </td>

          <td>
            <button onclick="app.openEquipmentDetailModal('${eq.id}')" class="text-left group cursor-pointer" title="View details & repair history">
              <strong class="text-slate-900 text-xs group-hover:text-blue-700 group-hover:underline block">${eq.name}</strong>
              <span class="text-[11px] text-slate-500">${eq.make} ${eq.model} &bull; ${eq.year || ''}</span>
            </button>
          </td>

          <td>
            <span class="text-xs text-slate-700 font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">${eq.type}</span>
          </td>

          <td>
            <div class="space-y-1">
              <div>${statusBadge}</div>
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-slate-500">Quick set:</span>
                <select onchange="app.quickChangeEquipmentStatus('${eq.id}', this.value)" class="bg-white border border-slate-300 text-[11px] text-slate-700 rounded px-1.5 py-0.5 focus:border-blue-500 focus:outline-none" title="Quick change operational status">
                  <option value="Operational" ${eq.status === 'Operational' ? 'selected' : ''}>Operational</option>
                  <option value="Due Soon" ${eq.status === 'Due Soon' ? 'selected' : ''}>Due Soon</option>
                  <option value="Overdue" ${eq.status === 'Overdue' ? 'selected' : ''}>Overdue PM</option>
                  <option value="In Shop" ${eq.status === 'In Shop' ? 'selected' : ''}>In Shop / Repair</option>
                  <option value="Grounded" ${eq.status === 'Grounded' ? 'selected' : ''}>Grounded</option>
                </select>
              </div>
            </div>
          </td>

          <td>
            <div class="font-mono text-xs text-slate-900 font-bold">${hours.toLocaleString()} hrs</div>
            <div class="w-24 bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
              <div class="h-1.5 rounded-full ${progressPercent >= 100 ? 'bg-rose-500' : progressPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${progressPercent}%"></div>
            </div>
            <span class="text-[10px] text-slate-500">${interval}h PM cycle</span>
          </td>

          <td class="font-mono text-xs">
            <div class="${hoursLeft != null && hoursLeft <= 0 ? 'text-rose-600 font-bold' : 'text-slate-800'}">
              ${eq.nextServiceHours != null ? eq.nextServiceHours.toLocaleString() + ' hrs' : 'Not set'}
            </div>
            <div class="text-[10px] text-slate-500">
              ${hoursLeft != null ? (hoursLeft <= 0 ? Math.abs(hoursLeft) + 'h overdue!' : hoursLeft + 'h left') : ''}
            </div>
          </td>

          <td class="text-xs text-slate-700">
            <div class="truncate max-w-[170px] font-medium" title="${eq.siteLocation || 'Depot'}">${eq.siteLocation || 'City Motorpool'}</div>
            <div class="text-[11px] text-slate-500">${eq.assignedOperator || 'Unassigned'}</div>
          </td>

          <td class="text-xs text-slate-600 font-medium">${eq.assignedOperator || 'Unassigned'}</td>

          <td class="font-mono text-xs text-right">
            <strong class="text-emerald-700 font-bold">${this.formatPhp(eqSpend)}</strong>
            <span class="text-[10px] text-slate-500 block">${eqLogs.length} WOs</span>
          </td>

          <td class="text-right">
            <div class="flex items-center justify-end gap-1">
              <button onclick="app.openEquipmentDetailModal('${eq.id}')" class="btn-secondary px-2 py-1 rounded text-xs text-blue-700 hover:text-blue-900 border-blue-200 flex items-center gap-1 font-semibold" title="View complete history of repairs & specs">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>
                <span>History</span>
              </button>
              <button onclick="app.openQuickMeterModal('${eq.id}')" class="p-1.5 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100" title="Log Operating Hours">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
              </button>
              <button onclick="app.openNewLogModal('${eq.id}')" class="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100" title="Service This Unit">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    this.updateOverviewFooter(filtered.length, countOp, countOver + countDue + countShop, totalOpHours);
  }

  updateOverviewFooter(count, op, alerts, hours = 0) {
    const elCount = document.getElementById("overviewCountFooter");
    const elOp = document.getElementById("overviewFooterOp");
    const elAlerts = document.getElementById("overviewFooterAlerts");
    const elHours = document.getElementById("overviewFooterHours");

    if (elCount) elCount.textContent = `Showing ${count} of ${this.fleet.length} equipment units`;
    if (elOp) elOp.textContent = op;
    if (elAlerts) elAlerts.textContent = alerts;
    if (elHours) elHours.textContent = `${hours.toLocaleString()} hrs`;
  }

  // ==========================================
  // TAB 1: MAINTENANCE WORK ORDERS LOGIC
  // ==========================================
  filterLogs() {
    const search = (document.getElementById("logSearchInput")?.value || "").toLowerCase().trim();
    const typeFilter = document.getElementById("logFilterType")?.value || "";
    const statusFilter = document.getElementById("logFilterStatus")?.value || "";
    const eqFilter = document.getElementById("logFilterEquipment")?.value || "";

    this.filteredLogs = this.logs.filter(log => {
      if (typeFilter && log.type !== typeFilter) return false;
      if (statusFilter && log.status !== statusFilter) return false;
      if (eqFilter && log.equipmentId !== eqFilter) return false;

      if (search) {
        const textBlob = [
          log.id,
          log.equipmentId,
          log.equipmentName,
          log.type,
          log.workSummary,
          log.workDetails,
          log.technician,
          log.partsUsed,
          log.contractor
        ].join(" ").toLowerCase();
        if (!textBlob.includes(search)) return false;
      }
      return true;
    });

    this.renderLogsTable();
  }

  resetLogFilters() {
    if (document.getElementById("logSearchInput")) document.getElementById("logSearchInput").value = "";
    if (document.getElementById("logFilterType")) document.getElementById("logFilterType").value = "";
    if (document.getElementById("logFilterStatus")) document.getElementById("logFilterStatus").value = "";
    if (document.getElementById("logFilterEquipment")) document.getElementById("logFilterEquipment").value = "";
    this.filterLogs();
  }

  renderLogsTable() {
    const tbody = document.getElementById("logsTableBody");
    if (!tbody) return;

    if (this.filteredLogs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-12 text-slate-500">
            <svg class="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <p class="text-base font-semibold text-slate-700">No maintenance records match your filters</p>
            <p class="text-xs text-slate-500 mt-1">Try resetting search filters or log a new maintenance event</p>
          </td>
        </tr>
      `;
      this.updateLogsFooter(0, 0);
      return;
    }

    let grandTotal = 0;

    const rowsHtml = this.filteredLogs.map(log => {
      const cost = Number(log.repairCost != null ? log.repairCost : (log.totalCost || 0));
      grandTotal += cost;

      const priorityBadgeClass = this.getPriorityBadgeClass(log.priority);
      const statusBadgeClass = this.getStatusBadgeClass(log.status);

      return `
        <tr class="hover:bg-slate-50">
          <td class="font-mono">
            <div class="font-bold text-slate-900 text-xs">${log.id}</div>
            <div class="text-xs text-slate-500">${log.date}</div>
          </td>
          <td>
            <button onclick="app.openEquipmentDetailModal('${log.equipmentId}')" class="text-left group cursor-pointer" title="Click to view full equipment history and specs">
              <div class="font-bold text-blue-700 text-xs group-hover:underline group-hover:text-blue-900 flex items-center gap-1">
                <span>${log.equipmentName}</span>
                <svg class="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-600 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              </div>
              <div class="text-[11px] text-slate-500 font-mono">${log.equipmentId}</div>
            </button>
          </td>
          <td class="font-mono text-xs text-slate-800">
            <strong>${Number(log.meterHours || 0).toLocaleString()}</strong> hrs
          </td>
          <td>
            <div class="text-xs font-semibold text-slate-800">${log.type}</div>
            <span class="badge ${priorityBadgeClass} text-[10px] mt-1">${log.priority || "Medium"}</span>
          </td>
          <td class="max-w-xs">
            <div class="text-xs font-semibold text-slate-900 truncate" title="${this.escapeHtml(log.workSummary)}">
              ${this.escapeHtml(log.workSummary)}
            </div>
            <div class="text-[11px] text-slate-500 truncate mt-0.5" title="${this.escapeHtml(log.partsUsed || 'No parts')}">
              Parts: ${this.escapeHtml(log.partsUsed || "None")}
            </div>
          </td>
          <td class="text-xs text-slate-700">
            <div>${log.technician || "Unassigned"}</div>
            <div class="text-[10px] text-slate-500">${log.contractor || "ESC Motorpool"}</div>
          </td>
          <td class="font-mono text-xs">
            <div class="font-bold text-emerald-700">${this.formatPhp(cost)}</div>
          </td>
          <td>
            <span class="badge ${statusBadgeClass} text-[10px]">${log.status}</span>
          </td>
          <td class="text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="app.viewWorkOrder('${log.id}')" class="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100" title="View & Print Work Order">
                <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clip-rule="evenodd"/></svg>
              </button>
              <button onclick="app.openEditLogModal('${log.id}')" class="p-1.5 text-slate-400 hover:text-sky-600 rounded hover:bg-slate-100" title="Edit Log">
                <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
              </button>
              <button onclick="app.deleteLog('${log.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100" title="Delete Log">
                <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    tbody.innerHTML = rowsHtml;
    this.updateLogsFooter(this.filteredLogs.length, grandTotal);
  }

  updateLogsFooter(count, total) {
    const elCount = document.getElementById("logCountFooter");
    const elTotal = document.getElementById("logFooterTotalCost");

    if (elCount) elCount.textContent = `Showing ${count} of ${this.logs.length} maintenance records`;
    if (elTotal) elTotal.textContent = this.formatPhp(total);
  }

  // ==========================================
  // TAB 2: FLEET INVENTORY LOGIC
  // ==========================================
  renderFleet() {
    const container = document.getElementById("fleetCardsContainer");
    if (!container) return;

    const search = (document.getElementById("fleetSearchInput")?.value || "").toLowerCase().trim();
    const typeFilter = document.getElementById("fleetFilterType")?.value || "";
    const statusFilter = document.getElementById("fleetFilterStatus")?.value || "";

    const filteredFleet = this.fleet.filter(eq => {
      if (typeFilter && eq.type !== typeFilter) return false;
      if (statusFilter && eq.status !== statusFilter) return false;
      if (search) {
        const textBlob = [
          eq.id,
          eq.name,
          eq.make,
          eq.model,
          eq.serialNumber,
          eq.siteLocation,
          eq.assignedOperator
        ].join(" ").toLowerCase();
        if (!textBlob.includes(search)) return false;
      }
      return true;
    });

    if (filteredFleet.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p class="text-base font-semibold text-slate-700">No heavy machinery matches your fleet filters</p>
          <p class="text-xs text-slate-500 mt-1">Try broadening your search or register new equipment</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filteredFleet.map(eq => {
      const hoursLeft = eq.nextServiceHours != null ? (eq.nextServiceHours - eq.currentHours) : null;
      let statusBadge = "";
      if (eq.status === "Overdue") {
        statusBadge = `<span class="badge badge-overdue">OVERDUE PM (${Math.abs(hoursLeft)}h late)</span>`;
      } else if (eq.status === "Due Soon") {
        statusBadge = `<span class="badge badge-due-soon">DUE SOON (${hoursLeft}h left)</span>`;
      } else if (eq.status === "In Shop") {
        statusBadge = `<span class="badge badge-in-shop">IN SHOP / REPAIR</span>`;
      } else {
        statusBadge = `<span class="badge badge-operational">OPERATIONAL</span>`;
      }

      return `
        <div class="kpi-card flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <div onclick="app.openEquipmentDetailModal('${eq.id}')" class="cursor-pointer group flex-1" title="Click to view complete repair history & specs">
                <span class="text-xs font-mono font-bold text-blue-700 group-hover:underline flex items-center gap-1">
                  <span>${eq.id}</span>
                  <svg class="w-3.5 h-3.5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                </span>
                <h4 class="text-base font-bold text-slate-900 group-hover:text-blue-700 leading-tight transition-colors">${eq.name}</h4>
                <span class="text-xs text-slate-500">${eq.make} ${eq.model} &bull; ${eq.year || ""}</span>
              </div>
              <div>${statusBadge}</div>
            </div>

            <!-- Meter Reading Highlight Box -->
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 my-3 flex items-center justify-between">
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Current Operating Hours</span>
                <span class="text-xl font-mono font-black text-slate-900">${Number(eq.currentHours || 0).toLocaleString()} <span class="text-xs font-normal text-slate-500">SMU hrs</span></span>
              </div>
              <button onclick="app.openQuickMeterModal('${eq.id}')" class="btn-secondary px-2.5 py-1 rounded text-xs flex items-center gap-1 font-semibold text-slate-700" title="Update Operating Hours">
                <svg class="w-3.5 h-3.5 text-blue-600 fill-current" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                <span>Log Hours</span>
              </button>
            </div>

            <div class="space-y-1.5 text-xs text-slate-600">
              <div class="flex justify-between">
                <span class="text-slate-500">Project Site:</span>
                <span class="font-medium text-slate-800 text-right truncate max-w-[180px]">${eq.siteLocation || "City Motorpool"}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Assigned Operator:</span>
                <span class="font-medium text-slate-800">${eq.assignedOperator || "Unassigned"}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Serial / VIN:</span>
                <span class="font-mono text-slate-700">${eq.serialNumber || "N/A"}</span>
              </div>
              <div class="flex justify-between pt-1 border-t border-slate-200">
                <span class="text-slate-500">Next Service Target:</span>
                <span class="font-mono font-semibold ${hoursLeft <= 0 ? 'text-rose-600' : 'text-slate-800'}">
                  ${eq.nextServiceHours != null ? eq.nextServiceHours.toLocaleString() + ' hrs' : 'Not set'}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-200">
            <div class="flex items-center gap-1.5">
              <button onclick="app.openEquipmentDetailModal('${eq.id}')" class="btn-secondary px-2.5 py-1.5 rounded text-xs flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 border-blue-200 hover:border-blue-400" title="View Full History of Repairs">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>
                <span>History</span>
              </button>
              <button onclick="app.openNewLogModal('${eq.id}')" class="btn-industrial-primary px-2.5 py-1.5 rounded text-xs flex items-center gap-1 font-semibold">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
                <span>Service</span>
              </button>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="app.openEditEquipmentModal('${eq.id}')" class="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100" title="Edit Specs">
                <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
              </button>
              <button onclick="app.deleteEquipment('${eq.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100" title="Delete Asset">
                <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  // ==========================================
  // TAB 3: PM ALERTS & SCHEDULES LOGIC
  // ==========================================
  renderPMSchedules() {
    const container = document.getElementById("pmAlertsList");
    if (!container) return;

    const sortedFleet = [...this.fleet].sort((a, b) => {
      const order = { "Overdue": 1, "Due Soon": 2, "In Shop": 3, "Operational": 4, "Grounded": 5 };
      return (order[a.status] || 99) - (order[b.status] || 99);
    });

    container.innerHTML = sortedFleet.map(eq => {
      const hoursRemaining = eq.nextServiceHours != null ? (eq.nextServiceHours - eq.currentHours) : null;
      let cardBorder = "border-slate-200 bg-white shadow-sm";
      let statusIndicator = "";

      if (eq.status === "Overdue") {
        cardBorder = "border-rose-300 bg-rose-50/50 shadow-sm";
        statusIndicator = `<span class="badge badge-overdue">CRITICAL PM OVERDUE (${Math.abs(hoursRemaining)}h EXCEEDED)</span>`;
      } else if (eq.status === "Due Soon") {
        cardBorder = "border-amber-300 bg-amber-50/50 shadow-sm";
        statusIndicator = `<span class="badge badge-due-soon">SERVICE IMMINENT (${hoursRemaining}h REMAINING)</span>`;
      } else if (eq.status === "In Shop") {
        cardBorder = "border-purple-300 bg-purple-50/50 shadow-sm";
        statusIndicator = `<span class="badge badge-in-shop">CURRENTLY IN SHOP</span>`;
      } else {
        cardBorder = "border-slate-200 bg-white shadow-sm";
        statusIndicator = `<span class="badge badge-operational">OK (${hoursRemaining}h UNTIL SERVICE)</span>`;
      }

      const interval = eq.pmIntervalHours || 250;
      const hoursSinceLast = eq.lastServiceHours ? (eq.currentHours - eq.lastServiceHours) : interval;
      const progressPercent = Math.min(Math.max((hoursSinceLast / interval) * 100, 0), 100);

      return `
        <div class="border ${cardBorder} p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-3 mb-2">
              <div>
                <span class="text-xs font-mono font-bold text-blue-700">${eq.id}</span>
                <h4 class="text-base font-bold text-slate-900">${eq.name}</h4>
                <p class="text-xs text-slate-500">${eq.siteLocation || "City Motorpool"} &bull; Op: ${eq.assignedOperator || "N/A"}</p>
              </div>
              <div>${statusIndicator}</div>
            </div>

            <!-- Progress Bar towards PM interval -->
            <div class="mt-4 mb-3">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-slate-500">PM Interval Progress (${interval}h cycle)</span>
                <span class="font-mono font-bold ${progressPercent >= 100 ? 'text-rose-600' : 'text-slate-700'}">${Math.round(progressPercent)}%</span>
              </div>
              <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div class="h-2.5 rounded-full ${progressPercent >= 100 ? 'bg-rose-500' : progressPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${progressPercent}%"></div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono">
              <div>
                <span class="text-[10px] text-slate-500 uppercase block">Current Hours</span>
                <strong class="text-slate-900 text-sm">${Number(eq.currentHours).toLocaleString()} hrs</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-500 uppercase block">Next Service Due</span>
                <strong class="${hoursRemaining <= 0 ? 'text-rose-600' : 'text-amber-600'} text-sm">${eq.nextServiceHours ? eq.nextServiceHours.toLocaleString() + ' hrs' : 'N/A'}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-500 uppercase block">Last Service</span>
                <span class="text-slate-700">${eq.lastServiceDate || 'N/A'} (${eq.lastServiceHours || 0}h)</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-500 uppercase block">Due Calendar Date</span>
                <span class="text-slate-700">${eq.nextServiceDate || 'Flexible'}</span>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <button onclick="app.openEquipmentDetailModal('${eq.id}')" class="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1 font-semibold" title="View repair history">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>
                <span>History</span>
              </button>
              <button onclick="app.openQuickMeterModal('${eq.id}')" class="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                <span>Update Meter</span>
              </button>
            </div>
            <button onclick="app.openNewLogModal('${eq.id}')" class="btn-industrial-primary px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1">
              <span>Create Work Order</span>
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  // ==========================================
  // TAB 4: COST & REPAIR ANALYTICS LOGIC
  // ==========================================
  renderAnalytics() {
    if (typeof Chart === "undefined") {
      console.warn("Chart.js is not loaded yet.");
      return;
    }

    const spendByMachine = {};
    const countByMachine = {};
    const breakdownsByMachine = {};
    const pmByMachine = {};

    this.fleet.forEach(eq => {
      spendByMachine[eq.name] = 0;
      countByMachine[eq.id] = 0;
      breakdownsByMachine[eq.id] = 0;
      pmByMachine[eq.id] = 0;
    });

    const spendByType = {};

    this.logs.forEach(log => {
      const cost = Number(log.repairCost != null ? log.repairCost : (log.totalCost || 0));

      const eqName = log.equipmentName || "Other";
      spendByMachine[eqName] = (spendByMachine[eqName] || 0) + cost;

      if (log.equipmentId) {
        countByMachine[log.equipmentId] = (countByMachine[log.equipmentId] || 0) + 1;
        if (log.type === "Breakdown Repair") breakdownsByMachine[log.equipmentId] = (breakdownsByMachine[log.equipmentId] || 0) + 1;
        if (log.type === "PM Service") pmByMachine[log.equipmentId] = (pmByMachine[log.equipmentId] || 0) + 1;
      }

      const type = log.type || "Other";
      spendByType[type] = (spendByType[type] || 0) + cost;
    });

    // Render Chart 1: Bar Chart of Spend by Machine (Light Mode)
    const ctxMachine = document.getElementById("chartMachineSpend");
    if (ctxMachine) {
      if (this.charts.machineSpend) this.charts.machineSpend.destroy();

      const labels = Object.keys(spendByMachine);
      const data = Object.values(spendByMachine);

      this.charts.machineSpend = new Chart(ctxMachine, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{
            label: "Repair Spend (Php)",
            data: data,
            backgroundColor: "#2563eb",
            borderColor: "#1d4ed8",
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` Php ${ctx.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              }
            }
          },
          scales: {
            x: {
              ticks: { color: "#475569", font: { size: 10 } },
              grid: { color: "#f1f5f9" }
            },
            y: {
              ticks: {
                color: "#475569",
                callback: (val) => `Php ${val.toLocaleString()}`
              },
              grid: { color: "#e2e8f0" }
            }
          }
        }
      });
    }

    // Render Chart 2: Doughnut Chart of Spend by Service Type (Light Mode)
    const ctxType = document.getElementById("chartTypeSpend");
    if (ctxType) {
      if (this.charts.typeSpend) this.charts.typeSpend.destroy();

      const typeLabels = Object.keys(spendByType);
      const typeData = Object.values(spendByType);
      const colors = ["#2563eb", "#dc2626", "#059669", "#7c3aed", "#d97706", "#0891b2"];

      this.charts.typeSpend = new Chart(ctxType, {
        type: "doughnut",
        data: {
          labels: typeLabels,
          datasets: [{
            data: typeData,
            backgroundColor: colors.slice(0, typeLabels.length),
            borderColor: "#ffffff",
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
              labels: { color: "#334155", boxWidth: 12, font: { size: 11 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: Php ${ctx.parsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              }
            }
          }
        }
      });
    }

    // Render Analytics Summary Table
    const tbody = document.getElementById("analyticsSummaryTableBody");
    if (tbody) {
      tbody.innerHTML = this.fleet.map(eq => {
        const eqLogs = this.logs.filter(l => l.equipmentId === eq.id);
        let totalEqSpend = 0;
        let bCount = 0;
        let pmCount = 0;

        eqLogs.forEach(l => {
          totalEqSpend += Number(l.repairCost != null ? l.repairCost : (l.totalCost || 0));
          if (l.type === "Breakdown Repair") bCount++;
          if (l.type === "PM Service") pmCount++;
        });

        const hrs = Number(eq.currentHours || 0);
        const costPerHour = hrs > 0 ? (totalEqSpend / hrs) : 0;

        return `
          <tr class="hover:bg-slate-50">
            <td>
              <button onclick="app.openEquipmentDetailModal('${eq.id}')" class="text-left group cursor-pointer" title="View equipment history and specs">
                <strong class="text-slate-900 text-xs group-hover:text-blue-700 group-hover:underline flex items-center gap-1">
                  <span>${eq.name}</span>
                  <svg class="w-3 h-3 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                </strong>
                <div class="text-[11px] text-slate-500 font-mono">${eq.id} &bull; ${eq.type}</div>
              </button>
            </td>
            <td class="font-mono text-xs">${hrs.toLocaleString()} hrs</td>
            <td class="font-mono text-xs font-bold text-center">${eqLogs.length}</td>
            <td class="font-mono text-xs text-rose-600 text-center font-bold">${bCount}</td>
            <td class="font-mono text-xs text-emerald-600 text-center font-bold">${pmCount}</td>
            <td class="font-mono text-xs font-bold text-emerald-700">${this.formatPhp(totalEqSpend)}</td>
            <td class="font-mono text-xs font-bold text-blue-700">${this.formatPhp(costPerHour)}/hr</td>
          </tr>
        `;
      }).join("");
    }
  }

  // ==========================================
  // MODAL & CRUD: MAINTENANCE LOGS
  // ==========================================
  openNewLogModal(prefillEquipmentId = "") {
    document.getElementById("logModalTitle").textContent = "New Maintenance Work Order";
    document.getElementById("logEditId").value = "";
    document.getElementById("logForm").reset();

    const nextNumber = this.logs.length + 1;
    const nextWo = `WO-ESC-2026-${String(nextNumber).padStart(3, "0")}`;
    document.getElementById("logFormId").value = nextWo;
    document.getElementById("logFormDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("logFormRepairCost").value = "";

    if (prefillEquipmentId) {
      document.getElementById("logFormEquipment").value = prefillEquipmentId;
      this.onLogEquipmentSelected();
    }

    this.openModal("logModal");
  }

  openEditLogModal(id) {
    const log = this.logs.find(l => l.id === id);
    if (!log) return;

    const cost = Number(log.repairCost != null ? log.repairCost : (log.totalCost || 0));

    document.getElementById("logModalTitle").textContent = `Edit Work Order: ${log.id}`;
    document.getElementById("logEditId").value = log.id;
    document.getElementById("logFormId").value = log.id;
    document.getElementById("logFormDate").value = log.date || "";
    document.getElementById("logFormMeterHours").value = log.meterHours || "";
    document.getElementById("logFormEquipment").value = log.equipmentId || "";
    document.getElementById("logFormType").value = log.type || "PM Service";
    document.getElementById("logFormPriority").value = log.priority || "Medium";
    document.getElementById("logFormStatus").value = log.status || "Completed";
    document.getElementById("logFormSummary").value = log.workSummary || "";
    document.getElementById("logFormDetails").value = log.workDetails || "";
    document.getElementById("logFormPartsUsed").value = log.partsUsed || "";
    document.getElementById("logFormRepairCost").value = cost > 0 ? cost.toFixed(2) : "";
    document.getElementById("logFormTechnician").value = log.technician || "";
    document.getElementById("logFormContractor").value = log.contractor || "";
    document.getElementById("logFormNextHours").value = log.nextServiceHours || "";
    document.getElementById("logFormNextDate").value = log.nextServiceDate || "";

    this.openModal("logModal");
  }

  onLogEquipmentSelected() {
    const eqId = document.getElementById("logFormEquipment")?.value;
    const eq = this.fleet.find(e => e.id === eqId);
    if (!eq) return;

    const meterInput = document.getElementById("logFormMeterHours");
    if (meterInput && !meterInput.value) {
      meterInput.value = eq.currentHours;
    }

    const interval = eq.pmIntervalHours || 250;
    const nextHours = Number(eq.currentHours || 0) + interval;
    const nextHoursInput = document.getElementById("logFormNextHours");
    if (nextHoursInput && !nextHoursInput.value) {
      nextHoursInput.value = nextHours;
    }
  }

  saveMaintenanceLog(e) {
    e.preventDefault();

    const editId = document.getElementById("logEditId")?.value;
    const woId = document.getElementById("logFormId")?.value.trim();
    const date = document.getElementById("logFormDate")?.value;
    const meterHours = parseInt(document.getElementById("logFormMeterHours")?.value || 0);
    const equipmentId = document.getElementById("logFormEquipment")?.value;
    const type = document.getElementById("logFormType")?.value;
    const priority = document.getElementById("logFormPriority")?.value;
    const status = document.getElementById("logFormStatus")?.value;
    const workSummary = document.getElementById("logFormSummary")?.value.trim();
    const workDetails = document.getElementById("logFormDetails")?.value.trim();
    const partsUsed = document.getElementById("logFormPartsUsed")?.value.trim();
    const repairCost = parseFloat(document.getElementById("logFormRepairCost")?.value || 0);
    const technician = document.getElementById("logFormTechnician")?.value.trim();
    const contractor = document.getElementById("logFormContractor")?.value.trim();
    const nextHours = document.getElementById("logFormNextHours")?.value ? parseInt(document.getElementById("logFormNextHours").value) : null;
    const nextDate = document.getElementById("logFormNextDate")?.value || "";

    const eq = this.fleet.find(e => e.id === equipmentId);
    const equipmentName = eq ? eq.name : "Heavy Machine";

    const logRecord = {
      id: woId,
      equipmentId: equipmentId,
      equipmentName: equipmentName,
      date: date,
      meterHours: meterHours,
      type: type,
      priority: priority,
      status: status,
      workSummary: workSummary,
      workDetails: workDetails,
      partsUsed: partsUsed,
      repairCost: repairCost,
      totalCost: repairCost,
      technician: technician,
      contractor: contractor,
      nextServiceHours: nextHours,
      nextServiceDate: nextDate
    };

    if (editId) {
      const idx = this.logs.findIndex(l => l.id === editId);
      if (idx !== -1) {
        this.logs[idx] = logRecord;
      }
      this.showToast(`Updated Work Order ${woId}`, "success");
    } else {
      this.logs.unshift(logRecord);
      this.showToast(`Created Work Order ${woId}`, "success");
    }

    if (eq) {
      if (meterHours > eq.currentHours) {
        eq.currentHours = meterHours;
      }
      if (status === "Completed") {
        eq.lastServiceHours = meterHours;
        eq.lastServiceDate = date;
        if (nextHours != null) eq.nextServiceHours = nextHours;
        if (nextDate) eq.nextServiceDate = nextDate;
        if (eq.status === "In Shop") eq.status = "Operational";
      } else if (status === "In Progress") {
        eq.status = "In Shop";
      }
    }

    this.recalculateAllFleetStatuses();
    this.saveData();
    this.closeModal("logModal");
    this.renderActiveView();
  }

  deleteLog(id) {
    if (!confirm(`Are you sure you want to delete maintenance record ${id}?`)) return;
    this.logs = this.logs.filter(l => l.id !== id);
    this.saveData();
    this.showToast(`Deleted Work Order ${id}`, "success");
    this.renderActiveView();
  }

  // ==========================================
  // MODAL & CRUD: EQUIPMENT ASSETS
  // ==========================================
  openNewEquipmentModal() {
    document.getElementById("equipmentModalTitle").textContent = "Add Heavy Equipment Asset";
    document.getElementById("equipmentEditId").value = "";
    document.getElementById("equipmentForm").reset();

    const nextId = `ESC-EQ-${String(this.fleet.length + 1).padStart(3, "0")}`;
    document.getElementById("eqFormId").value = nextId;
    document.getElementById("eqFormYear").value = "2022";
    document.getElementById("eqFormPMInterval").value = "250";

    this.openModal("equipmentModal");
  }

  openEditEquipmentModal(id) {
    const eq = this.fleet.find(e => e.id === id);
    if (!eq) return;

    document.getElementById("equipmentModalTitle").textContent = `Edit Equipment: ${eq.name}`;
    document.getElementById("equipmentEditId").value = eq.id;
    document.getElementById("eqFormId").value = eq.id;
    document.getElementById("eqFormName").value = eq.name || "";
    document.getElementById("eqFormType").value = eq.type || "Excavator";
    document.getElementById("eqFormMake").value = eq.make || "";
    document.getElementById("eqFormModel").value = eq.model || "";
    document.getElementById("eqFormSerial").value = eq.serialNumber || "";
    document.getElementById("eqFormYear").value = eq.year || 2022;
    document.getElementById("eqFormCurrentHours").value = eq.currentHours || 0;
    document.getElementById("eqFormPMInterval").value = eq.pmIntervalHours || 250;
    document.getElementById("eqFormNextHours").value = eq.nextServiceHours || "";
    document.getElementById("eqFormLocation").value = eq.siteLocation || "";
    document.getElementById("eqFormOperator").value = eq.assignedOperator || "";
    document.getElementById("eqFormStatus").value = eq.status || "Operational";
    document.getElementById("eqFormNotes").value = eq.notes || "";

    this.openModal("equipmentModal");
  }

  saveEquipment(e) {
    e.preventDefault();

    const editId = document.getElementById("equipmentEditId")?.value;
    const id = document.getElementById("eqFormId")?.value.trim();
    const name = document.getElementById("eqFormName")?.value.trim();
    const type = document.getElementById("eqFormType")?.value;
    const make = document.getElementById("eqFormMake")?.value.trim();
    const model = document.getElementById("eqFormModel")?.value.trim();
    const serial = document.getElementById("eqFormSerial")?.value.trim();
    const year = parseInt(document.getElementById("eqFormYear")?.value || 2022);
    const currentHours = parseInt(document.getElementById("eqFormCurrentHours")?.value || 0);
    const pmInterval = parseInt(document.getElementById("eqFormPMInterval")?.value || 250);
    const nextHours = document.getElementById("eqFormNextHours")?.value ? parseInt(document.getElementById("eqFormNextHours").value) : (currentHours + pmInterval);
    const location = document.getElementById("eqFormLocation")?.value.trim();
    const operator = document.getElementById("eqFormOperator")?.value.trim();
    const status = document.getElementById("eqFormStatus")?.value;
    const notes = document.getElementById("eqFormNotes")?.value.trim();

    const eqData = {
      id: id,
      name: name,
      type: type,
      make: make,
      model: model,
      serialNumber: serial,
      year: year,
      currentHours: currentHours,
      pmIntervalHours: pmInterval,
      nextServiceHours: nextHours,
      siteLocation: location,
      assignedOperator: operator,
      status: status,
      notes: notes
    };

    if (editId) {
      const idx = this.fleet.findIndex(e => e.id === editId);
      if (idx !== -1) {
        this.fleet[idx] = { ...this.fleet[idx], ...eqData };
      }
      this.showToast(`Updated equipment ${id}`, "success");
    } else {
      this.fleet.push(eqData);
      this.showToast(`Added equipment ${id} to fleet`, "success");
    }

    this.recalculateAllFleetStatuses();
    this.saveData();
    this.initSelects();
    this.closeModal("equipmentModal");
    this.renderActiveView();
  }

  deleteEquipment(id) {
    if (!confirm(`Are you sure you want to delete equipment ${id}? This won't delete historical logs.`)) return;
    this.fleet = this.fleet.filter(e => e.id !== id);
    this.saveData();
    this.initSelects();
    this.showToast(`Deleted equipment ${id}`, "success");
    this.renderActiveView();
  }

  // ==========================================
  // QUICK METER HOURS UPDATE
  // ==========================================
  openQuickMeterModal(equipmentId) {
    const eq = this.fleet.find(e => e.id === equipmentId);
    if (!eq) return;

    document.getElementById("quickMeterEquipmentId").value = eq.id;
    document.getElementById("quickMeterSubtitle").textContent = `${eq.id} - ${eq.name}`;
    document.getElementById("quickMeterPrevHours").value = `${eq.currentHours} operating hours`;
    document.getElementById("quickMeterNewHours").value = eq.currentHours;

    this.openModal("quickMeterModal");
  }

  saveQuickMeter(e) {
    e.preventDefault();
    const id = document.getElementById("quickMeterEquipmentId")?.value;
    const newHours = parseInt(document.getElementById("quickMeterNewHours")?.value || 0);

    const eq = this.fleet.find(e => e.id === id);
    if (!eq) return;

    eq.currentHours = newHours;
    this.recalculateAllFleetStatuses();
    this.saveData();
    this.closeModal("quickMeterModal");

    if (eq.status === "Overdue") {
      this.showToast(`⚠️ Meter updated: ${eq.id} is now OVERDUE for PM!`, "error");
    } else if (eq.status === "Due Soon") {
      this.showToast(`🔔 Meter updated: ${eq.id} is due for PM soon!`, "warning");
    } else {
      this.showToast(`Updated meter hours for ${eq.id} (${newHours} hrs)`, "success");
    }

    this.renderActiveView();
  }

  // ==========================================
  // MODAL: EQUIPMENT DETAIL & REPAIR HISTORY
  // ==========================================
  openEquipmentDetailModal(equipmentId) {
    const eq = this.fleet.find(e => e.id === equipmentId);
    if (!eq) return;

    this.currentDetailEquipmentId = equipmentId;
    this.currentDetailHistoryFilter = "all";

    document.getElementById("eqDetailId").textContent = eq.id;
    document.getElementById("eqDetailType").textContent = eq.type || "Heavy Equipment";
    document.getElementById("eqDetailName").textContent = eq.name;
    document.getElementById("eqDetailSubtitle").textContent = `${eq.make} ${eq.model} • Year: ${eq.year || "N/A"} • Serial / VIN: ${eq.serialNumber || "N/A"}`;

    const badgeContainer = document.getElementById("eqDetailStatusBadge");
    if (badgeContainer) {
      const hoursLeft = eq.nextServiceHours != null ? (eq.nextServiceHours - eq.currentHours) : null;
      if (eq.status === "Overdue") {
        badgeContainer.innerHTML = `<span class="badge badge-overdue">OVERDUE PM (${Math.abs(hoursLeft)}h late)</span>`;
      } else if (eq.status === "Due Soon") {
        badgeContainer.innerHTML = `<span class="badge badge-due-soon">DUE SOON (${hoursLeft}h left)</span>`;
      } else if (eq.status === "In Shop") {
        badgeContainer.innerHTML = `<span class="badge badge-in-shop">IN SHOP / REPAIR</span>`;
      } else {
        badgeContainer.innerHTML = `<span class="badge badge-operational">OPERATIONAL</span>`;
      }
    }

    document.getElementById("eqDetailHours").textContent = Number(eq.currentHours || 0).toLocaleString();
    document.getElementById("eqDetailNextDue").textContent = eq.nextServiceHours != null ? Number(eq.nextServiceHours).toLocaleString() : "N/A";
    document.getElementById("eqDetailLocation").textContent = eq.siteLocation || "City Motorpool";
    document.getElementById("eqDetailOperator").textContent = eq.assignedOperator || "Unassigned";
    document.getElementById("eqDetailSerialVal").textContent = eq.serialNumber || "N/A";
    document.getElementById("eqDetailInterval").textContent = `${eq.pmIntervalHours || 250} hrs`;
    document.getElementById("eqDetailLastDate").textContent = eq.lastServiceDate ? `${eq.lastServiceDate} (${eq.lastServiceHours || 0}h)` : "No recorded service";
    document.getElementById("eqDetailNotes").textContent = eq.notes || "None";

    const btnService = document.getElementById("btnEqDetailService");
    if (btnService) {
      btnService.onclick = () => {
        this.closeModal("equipmentDetailModal");
        this.openNewLogModal(eq.id);
      };
    }

    this.filterEquipmentHistory("all");
    this.openModal("equipmentDetailModal");
  }

  filterEquipmentHistory(filterType) {
    this.currentDetailHistoryFilter = filterType;

    const btnAll = document.getElementById("btnHistFilterAll");
    const btnBreakdown = document.getElementById("btnHistFilterBreakdown");
    const btnPM = document.getElementById("btnHistFilterPM");

    if (btnAll) btnAll.className = filterType === "all" ? "px-2.5 py-1 rounded font-semibold bg-amber-100 text-amber-900 border border-amber-400" : "px-2.5 py-1 rounded font-semibold bg-white text-slate-600 hover:text-slate-900 border border-slate-300";
    if (btnBreakdown) btnBreakdown.className = filterType === "Breakdown Repair" ? "px-2.5 py-1 rounded font-semibold bg-rose-100 text-rose-800 border border-rose-300" : "px-2.5 py-1 rounded font-semibold bg-white text-slate-600 hover:text-slate-900 border border-slate-300";
    if (btnPM) btnPM.className = filterType === "PM Service" ? "px-2.5 py-1 rounded font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300" : "px-2.5 py-1 rounded font-semibold bg-white text-slate-600 hover:text-slate-900 border border-slate-300";

    const eqId = this.currentDetailEquipmentId;
    const allEqLogs = this.logs.filter(l => l.equipmentId === eqId);

    let totalSpend = 0;
    let breakdownCount = 0;
    allEqLogs.forEach(l => {
      totalSpend += Number(l.repairCost != null ? l.repairCost : (l.totalCost || 0));
      if (l.type === "Breakdown Repair") breakdownCount++;
    });

    const eq = this.fleet.find(e => e.id === eqId);
    const hrs = Number(eq?.currentHours || 0);
    const costPerHour = hrs > 0 ? (totalSpend / hrs) : 0;

    document.getElementById("eqDetailTotalServices").textContent = allEqLogs.length;
    document.getElementById("eqDetailBreakdowns").textContent = breakdownCount;
    document.getElementById("eqDetailLifetimeSpend").textContent = this.formatPhp(totalSpend);
    document.getElementById("eqDetailCostPerHour").textContent = `${this.formatPhp(costPerHour)}/hr`;

    let displayLogs = allEqLogs;
    if (filterType !== "all") {
      displayLogs = allEqLogs.filter(l => l.type === filterType);
    }

    displayLogs.sort((a, b) => (b.meterHours || 0) - (a.meterHours || 0));

    const countBadge = document.getElementById("eqDetailHistoryCount");
    if (countBadge) countBadge.textContent = `${displayLogs.length} events`;

    const tbody = document.getElementById("eqDetailHistoryTableBody");
    if (!tbody) return;

    if (displayLogs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-8 text-slate-500 text-xs">
            No maintenance or repair records match this filter for this equipment.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = displayLogs.map(log => {
      const cost = Number(log.repairCost != null ? log.repairCost : (log.totalCost || 0));
      const priorityClass = this.getPriorityBadgeClass(log.priority);
      const statusClass = this.getStatusBadgeClass(log.status);

      return `
        <tr class="hover:bg-slate-50">
          <td class="font-mono text-xs">
            <div class="font-bold text-slate-900">${log.id}</div>
            <div class="text-[11px] text-slate-500">${log.date}</div>
          </td>
          <td class="font-mono text-xs text-slate-800">
            <strong>${Number(log.meterHours || 0).toLocaleString()}</strong>h
          </td>
          <td>
            <div class="text-xs font-semibold text-slate-800">${log.type}</div>
            <span class="badge ${priorityClass} text-[10px] mt-0.5">${log.priority}</span>
          </td>
          <td class="max-w-xs text-xs">
            <div class="font-semibold text-slate-900">${this.escapeHtml(log.workSummary)}</div>
            <div class="text-[11px] text-slate-500 mt-0.5 line-clamp-2">${this.escapeHtml(log.workDetails || "")}</div>
          </td>
          <td class="text-xs text-slate-600 font-mono text-[11px] max-w-[150px] truncate" title="${this.escapeHtml(log.partsUsed || 'None')}">
            ${this.escapeHtml(log.partsUsed || "None")}
          </td>
          <td class="text-xs text-slate-700 text-[11px]">
            <div>${log.technician || "Unassigned"}</div>
            <div class="text-slate-500 text-[10px]">${log.contractor || "ESC Motorpool"}</div>
          </td>
          <td class="font-mono text-xs">
            <strong class="text-emerald-700">${this.formatPhp(cost)}</strong>
          </td>
          <td>
            <span class="badge ${statusClass} text-[10px]">${log.status}</span>
          </td>
          <td class="text-right">
            <button onclick="app.viewWorkOrder('${log.id}')" class="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100" title="View Work Order Ticket">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clip-rule="evenodd"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  exportCurrentEquipmentExcel() {
    const eq = this.fleet.find(e => e.id === this.currentDetailEquipmentId);
    if (!eq) return;
    const eqLogs = this.logs.filter(l => l.equipmentId === eq.id);

    try {
      const filename = exportEquipmentHistoryToExcel(eq, eqLogs);
      this.showToast(`Exported history for ${eq.id}: ${filename}`, "success");
    } catch (e) {
      console.error(e);
      this.showToast("Failed to export equipment history to Excel", "error");
    }
  }

  printEquipmentDossier() {
    window.print();
  }

  // ==========================================
  // PRINTABLE WORK ORDER / CARD
  // ==========================================
  viewWorkOrder(id) {
    const log = this.logs.find(l => l.id === id);
    if (!log) return;

    const cost = Number(log.repairCost != null ? log.repairCost : (log.totalCost || 0));
    const eq = this.fleet.find(e => e.id === log.equipmentId) || {};
    const titleEl = document.getElementById("printModalWoNumber");
    if (titleEl) titleEl.textContent = log.id;

    const content = document.getElementById("printSheetContent");
    if (!content) return;

    content.innerHTML = `
      <div class="border-b-2 border-slate-300 pb-4">
        <div class="flex justify-between items-start">
          <div>
            <h2 class="text-2xl font-black tracking-wider text-blue-900">EL SALVADOR CITY MOTORPOOL</h2>
            <p class="text-xs text-slate-500 font-mono font-bold">CITY ENGINEERING OFFICE &bull; HEAVY EQUIPMENT MAINTENANCE TICKET</p>
          </div>
          <div class="text-right">
            <span class="text-xs text-slate-500 font-mono block">WORK ORDER NO.</span>
            <span class="text-xl font-mono font-black text-slate-900">${log.id}</span>
          </div>
        </div>
      </div>

      <!-- Equipment & Service Specifications -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono">
        <div>
          <span class="text-slate-500 block text-[10px] uppercase">Equipment Name</span>
          <strong class="text-slate-900 text-sm">${log.equipmentName}</strong>
        </div>
        <div>
          <span class="text-slate-500 block text-[10px] uppercase">Asset Unit ID</span>
          <strong class="text-blue-700 text-sm">${log.equipmentId}</strong>
        </div>
        <div>
          <span class="text-slate-500 block text-[10px] uppercase">Operating Meter</span>
          <strong class="text-slate-900 text-sm">${Number(log.meterHours || 0).toLocaleString()} hrs</strong>
        </div>
        <div>
          <span class="text-slate-500 block text-[10px] uppercase">Service Date</span>
          <strong class="text-slate-900 text-sm">${log.date}</strong>
        </div>
        <div>
          <span class="text-slate-500 block text-[10px] uppercase">Service Type</span>
          <span class="text-slate-800 font-bold">${log.type}</span>
        </div>
        <div>
          <span class="text-slate-500 block text-[10px] uppercase">Priority</span>
          <span class="text-slate-800 font-bold">${log.priority}</span>
        </div>
        <div>
          <span class="text-slate-500 block text-[10px] uppercase">Project Site Location</span>
          <span class="text-slate-800">${eq.siteLocation || "City Motorpool"}</span>
        </div>
        <div>
          <span class="text-slate-500 block text-[10px] uppercase">Assigned Operator</span>
          <span class="text-slate-800">${eq.assignedOperator || "N/A"}</span>
        </div>
      </div>

      <!-- Work Summary & Scope -->
      <div>
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Work Scope & Diagnostic Summary</h4>
        <div class="p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 font-medium">
          ${this.escapeHtml(log.workSummary)}
        </div>
      </div>

      <!-- Detailed Procedures -->
      <div>
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Detailed Technical Procedures Performed</h4>
        <div class="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 whitespace-pre-wrap font-sans">
          ${this.escapeHtml(log.workDetails || "Routine maintenance performed as per municipal equipment standards and manufacturer service manual.")}
        </div>
      </div>

      <!-- Parts & Materials -->
      <div>
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Replaced Parts, Oils & Consumables</h4>
        <div class="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 font-mono">
          ${this.escapeHtml(log.partsUsed || "None recorded")}
        </div>
      </div>

      <!-- Repair Cost Summary (Labor Cost Removed) -->
      <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap justify-between items-center text-xs">
        <div>
          <span class="text-slate-600">Assigned Technician:</span> <strong class="text-slate-900">${log.technician || "City Motorpool Mechanic"}</strong>
          <span class="text-slate-500 ml-2">(${log.contractor || "El Salvador City Motorpool"})</span>
        </div>
        <div class="font-mono flex items-center gap-2">
          <span class="text-slate-600 font-bold uppercase">Total Repair Cost:</span>
          <strong class="text-blue-900 text-base font-bold">${this.formatPhp(cost)}</strong>
        </div>
      </div>

      <!-- Sign-Off Block for Field Mechanics & City Engineers -->
      <div class="pt-6 border-t border-dashed border-slate-300 grid grid-cols-2 gap-8 text-xs font-mono">
        <div>
          <div class="border-b border-slate-400 pb-8 text-slate-600">Lead Mechanic / Service In-Charge Signature:</div>
          <span class="text-[10px] text-slate-500 mt-1 block">Date Signed: _______________</span>
        </div>
        <div>
          <div class="border-b border-slate-400 pb-8 text-slate-600">City Engineer / Motorpool Head Approval:</div>
          <span class="text-[10px] text-slate-500 mt-1 block">Date Signed: _______________</span>
        </div>
      </div>
    `;

    this.openModal("workOrderModal");
  }

  // ==========================================
  // EXCEL EXPORT INTEGRATION
  // ==========================================
  exportFullExcelReport() {
    try {
      const filename = exportFleetAndMaintenanceToExcel(this.fleet, this.logs);
      this.showToast(`Exported multi-sheet Excel: ${filename}`, "success");
    } catch (e) {
      console.error("Excel export error:", e);
      this.showToast("Failed to generate Excel file: " + e.message, "error");
    }
  }

  exportCurrentFilteredToCSV() {
    try {
      exportMaintenanceToCSV(this.filteredLogs);
      this.showToast(`Exported ${this.filteredLogs.length} records to CSV`, "success");
    } catch (e) {
      console.error("CSV export error:", e);
      this.showToast("CSV export failed", "error");
    }
  }

  // ==========================================
  // DATABASE BACKUP & RESTORE
  // ==========================================
  toggleSettingsMenu() {
    const el = document.getElementById("settingsDropdown");
    if (el) el.classList.toggle("hidden");
  }

  backupDatabaseJSON() {
    const backupData = {
      app: "El Salvador City Motorpool",
      version: "2.0",
      exportDate: new Date().toISOString(),
      fleet: this.fleet,
      logs: this.logs
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStamp = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `ESC_Motorpool_Database_Backup_${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast("Motorpool database backup saved as JSON", "success");
    const settings = document.getElementById("settingsDropdown");
    if (settings) settings.classList.add("hidden");
  }

  restoreDatabaseJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed.fleet) && Array.isArray(parsed.logs)) {
          this.fleet = parsed.fleet;
          this.logs = parsed.logs;
          this.saveData();
          this.initSelects();
          this.recalculateAllFleetStatuses();
          this.renderActiveView();
          this.showToast("Database restored successfully!", "success");
        } else {
          alert("Invalid backup file structure: missing fleet or logs array.");
        }
      } catch (err) {
        alert("Failed to parse JSON backup file: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
    const settings = document.getElementById("settingsDropdown");
    if (settings) settings.classList.add("hidden");
  }

  resetToDemoData() {
    if (!confirm("Reset database to El Salvador City Motorpool demo fleet and maintenance records? Any newly added data will be replaced.")) return;
    this.fleet = JSON.parse(JSON.stringify(DEMO_FLEET));
    this.logs = JSON.parse(JSON.stringify(DEMO_LOGS));
    this.saveData();
    this.initSelects();
    this.recalculateAllFleetStatuses();
    this.renderActiveView();
    this.showToast("Database reset to El Salvador City Motorpool demo fleet", "success");
    const settings = document.getElementById("settingsDropdown");
    if (settings) settings.classList.add("hidden");
  }

  // ==========================================
  // MODAL & UTILITY HELPERS
  // ==========================================
  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("active");
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("active");
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type === "success" ? "toast-success" : type === "error" ? "toast-error" : ""}`;
    toast.innerHTML = `<span>${this.escapeHtml(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  getPriorityBadgeClass(priority) {
    switch (priority) {
      case "Urgent": return "badge-priority-urgent";
      case "High": return "badge-priority-high";
      case "Medium": return "badge-priority-medium";
      default: return "badge-priority-low";
    }
  }

  getStatusBadgeClass(status) {
    switch (status) {
      case "Completed": return "badge-operational";
      case "In Progress": return "badge-due-soon";
      case "Waiting on Parts": return "badge-in-shop";
      default: return "badge-priority-low";
    }
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

function EQUIPMENT_TYPES_SAFE() {
  return typeof EQUIPMENT_TYPES !== "undefined" ? EQUIPMENT_TYPES : [
    "Excavator", "Bulldozer", "Wheel Loader", "Haul Truck", "Mobile Crane", "Motor Grader", "Other"
  ];
}

// Global App Instance Initialization
let app = null;
window.addEventListener("DOMContentLoaded", () => {
  app = new ESCMotorpoolApp();
  window.app = app;
});
