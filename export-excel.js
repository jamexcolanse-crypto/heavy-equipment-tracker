/**
 * El Salvador City Motorpool - Excel Export Module
 * Utilizes SheetJS (xlsx.full.min.js) to generate professional, multi-sheet workbooks.
 * Currency: Philippine Peso (Php)
 */

function formatCurrency(num) {
  return Number(num || 0).toFixed(2);
}

function calculateColWidths(dataRows, headers) {
  const colWidths = headers.map(h => ({ wch: Math.max(h.length, 10) }));
  dataRows.forEach(row => {
    headers.forEach((h, idx) => {
      const val = row[h] != null ? String(row[h]) : "";
      if (val.length > colWidths[idx].wch) {
        colWidths[idx].wch = Math.min(Math.max(val.length + 2, colWidths[idx].wch), 50);
      }
    });
  });
  return colWidths;
}

/**
 * Main Export Function: Creates an all-inclusive, multi-sheet .xlsx workbook for El Salvador City Motorpool
 */
function exportFleetAndMaintenanceToExcel(fleet, logs, customFilename) {
  if (typeof XLSX === "undefined") {
    alert("Excel export library is still loading. Please try again in a few seconds.");
    return;
  }

  const wb = XLSX.utils.book_new();
  const dateStamp = new Date().toISOString().split("T")[0];

  // ==========================================
  // SHEET 1: Maintenance Records
  // ==========================================
  let totalRepairCost = 0;

  const maintenanceData = logs.map(log => {
    const cost = Number(log.repairCost != null ? log.repairCost : (log.totalCost || 0));
    totalRepairCost += cost;

    return {
      "Work Order #": log.id || "",
      "Date": log.date || "",
      "Equipment ID": log.equipmentId || "",
      "Equipment Name": log.equipmentName || "",
      "Meter (Hours)": Number(log.meterHours || 0),
      "Service Type": log.type || "",
      "Priority": log.priority || "Medium",
      "Status": log.status || "Completed",
      "Work Summary": log.workSummary || "",
      "Detailed Procedures": log.workDetails || "",
      "Parts & Materials Used": log.partsUsed || "None",
      "Parts Supplier": log.supplier || "N/A",
      "Repair Cost (Php)": cost,
      "Technician / Contractor": log.technician ? `${log.technician} (${log.contractor || "ESC Motorpool"})` : (log.contractor || "ESC Motorpool"),
      "Next Service (Hours)": log.nextServiceHours != null ? Number(log.nextServiceHours) : "",
      "Next Service Date": log.nextServiceDate || ""
    };
  });

  // Add Summary Total Row
  maintenanceData.push({
    "Work Order #": "TOTAL",
    "Date": `Count: ${logs.length} Work Orders`,
    "Equipment ID": "",
    "Equipment Name": "",
    "Meter (Hours)": "",
    "Service Type": "",
    "Priority": "",
    "Status": "",
    "Work Summary": "",
    "Detailed Procedures": "",
    "Parts & Materials Used": "",
    "Parts Supplier": "",
    "Repair Cost (Php)": Number(totalRepairCost.toFixed(2)),
    "Technician / Contractor": "",
    "Next Service (Hours)": "",
    "Next Service Date": ""
  });

  const wsMaintenance = XLSX.utils.json_to_sheet(maintenanceData);
  const maintenanceHeaders = Object.keys(maintenanceData[0] || {});
  wsMaintenance["!cols"] = calculateColWidths(maintenanceData, maintenanceHeaders);
  XLSX.utils.book_append_sheet(wb, wsMaintenance, "Maintenance Records");

  // ==========================================
  // SHEET 2: Fleet Inventory & Hours
  // ==========================================
  const fleetData = fleet.map(eq => {
    const hours = Number(eq.currentHours || 0);
    const hoursRemaining = eq.nextServiceHours != null ? (eq.nextServiceHours - hours) : "N/A";
    let calculatedStatus = eq.status || "Operational";
    if (typeof hoursRemaining === "number") {
      if (hoursRemaining <= 0) calculatedStatus = "Overdue";
      else if (hoursRemaining <= 50) calculatedStatus = "Due Soon";
    }

    const eqLogs = logs.filter(l => l.equipmentId === eq.id);
    let eqTotalSpend = 0;
    eqLogs.forEach(l => {
      eqTotalSpend += Number(l.repairCost != null ? l.repairCost : (l.totalCost || 0));
    });
    const costPerHour = hours > 0 ? (eqTotalSpend / hours) : 0;

    return {
      "Asset Unit #": eq.id || "",
      "Equipment Name": eq.name || "",
      "Category": eq.type || "",
      "Make": eq.make || "",
      "Model": eq.model || "",
      "Serial / VIN": eq.serialNumber || "",
      "Year": eq.year || "",
      "Current Meter (SMU Hours)": hours,
      "Last Service (Hours)": Number(eq.lastServiceHours || 0),
      "Next Service Due (Hours)": Number(eq.nextServiceHours || 0),
      "Hours Until Due": hoursRemaining,
      "Operational Status": calculatedStatus,
      "Assigned Job Site / Project": eq.siteLocation || "Motorpool Compound",
      "Assigned Operator": eq.assignedOperator || "Unassigned",
      "Last Service Date": eq.lastServiceDate || "",
      "Next Service Date": eq.nextServiceDate || "",
      "Total Work Orders": eqLogs.length,
      "Total Repair Spend (Php)": Number(eqTotalSpend.toFixed(2)),
      "Repair Cost / Op Hour (Php/hr)": Number(costPerHour.toFixed(2)),
      "Notes & Attachments": eq.notes || ""
    };
  });

  const wsFleet = XLSX.utils.json_to_sheet(fleetData);
  const fleetHeaders = Object.keys(fleetData[0] || {});
  wsFleet["!cols"] = calculateColWidths(fleetData, fleetHeaders);
  XLSX.utils.book_append_sheet(wb, wsFleet, "Fleet Inventory");

  // ==========================================
  // SHEET 3: Cost & PM Analytics Summary
  // ==========================================
  const analyticsByMachine = {};
  fleet.forEach(eq => {
    analyticsByMachine[eq.id] = {
      "Asset Unit #": eq.id,
      "Equipment Name": eq.name,
      "Current Hours": eq.currentHours,
      "Total Work Orders": 0,
      "Breakdown Repairs": 0,
      "PM Services": 0,
      "Total Repair Cost (Php)": 0,
      "Repair Cost / Op Hour (Php/hr)": 0
    };
  });

  logs.forEach(log => {
    const eqId = log.equipmentId;
    if (!analyticsByMachine[eqId]) {
      analyticsByMachine[eqId] = {
        "Asset Unit #": eqId,
        "Equipment Name": log.equipmentName || "Unknown",
        "Current Hours": log.meterHours || 0,
        "Total Work Orders": 0,
        "Breakdown Repairs": 0,
        "PM Services": 0,
        "Total Repair Cost (Php)": 0,
        "Repair Cost / Op Hour (Php/hr)": 0
      };
    }
    const item = analyticsByMachine[eqId];
    item["Total Work Orders"]++;
    if (log.type === "Breakdown Repair") item["Breakdown Repairs"]++;
    if (log.type === "PM Service") item["PM Services"]++;
    const c = Number(log.repairCost != null ? log.repairCost : (log.totalCost || 0));
    item["Total Repair Cost (Php)"] += c;
  });

  const machineCostList = Object.values(analyticsByMachine).map(item => {
    const hrs = Number(item["Current Hours"] || 0);
    const costPerHour = hrs > 0 ? (item["Total Repair Cost (Php)"] / hrs) : 0;
    return {
      "Asset Unit #": item["Asset Unit #"],
      "Equipment Name": item["Equipment Name"],
      "Operating Hours": hrs,
      "Total Work Orders": item["Total Work Orders"],
      "Breakdowns": item["Breakdowns"],
      "PM Services": item["PM Services"],
      "Total Repair Spend (Php)": Number(item["Total Repair Cost (Php)"].toFixed(2)),
      "Repair Cost / Operating Hour (Php/hr)": Number(costPerHour.toFixed(2))
    };
  });

  const wsAnalytics = XLSX.utils.json_to_sheet(machineCostList);
  const analyticsHeaders = Object.keys(machineCostList[0] || {});
  wsAnalytics["!cols"] = calculateColWidths(machineCostList, analyticsHeaders);
  XLSX.utils.book_append_sheet(wb, wsAnalytics, "Cost & Analytics Summary");

  // Trigger download
  const filename = customFilename || `El_Salvador_City_Motorpool_Fleet_Report_${dateStamp}.xlsx`;
  XLSX.writeFile(wb, filename);

  return filename;
}

