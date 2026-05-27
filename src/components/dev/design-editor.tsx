"use client";

/**
 * Local-only visual design editor. Floating "✏️ Edit" toggle in the bottom-
 * right; while toggled on, every text-bearing element shows an outline on
 * hover and opens a properties panel when clicked. Edits apply via inline
 * styles, persist to localStorage (per-browser, never synced), and the
 * whole module is dead-code-eliminated from production via NODE_ENV.
 *
 * - Text controls:    content, color, font family, size, weight, italic,
 *                     underline, uppercase, letter-spacing, line-height
 * - Spacing controls: padding (T/R/B/L), margin (T/R/B/L)
 * - Persistence:      localStorage["wavivi:design-overrides"], keyed by
 *                     stable DOM-path fingerprint
 * - Export:           "Copy CSS" button dumps the current overrides as
 *                     selectors + rules you can paste into source
 */

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "wavivi:design-overrides";
const ENABLED_KEY = "wavivi:design-editor-enabled";
const OUTLINE_CLASS = "wv-design-hover-outline";
const SELECTED_CLASS = "wv-design-selected-outline";

type Overrides = Record<string, Record<string, string>>;

const FONTS: { label: string; value: string }[] = [
  { label: "Body (Quicksand)", value: "var(--font-body), sans-serif" },
  {
    label: "Handwriting (Reenie Beanie)",
    value: "var(--font-handwriting), cursive",
  },
  { label: "Marker (Permanent Marker)", value: "var(--font-marker), serif" },
  { label: "Mono (Geist Mono)", value: "var(--font-mono), monospace" },
];

const COLORS: { label: string; value: string }[] = [
  { label: "Foreground", value: "var(--foreground)" },
  { label: "Accent (terracotta)", value: "var(--accent-glow)" },
  { label: "Heat", value: "var(--accent-heat)" },
  { label: "Cool", value: "var(--accent-cool)" },
  { label: "Muted", value: "var(--muted)" },
  { label: "Surface", value: "var(--surface)" },
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
];

/** Build a stable-ish DOM path so we can re-apply overrides after reload. */
function fingerprintOf(el: Element): string {
  const path: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body) {
    const parent: HTMLElement | null = cur.parentElement;
    if (!parent) break;
    const tagName = cur.tagName;
    const siblings: Element[] = Array.from(parent.children).filter(
      (s: Element) => s.tagName === tagName,
    );
    const idx = siblings.indexOf(cur);
    const id = cur.id ? `#${cur.id}` : "";
    path.unshift(`${tagName.toLowerCase()}${id}:${idx}`);
    cur = parent;
  }
  return path.join(">");
}

