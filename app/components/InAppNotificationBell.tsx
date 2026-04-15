"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuthContext } from "./AuthProvider";
import type { InAppNotification } from "../lib/types";

export function InAppNotificationBell() {
  const { tenant, user } = useAuthContext();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function fetchNotifications() {
    if (!tenant) return;
    fetch(`/api/dashboard/notifications?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => {});
  }

  useEffect(() => {
    fetchNotifications();
    // Poll every 60s
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [tenant]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function markAsRead(notificationId: string) {
    if (!tenant) return;
    await fetch("/api/dashboard/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant.id, notification_id: notificationId }),
    });
    fetchNotifications();
  }

  async function markAllRead() {
    if (!tenant) return;
    await fetch("/api/dashboard/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant.id, mark_all: true }),
    });
    fetchNotifications();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-lg text-muted hover:text-accent transition-colors"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a7 7 0 0 0-7 7v3.586l-1.707 1.707A1 1 0 0 0 4 16h16a1 1 0 0 0 .707-1.707L19 12.586V9a7 7 0 0 0-7-7zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-accent" />
        )}
      </button>

      {open && (
        <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-3 w-80 max-h-96 overflow-y-auto bg-background border border-card-border rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.18)] z-[100]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-xs text-muted text-center py-8">No notifications yet.</p>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => {
                const isUnread = user ? !n.read_by?.includes(user.id) : false;
                return (
                  <Link
                    key={n.id}
                    href={n.link || "#"}
                    onClick={() => markAsRead(n.id)}
                    className={`px-4 py-3 border-b border-card-border/40 hover:bg-card-border/20 transition-colors ${isUnread ? "bg-accent/5" : ""}`}
                  >
                    <p className="text-xs font-medium truncate">{n.title}</p>
                    {n.body && <p className="text-[11px] text-muted mt-0.5 truncate">{n.body}</p>}
                    <p className="text-[10px] text-muted/50 mt-1">
                      {new Date(n.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
