"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

type CopyButtonProps = Omit<ButtonProps, "onClick"> & {
  value: string;
  label?: string;
  copiedLabel?: string;
};

export function CopyButton({ value, label = "Copy", copiedLabel = "Copied", ...props }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button type="button" onClick={handleCopy} {...props}>
      {copied ? copiedLabel : label}
    </Button>
  );
}