/**
 * Export Fleet Operational Status Overview to Excel (.xlsx)
 */
function exportOverviewStatusToExcel(fleet, logs) {
  if (typeof XLSX === "undefined") {
    alert("Export library is loading. Please try again.");
    return;
  }

  const wb = XLSX.utils.book_new();
  const dateStamp = new Date().toISOString().split("T")[0];

  const overviewRows = fleet.map(eq => {
    const eqLogs = logs.filter(l => l.equipmentId === eq.id);
    let totalSpend = 0;
    eqLogs.forEach(l => {
      totalSpend += Number(l.repairCost != null ? l.repairCost : (l.totalCost || 0));
    });

    const hours = Number(eq.currentHours || 0);
    const hoursRemaining = eq.nextServiceHours != null ? (eq.nextServiceHours - hours) : "N/A";
    const costPerHour = hours > 0 ? (totalSpend / hours) : 0;

    return {
      "Asset Unit #": eq.id || "",
      "Equipment Name": eq.name || "",
      "Category": eq.type || "",
      "Make": eq.make || "",
      "Model": eq.model || "",
      "Serial / VIN": eq.serialNumber || "",
      "Year": eq.year || "",
      "Operational Status": eq.status || "Operational",
      "Current Meter (SMU Hours)": hours,
      "PM Interval (Hours)": eq.pmIntervalHours || 250,
      "Next Service Due (Hours)": eq.nextServiceHours || 0,
      "Hours Until Due": hoursRemaining,
      "Assigned Job Site / Project": eq.siteLocation || "Motorpool Compound",
      "Assigned Operator": eq.assignedOperator || "Unassigned",
      "Last Service Date": eq.lastServiceDate || "",
      "Last Service Hours": eq.lastServiceHours || 0,
      "Total Work Orders": eqLogs.length,
      "Total Repair Spend (Php)": Number(totalSpend.toFixed(2)),
      "Repair Cost / Op Hour (Php/hr)": Number(costPerHour.toFixed(2)),
      "Notes & Attachments": eq.notes || ""
    };
  });

  const ws = XLSX.utils.json_to_sheet(overviewRows);
  const headers = Object.keys(overviewRows[0] || {});
  ws["!cols"] = calculateColWidths(overviewRows, headers);
  XLSX.utils.book_append_sheet(wb, ws, "Fleet Operational Status");

  const filename = `El_Salvador_City_Motorpool_Fleet_Status_${dateStamp}.xlsx`;
  XLSX.writeFile(wb, filename);

  return filename;
}

