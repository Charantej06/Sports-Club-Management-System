"use client";
import { useEffect, useId, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "./ui/button";

export type PromptOptions = {
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  minLength?: number;
  confirmLabel?: string;
  multiline?: boolean;
};
type Open = (options: PromptOptions, resolve: (value: string | null) => void) => void;
let open: Open | null = null;

/** Asks for a line of text in an accessible in-app dialog. Resolves to the trimmed text, or null if dismissed. */
export function promptText(options: PromptOptions) {
  return new Promise<string | null>((resolve) => {
    if (!open) return resolve(window.prompt(options.label)?.trim() || null);
    open(options, resolve);
  });
}

/** Mount once near the app root; it renders the dialog that promptText opens. */
export function PromptHost() {
  const [state, setState] = useState<{ options: PromptOptions; resolve: (value: string | null) => void } | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  useEffect(() => {
    open = (options, resolve) => {
      setValue("");
      setState({ options, resolve });
    };
    return () => {
      open = null;
    };
  }, []);
  const close = (result: string | null) => {
    state?.resolve(result);
    setState(null);
  };
  const min = state?.options.minLength ?? 1;
  const valid = value.trim().length >= min;
  return (
    <Dialog.Root open={!!state} onOpenChange={(next) => !next && close(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutral-200 bg-white p-6 text-neutral-900 shadow-xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="pr-8 text-lg font-semibold tracking-tight">{state?.options.title}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-neutral-600">
            {state?.options.description ?? "This is saved in the audit history."}
          </Dialog.Description>
          <Dialog.Close aria-label="Close" className="absolute right-4 top-4 rounded p-1 text-neutral-500 hover:bg-neutral-100">
            <X size={18} />
          </Dialog.Close>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (valid) close(value.trim());
            }}
          >
            <div>
              <label htmlFor={fieldId} className="text-sm font-medium text-neutral-800">
                {state?.options.label}
              </label>
              <textarea
                id={fieldId}
                ref={inputRef}
                rows={state?.options.multiline ? 4 : 2}
                value={value}
                maxLength={300}
                placeholder={state?.options.placeholder}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (valid) close(value.trim());
                  }
                }}
                className="mt-2 block w-full rounded-md !border !border-neutral-300 !bg-white !p-3 text-sm !text-neutral-900 outline-none focus:!border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
              <p className="mt-1 text-xs text-neutral-500">
                {valid || !value ? `At least ${min} characters.` : `${min - value.trim().length} more character${min - value.trim().length === 1 ? "" : "s"} needed.`}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" className="border-neutral-300 text-neutral-800 hover:bg-neutral-100" onClick={() => close(null)}>
                Go back
              </Button>
              <Button type="submit" disabled={!valid}>
                {state?.options.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
