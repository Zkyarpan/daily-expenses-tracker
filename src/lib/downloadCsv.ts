/**
 * src/lib/downloadCsv.ts
 *
 * Triggers a browser download of CSV text. A UTF-8 byte-order mark is added
 * so Excel opens the file as UTF-8 (otherwise "£" and accented merchant names
 * are garbled). The file is generated entirely in the browser from data the
 * signed-in user already has on screen — nothing is uploaded.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke after the click has been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
