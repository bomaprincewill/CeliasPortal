"use client";

import React from "react";
import { cn } from "@/components/ui";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pb-2", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-semibold", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100", className)} {...props} />;
});
export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100", className)} {...props} />;
}
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "destructive" | "ghost" | "link"; size?: "default" | "sm" | "lg" | "icon" };
export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:pointer-events-none disabled:opacity-50", size === "sm" ? "h-9 px-3 text-sm" : size === "lg" ? "h-11 px-6" : size === "icon" ? "h-10 w-10" : "h-10 px-4 text-sm", className, variant === "link" ? "!border-transparent !bg-transparent !text-green-700 hover:!bg-green-50" : "!border-green-700 !bg-green-700 !text-white hover:!border-green-800 hover:!bg-green-800")} {...props} />;
}
