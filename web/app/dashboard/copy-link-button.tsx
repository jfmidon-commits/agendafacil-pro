"use client";

import { useState, useCallback } from "react";

type CopyState = "idle" | "copied" | "error";

export default function CopyLinkButton({ publicUrl }: { publicUrl: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const copy = useCallback(async () => {
    if (copyState === "copied") return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(publicUrl);
        setCopyState("copied");
      } else {
        // Fallback para navegadores sem Clipboard API
        const textarea = document.createElement("textarea");
        textarea.value = publicUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (success) {
          setCopyState("copied");
        } else {
          setCopyState("error");
        }
      }
    } catch {
      setCopyState("error");
    }

    setTimeout(() => setCopyState("idle"), 2000);
  }, [publicUrl, copyState]);

  const label =
    copyState === "copied"
      ? "Link copiado!"
      : copyState === "error"
      ? "Não foi possível copiar"
      : "Copiar link";

  return (
    <button
      type="button"
      className="secondary"
      onClick={copy}
      disabled={copyState === "copied"}
      aria-live="polite"
      aria-label={label}
      style={{ minWidth: 120, touchAction: "manipulation" }}
    >
      {label}
    </button>
  );
}
