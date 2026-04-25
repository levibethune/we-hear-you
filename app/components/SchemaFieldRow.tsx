"use client";

import { useState } from "react";

export type FieldType = "text" | "text_list" | "single_choice" | "number" | "boolean";

export type DashboardDisplay = "bar" | "pie" | "list" | "hidden" | "none";

export interface SchemaField {
  id: string;
  name: string;
  type: FieldType;
  description: string;
  options: string[];
  required: boolean;
  dashboardDisplay: DashboardDisplay;
  showTop: boolean;
  showAverage: boolean;
}

const fieldTypeLabels: Record<FieldType, string> = {
  text: "Text",
  text_list: "Text List",
  single_choice: "Single Choice",
  number: "Number",
  boolean: "Yes/No",
};

export function SchemaFieldRow({
  field,
  onChange,
  onDelete,
}: {
  field: SchemaField;
  onChange: (updated: SchemaField) => void;
  onDelete: () => void;
}) {
  const [optionInput, setOptionInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function addOption() {
    const trimmed = optionInput.trim();
    if (!trimmed || field.options.includes(trimmed)) return;
    onChange({ ...field, options: [...field.options, trimmed] });
    setOptionInput("");
  }

  return (
    <div className="soft-card p-5">
      {/* Name as headline */}
      <input
        type="text"
        value={field.name}
        onChange={(e) =>
          onChange({ ...field, name: e.target.value.replace(/\s/g, "_").toLowerCase() })
        }
        placeholder="field_name"
        className="text-lg font-bold font-mono w-full bg-transparent px-0 mb-4"
        style={{ boxShadow: "none", minHeight: "auto" }}
      />

      <div className="flex flex-col gap-4">
        {/* Type and Required */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-muted mb-1.5 block">Type</label>
            <select
              value={field.type}
              onChange={(e) => onChange({ ...field, type: e.target.value as FieldType })}
              className="text-sm w-full"
            >
              {Object.entries(fieldTypeLabels).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => onChange({ ...field, required: e.target.checked })}
              />
              Required
            </label>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-muted mb-1.5 block">Description</label>
          <input
            type="text"
            value={field.description}
            onChange={(e) => onChange({ ...field, description: e.target.value })}
            placeholder="What should the AI extract for this field?"
            className="text-sm w-full"
          />
        </div>

        {/* Options for single choice */}
        {field.type === "single_choice" && (
          <div>
            <label className="text-xs text-muted mb-2 block">Options</label>
            {field.options.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {field.options.map((opt) => (
                  <span
                    key={opt}
                    className="inline-flex items-center gap-1.5 text-xs neu-raised px-3 py-1.5 text-accent"
                  >
                    {opt}
                    <button
                      onClick={() =>
                        onChange({ ...field, options: field.options.filter((o) => o !== opt) })
                      }
                      className="hover:text-negative"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={optionInput}
                onChange={(e) => setOptionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOption();
                  }
                }}
                placeholder="Add option..."
                className="text-sm flex-1"
              />
              <button onClick={addOption} className="neu-button text-sm text-accent">
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dashboard display */}
      <div className="mt-4 pt-3 border-t border-muted/10">
        <label className="text-[10px] text-muted uppercase tracking-wider block mb-2">Dashboard display</label>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={field.dashboardDisplay}
            onChange={(e) => onChange({ ...field, dashboardDisplay: e.target.value as DashboardDisplay })}
            className="text-xs py-1.5 px-2 rounded-lg"
            style={{ minHeight: "unset", height: "auto" }}
          >
            <option value="bar">Bar chart</option>
            <option value="pie">Pie chart</option>
            <option value="list">Ranked list</option>
            <option value="none">None</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={field.showTop}
              onChange={(e) => onChange({ ...field, showTop: e.target.checked })}
            />
            Show top
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={field.showAverage}
              onChange={(e) => onChange({ ...field, showAverage: e.target.checked })}
            />
            Show average
          </label>
        </div>
      </div>

      {/* Remove */}
      <div className="flex justify-end mt-3 pt-3 border-t border-muted/10">
        {confirmDelete ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">Are you sure?</span>
            <button
              onClick={() => { onDelete(); setConfirmDelete(false); }}
              className="text-xs text-negative hover:underline"
            >
              Yes, remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-muted hover:text-negative transition-colors"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
