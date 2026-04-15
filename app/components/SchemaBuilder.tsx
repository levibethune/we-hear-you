"use client";

import { useRef, useCallback } from "react";
import { SchemaFieldRow, type SchemaField, type FieldType } from "./SchemaFieldRow";
import type { OutputSchema, SchemaProperty } from "../lib/types";

let fieldCounter = 0;
function newField(): SchemaField {
  fieldCounter++;
  return {
    id: `field_${fieldCounter}_${Date.now()}`,
    name: "",
    type: "text",
    description: "",
    options: [],
    required: true,
  };
}

export function fieldsToSchema(fields: SchemaField[]): OutputSchema {
  const properties: Record<string, SchemaProperty> = {};
  const required: string[] = [];

  for (const f of fields) {
    if (!f.name) continue;
    const prop: SchemaProperty = { type: "string", description: f.description };

    if (f.type === "text") {
      prop.type = "string";
    } else if (f.type === "text_list") {
      prop.type = "array";
      prop.items = { type: "string" };
    } else if (f.type === "single_choice") {
      prop.type = "string";
      prop.enum = f.options;
    } else if (f.type === "number") {
      prop.type = "number";
    } else if (f.type === "boolean") {
      prop.type = "boolean";
    }

    properties[f.name] = prop;
    if (f.required) required.push(f.name);
  }

  return { type: "object", properties, required };
}

export function schemaToFields(schema: OutputSchema): SchemaField[] {
  if (!schema?.properties) return [];

  return Object.entries(schema.properties).map(([name, prop]) => {
    let type: FieldType = "text";
    let options: string[] = [];

    if (prop.type === "array") {
      type = "text_list";
    } else if (prop.type === "number") {
      type = "number";
    } else if (prop.type === "boolean") {
      type = "boolean";
    } else if (prop.enum && prop.enum.length > 0) {
      type = "single_choice";
      options = prop.enum;
    }

    fieldCounter++;
    return {
      id: `field_${fieldCounter}_${Date.now()}`,
      name,
      type,
      description: prop.description ?? "",
      options,
      required: schema.required?.includes(name) ?? false,
    };
  });
}

export function SchemaBuilder({
  fields,
  onChange,
}: {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  function updateField(index: number, updated: SchemaField) {
    const next = [...fields];
    next[index] = updated;
    onChange(next);
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  const addField = useCallback(() => {
    onChange([...fields, newField()]);
    // Scroll to the new field after render
    requestAnimationFrame(() => {
      if (listRef.current) {
        const lastCard = listRef.current.lastElementChild;
        lastCard?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [fields, onChange]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium">Analysis Fields</h4>
        <button
          onClick={addField}
          className="text-sm text-accent hover:underline"
        >
          + Add field
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted py-4 text-center">
          No fields defined. Add a field to start customizing your analysis output.
        </p>
      ) : (
        <div ref={listRef} className="flex flex-col gap-6">
          {fields.map((f, i) => (
            <SchemaFieldRow
              key={f.id}
              field={f}
              onChange={(updated) => updateField(i, updated)}
              onDelete={() => removeField(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
