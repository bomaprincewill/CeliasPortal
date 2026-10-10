export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return "\uFEFF" + rows.map(row => row.map(value => {
    let cell = String(value ?? "");
    if (typeof value === "string" && (/^\s*[=+\-@]/.test(cell) || /^[\t\r\n]/.test(cell))) cell = "'" + cell;
    return `"${cell.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
}