/** Walk the DOM body and find the element matching the given fingerprint. */
function findByFingerprint(fp: string): HTMLElement | null {
  const parts = fp.split(">");
  let cur: Element | null = document.body;
  for (const part of parts) {
    if (!cur) return null;
    const m = part.match(/^([a-z0-9-]+)(?:#([\w-]+))?:(\d+)$/);
    if (!m) return null;
    const [, tag, , idxStr] = m;
    const idx = Number(idxStr);
    const matches: Element[] = Array.from(cur.children).filter(
      (c: Element) => c.tagName.toLowerCase() === tag,
    );
    cur = matches[idx] ?? null;
  }
  return cur instanceof HTMLElement ? cur : null;
}

function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
}
function saveOverrides(o: Overrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

function applyToElement(el: HTMLElement, styles: Record<string, string>) {
  for (const [k, v] of Object.entries(styles)) {
    if (k === "textContent") {
      el.textContent = v;
    } else {
      el.style.setProperty(k, v);
    }
  }
}

function clearFromElement(el: HTMLElement, styleKeys: string[]) {
  for (const k of styleKeys) {
    if (k !== "textContent") el.style.removeProperty(k);
  }
}

export function DesignEditor() {
  // Hard gate: never renders in production. Next.js evaluates this
  // statically per environment so the whole component tree-shakes out
  // of the production bundle.
  if (process.env.NODE_ENV === "production") return null;
  return <DesignEditorInner />;
}

function DesignEditorInner() {
  const [enabled, setEnabled] = useState(false);
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const overridesRef = useRef<Overrides>({});
  const lastHoverRef = useRef<HTMLElement | null>(null);

  // Bootstrap — load persisted overrides and apply, restore enabled flag.
  useEffect(() => {
    overridesRef.current = loadOverrides();
    // Apply all persisted overrides to whatever's in the DOM now.
    requestAnimationFrame(() => {
      for (const [fp, styles] of Object.entries(overridesRef.current)) {
        const el = findByFingerprint(fp);
        if (el) applyToElement(el, styles);
      }
    });
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- bootstrap state from localStorage on mount
      setEnabled(localStorage.getItem(ENABLED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  // Toggle persisted enabled flag.
  useEffect(() => {
    try {
      localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!enabled) {
      if (lastHoverRef.current)
        lastHoverRef.current.classList.remove(OUTLINE_CLASS);
      if (selected) selected.classList.remove(SELECTED_CLASS);
    }
  }, [enabled, selected]);

  // Click-to-select + hover outline only while enabled.
  useEffect(() => {
    if (!enabled) return;

    function isEditorChrome(el: Element | null): boolean {
      while (el && el !== document.body) {
        if ((el as HTMLElement).dataset?.wvDesignChrome === "1") return true;
        el = el.parentElement;
      }
      return false;
    }

    function onMove(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t || isEditorChrome(t)) return;
      if (lastHoverRef.current && lastHoverRef.current !== t)
        lastHoverRef.current.classList.remove(OUTLINE_CLASS);
      t.classList.add(OUTLINE_CLASS);
      lastHoverRef.current = t;
    }

    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t || isEditorChrome(t)) return;
      e.preventDefault();
      e.stopPropagation();
      if (selected) selected.classList.remove(SELECTED_CLASS);
      t.classList.add(SELECTED_CLASS);
      setSelected(t);
    }

    document.addEventListener("mouseover", onMove, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mouseover", onMove, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [enabled, selected]);

  const persist = useCallback((fp: string, styles: Record<string, string>) => {
    const next = { ...overridesRef.current };
    const existing = next[fp] ?? {};
    next[fp] = { ...existing, ...styles };
    overridesRef.current = next;
    saveOverrides(next);
  }, []);

  const updateStyle = useCallback(
    (prop: string, value: string) => {
      if (!selected) return;
      const el: HTMLElement = selected;
      // The rule treats `selected` as React state, but it's a DOM ref —
      // mutating its style/textContent is the only way to apply edits.
      /* eslint-disable react-hooks/immutability */
      if (value === "") {
        el.style.removeProperty(prop);
      } else if (prop === "textContent") {
        el.innerText = value;
      } else {
        el.style.setProperty(prop, value);
      }
      /* eslint-enable react-hooks/immutability */
      const fp = fingerprintOf(el);
      persist(fp, { [prop]: value });
    },
    [selected, persist],
  );

  const resetSelected = useCallback(() => {
    if (!selected) return;
    const fp = fingerprintOf(selected);
    const styles = overridesRef.current[fp];
    if (styles) {
      clearFromElement(selected, Object.keys(styles));
    }
    const next = { ...overridesRef.current };
    delete next[fp];
    overridesRef.current = next;
    saveOverrides(next);
  }, [selected]);

  const resetAll = useCallback(() => {
    for (const [fp, styles] of Object.entries(overridesRef.current)) {
      const el = findByFingerprint(fp);
      if (el) clearFromElement(el, Object.keys(styles));
    }
    overridesRef.current = {};
    saveOverrides({});
    if (selected) selected.classList.remove(SELECTED_CLASS);
    setSelected(null);
  }, [selected]);

  const saveToSource = useCallback(async () => {
    try {
      const res = await fetch("/api/design-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overridesRef.current),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; count?: number };
      if (json.ok) {
        alert(
          `Saved ${json.count ?? 0} overrides to src/data/design-overrides.json — commit + push to ship.`,
        );
      } else {
        alert(`Save failed: ${json.error ?? res.status}`);
      }
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    }
  }, []);

  const exportCss = useCallback(async () => {
    const rules: string[] = ["/* Wondavu design overrides */"];
    for (const [fp, styles] of Object.entries(overridesRef.current)) {
      const sel = fp;
      const decls = Object.entries(styles)
        .filter(([k]) => k !== "textContent")
        .map(([k, v]) => `  ${k}: ${v};`)
        .join("\n");
      const textNote = styles.textContent
        ? `\n  /* textContent: ${styles.textContent.replace(/\*\//g, "")} */`
        : "";
      rules.push(`/* selector path: ${sel} */\n.{TODO-pick-real-selector} {\n${decls}${textNote}\n}`);
    }
    const text = rules.join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      alert("Design overrides copied to clipboard.");
    } catch {
      console.log(text);
      alert("Couldn't copy — check the console for the dump.");
    }
  }, []);

  return (
    <>
      <style>{`
        .${OUTLINE_CLASS} { outline: 1.5px dashed rgba(56, 132, 255, 0.85) !important; outline-offset: 1px; cursor: pointer; }
        .${SELECTED_CLASS} { outline: 2px solid rgba(56, 132, 255, 1) !important; outline-offset: 1px; }
      `}</style>

      {/* Floating toggle */}
      <button
        type="button"
        data-wv-design-chrome="1"
        onClick={() => setEnabled((v) => !v)}
        title={enabled ? "Exit design editor" : "Enter design editor"}
        className="fixed bottom-4 right-4 z-[120] flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg ring-2 ring-white/40"
        style={{
          background: enabled ? "#3884ff" : "var(--foreground)",
          color: enabled ? "#ffffff" : "var(--surface)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {enabled ? "✕" : "✏️"}
      </button>

      {enabled && selected && (
        <EditorPanel
          element={selected}
          onChange={updateStyle}
          onReset={resetSelected}
          onClose={() => {
            if (selected) selected.classList.remove(SELECTED_CLASS);
            setSelected(null);
          }}
          onResetAll={resetAll}
          onExport={exportCss}
          onSave={saveToSource}
        />
      )}
    </>
  );
}

function EditorPanel({
  element,
  onChange,
  onReset,
  onClose,
  onResetAll,
  onExport,
  onSave,
}: {
  element: HTMLElement;
  onChange: (prop: string, value: string) => void;
  onReset: () => void;
  onClose: () => void;
  onResetAll: () => void;
  onExport: () => void;
  onSave: () => void;
}) {
  const computed = getComputedStyle(element);
  const tag = element.tagName.toLowerCase();
  const isTextish = element.children.length === 0;

  return (
    <div
      data-wv-design-chrome="1"
      className="fixed right-4 top-4 z-[121] flex max-h-[90vh] w-80 flex-col overflow-y-auto rounded-xl bg-white p-4 text-sm text-slate-900 shadow-2xl ring-1 ring-slate-200"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-bold">
          &lt;{tag}&gt;{" "}
          <span className="font-mono text-xs text-slate-500">
            {(element.className || "").slice(0, 30)}
          </span>
        </span>
        <button
          type="button"
          data-wv-design-chrome="1"
          onClick={onClose}
          className="rounded px-2 py-0.5 text-xs hover:bg-slate-100"
        >
          ✕
        </button>
      </div>

      {isTextish && (
        <Field label="Text content">
          <textarea
            data-wv-design-chrome="1"
            defaultValue={element.textContent ?? ""}
            onBlur={(e) => onChange("textContent", e.target.value)}
            rows={2}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </Field>
      )}

      <Section title="Typography">
        <Field label="Color">
          <select
            data-wv-design-chrome="1"
            defaultValue=""
            onChange={(e) => onChange("color", e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="">— theme —</option>
            {COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            data-wv-design-chrome="1"
            type="color"
            defaultValue={rgbToHex(computed.color)}
            onChange={(e) => onChange("color", e.target.value)}
            className="mt-1 h-7 w-full rounded border border-slate-300"
          />
        </Field>

        <Field label="Font family">
          <select
            data-wv-design-chrome="1"
            defaultValue=""
            onChange={(e) => onChange("font-family", e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="">— inherit —</option>
            {FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label={`Font size (${computed.fontSize})`}>
          <input
            data-wv-design-chrome="1"
            type="range"
            min={8}
            max={96}
            defaultValue={parseFloat(computed.fontSize) || 16}
            onChange={(e) => onChange("font-size", `${e.target.value}px`)}
            className="w-full"
          />
        </Field>

        <Field label="Weight">
          <select
            data-wv-design-chrome="1"
            defaultValue=""
            onChange={(e) => onChange("font-weight", e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="">— inherit —</option>
            <option value="300">300 — light</option>
            <option value="400">400 — regular</option>
            <option value="500">500 — medium</option>
            <option value="600">600 — semibold</option>
            <option value="700">700 — bold</option>
          </select>
        </Field>

        <div className="grid grid-cols-3 gap-1.5">
          <ToggleBtn label="Italic" onClick={() => onChange("font-style", "italic")} />
          <ToggleBtn label="Under" onClick={() => onChange("text-decoration", "underline")} />
          <ToggleBtn label="UPPER" onClick={() => onChange("text-transform", "uppercase")} />
        </div>

        <Field label="Letter spacing">
          <input
            data-wv-design-chrome="1"
            type="number"
            step={0.01}
            defaultValue={parseFloat(computed.letterSpacing) || 0}
            onChange={(e) => onChange("letter-spacing", `${e.target.value}em`)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </Field>

        <Field label="Line height">
          <input
            data-wv-design-chrome="1"
            type="number"
            step={0.05}
            defaultValue={parseFloat(computed.lineHeight) / parseFloat(computed.fontSize) || 1.5}
            onChange={(e) => onChange("line-height", e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </Field>
      </Section>

      <Section title="Spacing">
        <BoxField label="Padding" base="padding" computed={computed} onChange={onChange} />
        <BoxField label="Margin" base="margin" computed={computed} onChange={onChange} />
      </Section>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <button
          type="button"
          data-wv-design-chrome="1"
          onClick={onSave}
          className="w-full rounded bg-emerald-600 px-2 py-2 text-xs font-bold text-white hover:bg-emerald-700"
        >
          💾 Save changes to source
        </button>
        <p className="mt-1 text-[10px] text-slate-500">
          Writes to <code>src/data/design-overrides.json</code>. Commit + push
          to ship to wondavu.com.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            data-wv-design-chrome="1"
            onClick={onReset}
            className="flex-1 rounded bg-slate-100 px-2 py-1.5 text-xs font-semibold hover:bg-slate-200"
          >
            Reset this
          </button>
          <button
            type="button"
            data-wv-design-chrome="1"
            onClick={onExport}
            className="flex-1 rounded bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Copy CSS
          </button>
        </div>
        <button
          type="button"
          data-wv-design-chrome="1"
          onClick={onResetAll}
          className="mt-1.5 w-full rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
        >
          Reset ALL overrides
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 border-t border-slate-200 pt-2.5">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-0.5 block text-[10px] font-semibold text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-wv-design-chrome="1"
      onClick={onClick}
      className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold hover:bg-slate-200"
    >
      {label}
    </button>
  );
}

function BoxField({
  label,
  base,
  computed,
  onChange,
}: {
  label: string;
  base: "padding" | "margin";
  computed: CSSStyleDeclaration;
  onChange: (prop: string, value: string) => void;
}) {
  const sides = ["top", "right", "bottom", "left"] as const;
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold text-slate-600">{label}</div>
      <div className="grid grid-cols-4 gap-1">
        {sides.map((side) => {
          const prop = `${base}-${side}`;
          const v = parseFloat(
            computed.getPropertyValue(prop) || "0",
          );
          return (
            <input
              key={side}
              data-wv-design-chrome="1"
              type="number"
              defaultValue={isNaN(v) ? 0 : v}
              onChange={(e) => onChange(prop, `${e.target.value}px`)}
              title={prop}
              className="w-full rounded border border-slate-300 px-1 py-0.5 text-center text-[11px]"
            />
          );
        })}
      </div>
      <div className="mt-0.5 grid grid-cols-4 text-center text-[9px] text-slate-400">
        <span>T</span>
        <span>R</span>
        <span>B</span>
        <span>L</span>
      </div>
    </div>
  );
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return "#000000";
  const [r, g, b] = m.map(Number);
  return (
    "#" +
    [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")
  );
}
