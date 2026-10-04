"use client";
import { Printer } from "lucide-react";
import { Button } from "./ui/button";
export function PrintButton({ label = "Print receipt" }: { label?: string }) { return <Button variant="outline" className="no-print" onClick={() => window.print()}><Printer size={16}/>{label}</Button>; }