/**
 * Export Individual Equipment Service & Repair History to Excel (.xlsx)
 */
function exportEquipmentHistoryToExcel(equipment, equipmentLogs) {
  if (typeof XLSX === "undefined") {
    alert("Export library is loading. Please try again.");
    return;
  }

  const wb = XLSX.utils.book_new();
  const dateStamp = new Date().toISOString().split("T")[0];

  // SHEET 1: Machine Service & Repair History
  let totalGrand = 0;

  const historyRows = equipmentLogs.map(log => {
    const cost = Number(log.repairCost != null ? log.repairCost : (log.totalCost || 0));
    totalGrand += cost;

    return {
      "Work Order #": log.id || "",
      "Service Date": log.date || "",
      "Meter (Hours)": Number(log.meterHours || 0),
      "Service Type": log.type || "",
      "Priority": log.priority || "Medium",
      "Status": log.status || "Completed",
      "Work Summary": log.workSummary || "",
      "Work Details": log.workDetails || "",
      "Parts & Materials Replaced": log.partsUsed || "None",
      "Parts Supplier": log.supplier || "N/A",
      "Repair Cost (Php)": cost,
      "Technician / Contractor": log.technician ? `${log.technician} (${log.contractor || "ESC Motorpool"})` : (log.contractor || "ESC Motorpool"),
      "Next Due (Hours)": log.nextServiceHours != null ? Number(log.nextServiceHours) : ""
    };
  });

  // Add Summary Total Row
  historyRows.push({
    "Work Order #": "TOTAL",
    "Service Date": `Count: ${equipmentLogs.length} Services`,
    "Meter (Hours)": "",
    "Service Type": "",
    "Priority": "",
    "Status": "",
    "Work Summary": "",
    "Work Details": "",
    "Parts & Materials Replaced": "",
    "Parts Supplier": "",
    "Repair Cost (Php)": Number(totalGrand.toFixed(2)),
    "Technician / Contractor": "",
    "Next Due (Hours)": ""
  });

  const wsHistory = XLSX.utils.json_to_sheet(historyRows);
  const headers = Object.keys(historyRows[0] || {});
  wsHistory["!cols"] = calculateColWidths(historyRows, headers);
  XLSX.utils.book_append_sheet(wb, wsHistory, "Repair & Service History");

  // SHEET 2: Equipment Profile Specs
  const specData = [
    { "Property": "City Government Unit", "Value": "City Government of El Salvador - Motorpool Division" },
    { "Property": "Asset Unit ID", "Value": equipment.id || "" },
    { "Property": "Equipment Name", "Value": equipment.name || "" },
    { "Property": "Machine Category", "Value": equipment.type || "" },
    { "Property": "Make / Manufacturer", "Value": equipment.make || "" },
    { "Property": "Model", "Value": equipment.model || "" },
    { "Property": "Serial / VIN Number", "Value": equipment.serialNumber || "" },
    { "Property": "Year of Manufacture", "Value": equipment.year || "" },
    { "Property": "Current Operating Hours", "Value": `${Number(equipment.currentHours || 0).toLocaleString()} SMU hrs` },
    { "Property": "Standard PM Interval", "Value": `${equipment.pmIntervalHours || 250} hours` },
    { "Property": "Next Service Due Target", "Value": `${equipment.nextServiceHours || 0} hours` },
    { "Property": "Current Operational Status", "Value": equipment.status || "" },
    { "Property": "Assigned Job Site / Project", "Value": equipment.siteLocation || "" },
    { "Property": "Assigned Operator", "Value": equipment.assignedOperator || "" },
    { "Property": "Total Lifetime Repair Spend", "Value": `Php ${totalGrand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { "Property": "Repair Cost Per Operating Hour", "Value": equipment.currentHours > 0 ? `Php ${(totalGrand / equipment.currentHours).toFixed(2)}/hr` : "Php 0.00/hr" },
    { "Property": "Special Notes & Attachments", "Value": equipment.notes || "" }
  ];

  const wsSpecs = XLSX.utils.json_to_sheet(specData);
  wsSpecs["!cols"] = [{ wch: 32 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, wsSpecs, "Machine Specifications");

  const sanitizedId = (equipment.id || "EQUIPMENT").replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `ESC_${sanitizedId}_Service_History_${dateStamp}.xlsx`;
  XLSX.writeFile(wb, filename);

  return filename;
}

/**
 * Quick CSV Export for Maintenance Records
 */
function exportMaintenanceToCSV(logs, customFilename) {
  if (typeof XLSX === "undefined") {
    alert("Export library is loading. Please try again.");
    return;
  }

  const exportData = logs.map(log => ({
    "Work Order": log.id,
    "Date": log.date,
    "Equipment ID": log.equipmentId,
    "Equipment Name": log.equipmentName,
    "Meter Hours": log.meterHours,
    "Type": log.type,
    "Priority": log.priority,
    "Status": log.status,
    "Work Summary": log.workSummary,
    "Parts Used": log.partsUsed,
    "Parts Supplier": log.supplier || "N/A",
    "Repair Cost (Php)": Number(log.repairCost != null ? log.repairCost : (log.totalCost || 0)),
    "Technician": log.technician
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStamp = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = customFilename || `ESC_Motorpool_Maintenance_Logs_${dateStamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
