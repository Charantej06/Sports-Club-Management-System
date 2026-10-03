"use client";
import { Printer } from "lucide-react";
import { Button } from "./ui/button";
export function PrintButton() { return <Button variant="outline" className="no-print" onClick={() => window.print()}><Printer size={16}/>Print receipt</Button>; }
