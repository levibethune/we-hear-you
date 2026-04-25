/**
 * Webflow API v2 client.
 * Docs: https://developers.webflow.com/data/reference
 */

const API_BASE = "https://api.webflow.com/v2";

async function webflowFetch(apiToken, path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/**
 * Validate a Webflow API token by calling /sites.
 * @returns {Promise<boolean>}
 */
export async function validateToken(apiToken) {
  if (!apiToken) return { valid: false, error: "No token provided" };
  const { ok, status, body } = await webflowFetch(apiToken, "/sites");
  if (ok) return { valid: true };

  // Build a helpful error message
  const message = body?.message || body?.msg || `HTTP ${status}`;
  return { valid: false, error: message, status };
}

/**
 * List all sites the token has access to.
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function listSites(apiToken) {
  const { ok, body } = await webflowFetch(apiToken, "/sites");
  if (!ok) return [];
  return (body.sites || []).map((s) => ({
    id: s.id,
    name: s.displayName || s.shortName || s.id,
  }));
}

/**
 * List collections for a site.
 * @returns {Promise<Array<{ id: string, name: string, slug: string }>>}
 */
export async function listCollections(apiToken, siteId) {
  const { ok, body } = await webflowFetch(apiToken, `/sites/${siteId}/collections`);
  if (!ok) return [];
  return (body.collections || []).map((c) => ({
    id: c.id,
    name: c.displayName,
    slug: c.slug,
  }));
}

/**
 * Get a collection's fields.
 * @returns {Promise<Array<{ id: string, slug: string, name: string, type: string, required: boolean }>>}
 */
export async function listCollectionFields(apiToken, collectionId) {
  const { ok, body } = await webflowFetch(apiToken, `/collections/${collectionId}`);
  if (!ok) return [];
  return (body.fields || []).map((f) => ({
    id: f.id,
    slug: f.slug,
    name: f.displayName,
    type: f.type,
    required: f.isRequired || false,
  }));
}

/**
 * Create a CMS item.
 * @param {object} fieldData - keyed by field slug
 * @param {boolean} publish - if true, item is published live immediately
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function createItem(apiToken, collectionId, fieldData, publish = false) {
  // Webflow requires name + slug at minimum. Generate slug from name if not provided.
  if (fieldData.name && !fieldData.slug) {
    fieldData.slug = slugify(fieldData.name);
  }

  const endpoint = publish
    ? `/collections/${collectionId}/items/live`
    : `/collections/${collectionId}/items`;

  const payload = {
    isDraft: !publish,
    isArchived: false,
    fieldData,
  };

  const { ok, status, body } = await webflowFetch(apiToken, endpoint, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { ok, status, body };
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || `item-${Date.now().toString(36)}`;
}
