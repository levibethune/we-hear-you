"use client";

import { useEffect, useState } from "react";
import { useAuthContext } from "../../components/AuthProvider";
import { EmptyState } from "../../components/EmptyState";
import { Modal } from "../../components/Modal";
import { LoadingIndicator } from "../../components/LoadingIndicator";

interface TenantWithCounts {
  id: string;
  name: string;
  slug: string;
  allowed_domains: string[];
  default_role: string;
  created_at: string;
  memberCount: number;
  responseCount: number;
}

export default function AdminPage() {
  const { isSuperAdmin, switchTenant } = useAuthContext();
  const [tenants, setTenants] = useState<TenantWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  // Domain editor state
  const [editingTenant, setEditingTenant] = useState<TenantWithCounts | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [defaultRole, setDefaultRole] = useState("admin");
  const [saving, setSaving] = useState(false);

  // Members state
  const [membersTenant, setMembersTenant] = useState<TenantWithCounts | null>(null);
  const [members, setMembers] = useState<{ id: string; user_id: string; email: string; role: string; created_at: string }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  // New tenant state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDomains, setNewDomains] = useState<string[]>([]);
  const [newDomainInput, setNewDomainInput] = useState("");
  const [newInvites, setNewInvites] = useState("");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ tenant: { id: string; name: string }; apiKey: string; inviteResults: { email: string; status: string }[] } | null>(null);

  function fetchTenants() {
    fetch("/api/dashboard/tenants")
      .then((r) => r.json())
      .then((data) => {
        setTenants(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchTenants();
  }, [isSuperAdmin]);

  function openMembersModal(t: TenantWithCounts) {
    setMembersTenant(t);
    setInviteEmail("");
    setInviteMessage(null);
    setMembersLoading(true);
    fetch(`/api/dashboard/members?tenant_id=${t.id}`)
      .then((r) => r.json())
      .then((data) => {
        setMembers(Array.isArray(data) ? data : []);
        setMembersLoading(false);
      })
      .catch(() => setMembersLoading(false));
  }

  async function handleInvite() {
    if (!membersTenant || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteMessage(null);
    const res = await fetch("/api/dashboard/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: membersTenant.id, email: inviteEmail.trim(), role: inviteRole }),
    });
    const data = await res.json();
    setInviting(false);
    if (data.added) {
      setInviteEmail("");
      setInviteMessage(`${data.email} added as ${data.role}`);
      openMembersModal(membersTenant);
    } else {
      setInviteMessage(data.message ?? "Could not add member");
    }
  }

  async function handleChangeRole(memberId: string, newRole: string) {
    await fetch("/api/dashboard/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, tenant_id: membersTenant?.id, role: newRole }),
    });
    if (membersTenant) openMembersModal(membersTenant);
  }

  async function handleRemoveMember(memberId: string) {
    await fetch("/api/dashboard/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, tenant_id: membersTenant?.id }),
    });
    if (membersTenant) openMembersModal(membersTenant);
    fetchTenants();
  }

  function openDomainEditor(t: TenantWithCounts) {
    setEditingTenant(t);
    setDomains(t.allowed_domains ?? []);
    setDefaultRole(t.default_role ?? "admin");
  }

  function addDomain() {
    const d = domainInput.trim().toLowerCase().replace(/^@/, "");
    if (!d || domains.includes(d)) return;
    setDomains([...domains, d]);
    setDomainInput("");
  }

  async function saveDomains() {
    if (!editingTenant) return;
    setSaving(true);
    await fetch("/api/dashboard/tenants", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: editingTenant.id,
        allowed_domains: domains,
        default_role: defaultRole,
      }),
    });
    setSaving(false);
    setEditingTenant(null);
    fetchTenants();
  }

  if (!isSuperAdmin) {
    return <EmptyState message="You don't have access to this page." />;
  }

  if (loading) {
    return (
      <LoadingIndicator />
    );
  }

  function addNewDomain() {
    const d = newDomainInput.trim().toLowerCase().replace(/^@/, "");
    if (!d || newDomains.includes(d)) return;
    setNewDomains([...newDomains, d]);
    setNewDomainInput("");
  }

  async function handleCreateTenant() {
    if (!newName.trim() || !newSlug.trim()) return;
    setCreating(true);
    setCreateResult(null);

    const inviteEmails = newInvites
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter(Boolean);

    const res = await fetch("/api/dashboard/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        slug: newSlug.trim(),
        allowed_domains: newDomains,
        default_role: "admin",
        invite_emails: inviteEmails,
      }),
    });

    const data = await res.json();
    setCreating(false);

    if (data.tenant) {
      setCreateResult(data);
      fetchTenants();
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-bold mb-1">Organizations</h2>
          <p className="text-sm text-muted">
            Each organization is a completely separate workspace with its own data,
            personas, and settings. No organization can see another&apos;s information.
          </p>
        </div>
        <button
          onClick={() => {
            setCreateOpen(true);
            setCreateResult(null);
            setNewName("");
            setNewSlug("");
            setNewDomains([]);
            setNewInvites("");
          }}
          className="neu-button-primary text-sm shrink-0"
        >
          Add Organization
        </button>
      </div>

      {tenants.length === 0 ? (
        <EmptyState message="No tenants yet." />
      ) : (
        <div className="border border-card-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-card text-left text-xs text-muted uppercase tracking-wide">
                <th className="px-4 py-2.5">Organization</th>
                <th className="px-4 py-2.5">Allowed Domains</th>
                <th className="px-4 py-2.5 text-right">Members</th>
                <th className="px-4 py-2.5 text-right">Responses</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-card-border hover:bg-card/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted font-mono">{t.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    {(t.allowed_domains ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.allowed_domains.map((d) => (
                          <span
                            key={d}
                            className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full"
                          >
                            @{d}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {t.memberCount}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {t.responseCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openDomainEditor(t)}
                        className="text-xs text-accent hover:underline"
                      >
                        Domains
                      </button>
                      <button
                        onClick={() => openMembersModal(t)}
                        className="text-xs text-accent hover:underline"
                      >
                        Members
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!editingTenant}
        onClose={() => setEditingTenant(null)}
        title={`Domains — ${editingTenant?.name}`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            When you add a domain here, anyone with that email address can create
            an account on We Hear You and they&apos;ll automatically be placed into
            the <strong className="text-foreground">{editingTenant?.name}</strong>{" "}workspace.
            They&apos;ll only see this organization&apos;s data — nothing else.
          </p>
          <p className="text-xs text-muted">
            For example, if you add <span className="font-mono">acme.com</span>, then
            anyone with an @acme.com email can sign up and start using the dashboard
            for this organization right away.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {domains.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 text-sm bg-accent/10 text-accent px-2.5 py-1 rounded-full"
              >
                @{d}
                <button
                  onClick={() => setDomains(domains.filter((x) => x !== d))}
                  className="hover:text-negative"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDomain();
                }
              }}
              placeholder="acme.com"
              className="text-sm flex-1"
            />
            <button
              onClick={addDomain}
              className="text-sm text-accent hover:underline"
            >
              Add
            </button>
          </div>

          <div>
            <p className="text-xs text-muted mb-1">Default role for new users</p>
            <select
              value={defaultRole}
              onChange={(e) => setDefaultRole(e.target.value)}
              className="text-sm"
            >
              <option value="admin">Admin (manage configs, personas, keys)</option>
              <option value="viewer">Viewer (read-only)</option>
            </select>
          </div>

          <button
            onClick={saveDomains}
            disabled={saving}
            className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>

      {/* Members Modal */}
      <Modal
        open={!!membersTenant}
        onClose={() => setMembersTenant(null)}
        title={`Members — ${membersTenant?.name}`}
      >
        <div className="flex flex-col gap-4">
          {membersLoading ? (
            <p className="text-sm text-muted">Loading members...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted">No members yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-muted/10 last:border-0">
                  <div>
                    <p className="text-sm">{m.email}</p>
                    <p className="text-xs text-muted">Joined {new Date(m.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={m.role}
                      onChange={(e) => handleChangeRole(m.id, e.target.value)}
                      className="text-xs py-1 px-2"
                      style={{ minHeight: "unset" }}
                    >
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="text-xs text-negative hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-muted/10">
            <p className="text-xs text-muted mb-2">Invite a new member</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="text-sm flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleInvite(); } }}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="text-xs py-1 px-2"
                style={{ minHeight: "unset" }}
              >
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="neu-button-primary text-xs"
              >
                {inviting ? "Adding..." : "Add"}
              </button>
            </div>
            {inviteMessage && (
              <p className="text-xs text-muted mt-2">{inviteMessage}</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Create Tenant Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={createResult ? "Organization Created" : "Add Organization"}
      >
        {createResult ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-seafoam font-medium">
              {createResult.tenant.name} has been created.
            </p>
            <p className="text-xs text-muted">
              The organization is ready. Invited admins can log in and set up
              their own API keys, personas, and analysis config from their dashboard.
            </p>

            {createResult.inviteResults.length > 0 && (
              <div>
                <p className="text-xs text-muted mb-1.5">Invites:</p>
                <div className="flex flex-col gap-1">
                  {createResult.inviteResults.map((r, i) => (
                    <p key={i} className="text-xs">
                      <span className="text-foreground">{r.email}</span>{" "}
                      <span className={r.status === "added" ? "text-seafoam" : "text-sunshine"}>
                        {r.status === "added" ? "— added as admin" : "— will join on signup"}
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => { setCreateOpen(false); setCreateResult(null); }}
              className="neu-button-primary text-sm"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-muted mb-1.5 block">Organization Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newSlug || newSlug === newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) {
                    setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                  }
                }}
                placeholder="e.g., ACME Corp"
                className="text-sm w-full"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-muted mb-1.5 block">Slug (URL identifier)</label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="acme-corp"
                className="text-sm w-full font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-muted mb-1.5 block">
                Allowed Email Domains{" "}
                <span className="text-muted/60">(optional)</span>
              </label>
              <p className="text-xs text-muted mb-2">
                Anyone with an email at these domains can sign up and automatically join.
              </p>
              {newDomains.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {newDomains.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full"
                    >
                      @{d}
                      <button onClick={() => setNewDomains(newDomains.filter((x) => x !== d))} className="hover:text-negative">&times;</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewDomain(); } }}
                  placeholder="acme.com"
                  className="text-sm flex-1"
                />
                <button onClick={addNewDomain} className="text-xs text-accent hover:underline">Add</button>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted mb-1.5 block">
                Invite Admins{" "}
                <span className="text-muted/60">(optional)</span>
              </label>
              <p className="text-xs text-muted mb-2">
                Enter email addresses to add as admins. If they already have an account,
                they&apos;ll get immediate access. If not, they&apos;ll be added when they
                sign up.
              </p>
              <textarea
                value={newInvites}
                onChange={(e) => setNewInvites(e.target.value)}
                placeholder={"jane@acmecorp.com\njohn@acmecorp.com"}
                rows={3}
                className="text-sm w-full font-mono"
              />
            </div>

            <button
              onClick={handleCreateTenant}
              disabled={creating || !newName.trim() || !newSlug.trim()}
              className="neu-button-primary text-sm"
            >
              {creating ? "Creating..." : "Create Organization"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
