"use client";

import { TEMPLATES, type AnalysisTemplate } from "../../lib/templates";

export function TemplateSelector({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (template: AnalysisTemplate) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className={`text-left p-4 rounded-xl transition-all ${
            selected === t.id
              ? "bg-accent/10 border-2 border-accent/40 shadow-[0_0_0_2px_rgba(244,160,122,0.15)]"
              : "bg-card-border/20 border-2 border-transparent hover:border-card-border"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{t.icon}</span>
            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-semibold ${selected === t.id ? "text-accent" : ""}`}>
                {t.name}
              </h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                {t.description}
              </p>
              {t.fields.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {t.fields.map((f) => (
                    <span key={f.name} className="text-[10px] bg-card-border/40 px-1.5 py-0.5 rounded">
                      {f.name.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
