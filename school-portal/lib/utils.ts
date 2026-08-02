// lib/utils.ts
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function generateId(prefix = "id"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
}

export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString("en-NG", opts ?? {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + "…" : str;
}

export function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

/** Parse a CSV/TSV line handling quoted commas */
export function parseCSVLine(line: string, delimiter = ","): string[] {
  const cols: string[] = [];
  let cur = ""; let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === delimiter && !inQuote) { cols.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

export function percentage(value: number, total: number, decimals = 1): string {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(decimals)}%`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
