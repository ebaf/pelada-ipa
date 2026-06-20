"use client";

import { useEffect, useState } from "react";

// Renderiza uma linha de texto do WhatsApp (*negrito*, _itálico_) como JSX.
function renderLine(line: string, key: number) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*[^*]+\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("*")) parts.push(<b key={i++}>{tok.slice(1, -1)}</b>);
    else parts.push(<i key={i++}>{tok.slice(1, -1)}</i>);
    last = regex.lastIndex;
  }
  if (last < line.length) parts.push(line.slice(last));
  return (
    <div key={key} className="min-h-[1.1em]">
      {parts.length ? parts : " "}
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* cai no fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ShareMatchButton({
  text,
  trigger = "button",
}: {
  text: string;
  trigger?: "button" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);

  useEffect(() => {
    setHasNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

  async function onCopy() {
    const ok = await copyText(text);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  }

  function onNativeShare() {
    navigator.share({ text }).catch(() => {});
    setOpen(false);
  }

  return (
    <>
      {trigger === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted transition-colors hover:text-fg"
          aria-label="Compartilhar resultado"
          title="Compartilhar resultado"
        >
          📤
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm">
          📤 Compartilhar
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 normal-case tracking-normal sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="card w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Compartilhar resultado</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-muted hover:text-fg"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <p className="mt-1 text-xs text-muted">Prévia da mensagem:</p>
            <div className="mt-2 rounded-xl bg-[#0b141a] p-3">
              <div className="ml-auto w-fit max-w-full whitespace-pre-wrap break-words rounded-lg rounded-tr-none bg-[#005c4b] px-3 py-2 text-sm leading-relaxed text-white">
                {text.split("\n").map((l, i) => renderLine(l, i))}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary w-full"
                onClick={() => setOpen(false)}
              >
                💬 Abrir no WhatsApp
              </a>
              <div className={hasNativeShare ? "grid grid-cols-2 gap-2" : ""}>
                <button className="btn btn-ghost w-full" onClick={onCopy}>
                  {copied ? "✓ Copiado!" : "Copiar texto"}
                </button>
                {hasNativeShare && (
                  <button className="btn btn-ghost w-full" onClick={onNativeShare}>
                    Mais opções…
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
