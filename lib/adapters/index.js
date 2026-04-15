import * as videoask from "./videoask.js";
import * as custom from "./custom.js";

const adapters = {
  videoask,
  custom,
};

/**
 * Get an adapter by source type.
 * Each adapter exports a normalize(payload) function that returns the universal shape.
 */
export function getAdapter(sourceType) {
  const adapter = adapters[sourceType];
  if (!adapter) {
    throw new Error(`Unknown source type: ${sourceType}. Available: ${Object.keys(adapters).join(", ")}`);
  }
  return adapter;
}
