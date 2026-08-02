"use client";
import { Printer } from "lucide-react";
export default function PrintButton() { return <button onClick={() => window.print()} className="btn-primary btn-sm gap-2"><Printer className="h-3.5 w-3.5"/>Print</button>; }
