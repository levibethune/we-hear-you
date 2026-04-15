"use client";

import { useState } from "react";
import type { PersonaBucket } from "../lib/types";

export function PersonaEditor({
  personas,
  onChange,
}: {
  personas: PersonaBucket[];
  onChange: (personas: PersonaBucket[]) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function updatePersona(index: number, updated: PersonaBucket) {
    const next = [...personas];
    next[index] = updated;
    onChange(next);
  }

  function removePersona(index: number) {
    onChange(personas.filter((_, i) => i !== index));
    setConfirmDelete(null);
  }

  function addPersona() {
    onChange([...personas, { name: "", description: "", criteria: "" }]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium">Persona Definitions</h4>
        <button onClick={addPersona} className="text-sm text-accent hover:underline">
          + Add persona
        </button>
      </div>

      {personas.length === 0 ? (
        <p className="text-sm text-muted py-4 text-center">
          No personas defined yet. Choose a starter template above, let the AI
          suggest some, or add your own.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {personas.map((p, i) => (
            <div key={i} className="soft-card p-5">
              <input
                type="text"
                value={p.name}
                onChange={(e) =>
                  updatePersona(i, { ...p, name: e.target.value })
                }
                placeholder="Persona name"
                className="text-lg font-bold w-full bg-transparent px-0 mb-4"
                style={{ boxShadow: "none", minHeight: "auto" }}
              />
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs text-muted mb-1.5 block">Description</label>
                  <input
                    type="text"
                    value={p.description}
                    onChange={(e) =>
                      updatePersona(i, { ...p, description: e.target.value })
                    }
                    placeholder="Who is this persona? One sentence."
                    className="text-sm w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 block">Classification Criteria</label>
                  <textarea
                    value={p.criteria}
                    onChange={(e) =>
                      updatePersona(i, { ...p, criteria: e.target.value })
                    }
                    placeholder="What signals should the AI look for to classify someone as this persona?"
                    rows={2}
                    className="text-sm w-full resize-y"
                  />
                </div>
              </div>

              {/* Remove at bottom-right with confirmation */}
              <div className="flex justify-end mt-4 pt-3 border-t border-muted/10">
                {confirmDelete === i ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">Are you sure?</span>
                    <button
                      onClick={() => removePersona(i)}
                      className="text-xs text-negative hover:underline"
                    >
                      Yes, remove
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(i)}
                    className="text-xs text-muted hover:text-negative transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
