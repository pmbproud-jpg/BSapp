import { Platform, Alert } from "react-native";
import XLSX from "xlsx";

// Dynamically import mobile-only modules
let FileSystemModule: any = null;
let SharingModule: any = null;

async function loadMobileModules() {
  if (Platform.OS !== "web") {
    try {
      FileSystemModule = await import("expo-file-system");
      SharingModule = await import("expo-sharing");
    } catch (e) {
      console.warn("Mobile export modules not available");
    }
  }
}

async function shareMobileFile(uri: string, mimeType: string, title: string) {
  if (!SharingModule) return;
  const isAvailable = await SharingModule.isAvailableAsync();
  if (isAvailable) {
    await SharingModule.shareAsync(uri, { mimeType, dialogTitle: title });
  }
}

/**
 * Export data to Excel (.xlsx) file
 */
export async function exportToExcel(
  data: Record<string, any>[],
  filename: string,
  sheetName: string = "Data"
) {
  try {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    if (Platform.OS === "web") {
      XLSX.writeFile(wb, `${filename}.xlsx`);
      return true;
    } else {
      await loadMobileModules();
      if (!FileSystemModule) return false;
      const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const uri = FileSystemModule.documentDirectory + `${filename}.xlsx`;
      await FileSystemModule.writeAsStringAsync(uri, wbout, {
        encoding: FileSystemModule.EncodingType.Base64,
      });
      await shareMobileFile(uri, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
      return true;
    }
  } catch (error) {
    console.error("Export Excel error:", error);
    return false;
  }
}

/**
 * Export data to CSV
 */
export async function exportToCSV(
  data: Record<string, any>[],
  filename: string
) {
  try {
    if (data.length === 0) return false;

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((h) => {
            const val = row[h] ?? "";
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(",")
      ),
    ];
    const csvContent = csvRows.join("\n");

    if (Platform.OS === "web") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return true;
    } else {
      await loadMobileModules();
      if (!FileSystemModule) return false;
      const uri = FileSystemModule.documentDirectory + `${filename}.csv`;
      await FileSystemModule.writeAsStringAsync(uri, csvContent, {
        encoding: FileSystemModule.EncodingType.UTF8,
      });
      await shareMobileFile(uri, "text/csv", filename);
      return true;
    }
  } catch (error) {
    console.error("Export CSV error:", error);
    return false;
  }
}

/**
 * Generate simple HTML report and trigger print/save as PDF
 */
export async function exportToPDF(
  title: string,
  headers: string[],
  rows: string[][],
  filename: string
) {
  try {
    const tableRows = rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td style="padding:8px;border:1px solid #ddd;">${cell}</td>`).join("")}</tr>`
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
          h1 { color: #2563eb; font-size: 24px; margin-bottom: 4px; }
          .subtitle { color: #64748b; font-size: 14px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background: #2563eb; color: white; padding: 10px 8px; text-align: left; font-size: 13px; }
          td { padding: 8px; border: 1px solid #e2e8f0; font-size: 13px; }
          tr:nth-child(even) { background: #f8fafc; }
          .footer { margin-top: 24px; color: #94a3b8; font-size: 11px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="subtitle">Building Solutions GmbH — ${new Date().toLocaleDateString()}</div>
        <table>
          <thead>
            <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="footer">BSapp v1.0.0 — Generated ${new Date().toLocaleString()}</div>
      </body>
      </html>
    `;

    if (Platform.OS === "web") {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
      }
      return true;
    } else {
      await loadMobileModules();
      if (!FileSystemModule) return false;
      const uri = FileSystemModule.documentDirectory + `${filename}.html`;
      await FileSystemModule.writeAsStringAsync(uri, html, {
        encoding: FileSystemModule.EncodingType.UTF8,
      });
      await shareMobileFile(uri, "text/html", title);
      return true;
    }
  } catch (error) {
    console.error("Export PDF error:", error);
    return false;
  }
}
