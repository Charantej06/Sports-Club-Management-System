import * as React from "react";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("flex h-12 w-full rounded-md border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:opacity-50", className)} {...props} />;
}
