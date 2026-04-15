import Link from "next/link";
import { Logo } from "../components/Logo";

const releases = [
  {
    version: "1.0",
    date: "April 14, 2026",
    title: "Campaigns, Outputs, Notifications, Video Feeds & Filter/Flow",
    summary:
      "The v1.0 milestone. Campaigns organize your data collection efforts with isolated Persona and Analysis configs. Outputs unify Notifications (Slack, in-app, email digest), Video Feeds (public embeddable feeds with safety filtering), and Custom Flows (webhook automations) under one roof. Plus safety classification on every analysis, campaign-aware filtering across the entire dashboard, and dozens of UI polish passes.",
    sections: [
      {
        heading: "Campaigns",
        items: [
          "New organizational layer between your org and your data \u2014 each campaign gets its own Persona config, Analysis config, and form routing",
          "Campaign picker in the sidebar and inline on every data page (Dashboard, People, Responses, Personas) so you always know what you\u2019re looking at",
          "Campaign selection persists across page navigation",
          "Create, edit, duplicate, archive, and delete campaigns from Settings \u2192 Campaigns",
          "Duplicating a campaign copies its Persona and Analysis config but not responses",
          "Form name auto-routing: map VideoAsk form names to campaigns so ingest lands in the right place automatically",
          "Multi-select form picker populated from your existing response data",
          "\u201CAll Campaigns\u201D aggregate view across the entire dashboard",
          "Persona Config and Analysis Config require campaign selection \u2014 no more accidental org-wide edits",
          "All existing data automatically migrated to a Default campaign per org",
        ],
      },
      {
        heading: "Filter & Flow (v0.8)",
        items: [
          "Visual flow builder: set conditions (persona, sentiment, mood, themes, source, form, campaign, transcription) with AND/OR logic",
          "Webhook actions to Zapier, Make, or any URL \u2014 fires on new ingest and reanalysis",
          "Test webhook button validates your connection before saving",
          "Auto-generated flow names and plain-English preview sentence",
          "Execution history log with status, timestamps, and HTTP responses",
          "Edit, pause, and delete flows with confirmation",
          "SSRF protection blocks internal/private URLs on all webhook targets",
          "Retry failed executions up to 3 times",
        ],
      },
      {
        heading: "Outputs (v0.9)",
        items: [
          "Flows page renamed to Outputs with three sections: Notifications, Video Feeds, and Custom Flows",
          "Each output can be scoped to a specific campaign or set org-wide",
          "Edit, toggle, and delete controls on all output cards",
          "Scope badges show which campaign each output belongs to",
        ],
      },
      {
        heading: "Notifications",
        items: [
          "Three channels: Slack (real-time), in-app (dashboard bell), and weekly email digest (Resend)",
          "Slack notifications include person, persona, sentiment, mood, themes, transcript preview, and a \u201CView Response\u201D button linking to the dashboard",
          "In-app notification bell in the sidebar with unread count and mark-all-read",
          "Notifications fire on new ingest, reanalysis, and single-response reprocessing",
          "Same condition system as Flows \u2014 only notify when criteria match",
        ],
      },
      {
        heading: "Video Feeds",
        items: [
          "Public embeddable video feeds at /feeds/[slug] \u2014 no auth needed, iframe-friendly",
          "JSON API at /api/feeds/[slug] for headless CMS integration (Webflow, WordPress)",
          "Built-in safety filters: PII, profanity, hate speech, and on-topic detection",
          "Safety classification runs once at analysis time \u2014 no per-query cost",
          "Random unguessable slug per feed; toggle active/inactive without losing the URL",
          "CORS headers enabled for cross-origin fetch",
        ],
      },
      {
        heading: "Dashboard & UI polish",
        items: [
          "Recent Responses and Sentiment Breakdown in unified cards with bigger headlines",
          "Audience Insights headline bumped for consistency",
          "API key name pre-fills with org name",
          "CSV imports now fetch video URLs from VideoAsk share links",
          "Form names cleaned up from file paths to readable names",
          "Flow detail page: status dot with glow, toggle switch, edit/delete as icons",
          "Bulk re-analysis percentage removed (visual bar is sufficient)",
          "Campaign condition field available in all flow/notification builders",
          "Campaign names resolve in previews instead of UUIDs",
        ],
      },
      {
        heading: "Security & performance",
        items: [
          "CRON_SECRET required for digest endpoint \u2014 rejects requests if not configured",
          "Webhook URL validation blocks localhost, private IPs, and AWS metadata endpoints",
          "Category and condition field/operator validation on flow creation",
          "Webhook URLs masked in UI (domain + last 8 chars only)",
          "Sidebar counts fetch once on mount instead of every navigation",
        ],
      },
    ],
  },
  {
    version: "0.9",
    date: "April 7, 2026",
    title: "Outputs \u2014 Notifications and Video Feeds",
    summary:
      "Flows expands into Outputs: a new home for turning insights into action. Get notified via Slack, in-app, or weekly email digest. Publish curated, safety-filtered video feeds you can embed anywhere. All Claude analyses now include automatic safety classification (PII, profanity, hate speech, topics).",
    sections: [
      {
        heading: "Notifications (new)",
        items: [
          "Three notification channels: Slack (real-time), in-app dashboard bell (real-time), and weekly email digest (powered by Resend)",
          "Slack notifications post a formatted message with person, persona, sentiment, mood, themes, and transcript preview to any incoming webhook URL",
          "In-app notifications appear in a new bell icon in the sidebar with unread count, dismissible per user, visible to all org members",
          "Weekly email digests bundle every match for the week into a single styled email \u2014 sent every Monday morning",
          "All notifications use the same condition system as Flows \u2014 filter by persona, sentiment, mood, themes, source, form, or transcription",
        ],
      },
      {
        heading: "Video Feeds (new)",
        items: [
          "Publish a curated video feed at a public URL like /feeds/abc123 \u2014 embeddable in any iframe (Webflow, Wordpress, Squarespace, Wix)",
          "Or pull as JSON from /api/feeds/[slug] for custom builds and headless CMS integration",
          "Filter videos by persona, sentiment, themes, etc. \u2014 same condition system as the rest of the platform",
          "Built-in safety filters: hide videos containing PII, profanity, or hate speech, plus an on-topic filter that matches against your feed's topic description",
          "Random unguessable slug per feed; toggle active/inactive without losing the URL",
          "Copy embed snippet directly from the feed editor",
        ],
      },
      {
        heading: "Automatic safety classification",
        items: [
          "Every analyzed response now includes a safety object: contains_pii, contains_profanity, contains_hate_speech, and detected topics",
          "Runs once at analysis time \u2014 no extra API cost when feeds are queried",
          "Applies to all tenants automatically; existing analyses can be re-run via Reanalyze to gain safety classification",
        ],
      },
      {
        heading: "Outputs page",
        items: [
          "The Flows page is now Outputs, with three sections: Notifications, Video Feeds, and Custom Flows",
          "Each section has its own list and create button \u2014 quick visual scan of everything wired up",
          "Sidebar nav renamed from Flows to Outputs; count includes flows + video feeds",
          "Old /dashboard/flows URL redirects to /dashboard/outputs to keep bookmarks working",
        ],
      },
    ],
  },
  {
    version: "0.8",
    date: "April 6, 2026",
    title: "Filter & Flow \u2014 Automated actions from your insights",
    summary:
      "Introducing Filter & Flow: a new way to turn insights into action. Build conditional flows that fire webhooks to Zapier, Make, or any tool when responses match your criteria. Plus dashboard polish, smarter API key naming, CSV import improvements, and inline video for CSV-imported responses.",
    sections: [
      {
        heading: "Filter & Flow (new)",
        items: [
          "New Flows section in the main navigation \u2014 build automated actions triggered by your insights",
          "Visual flow builder with field, operator, and value dropdowns for conditions",
          "Filter on persona, mood, sentiment, themes, source, form, or transcription content",
          "AND/OR logic toggle for combining conditions",
          "Webhook actions send matching response and person data to Zapier, Make, or any URL",
          "Live plain-English preview sentence updates as you build the flow",
          "Auto-generated flow name and description based on your selections",
          "Test webhook button sends a sample payload to verify the connection before saving",
          "Edit and pause flows from the detail page; deletion requires confirmation",
          "Execution history log shows every fire with status, timestamp, and HTTP response",
          "Flows fire on new ingest and after reanalysis, so updated personas re-trigger automatically",
          "Failed deliveries log for retry; up to 3 retries with permanent-fail status",
        ],
      },
      {
        heading: "Dashboard polish",
        items: [
          "Recent Responses now lives in a unified card with a bigger headline showing the total response count",
          "Sentiment Breakdown wrapped in a matching card for visual consistency",
          "Audience Insights headline bumped up to match the new card design",
          "Sidebar now shows a live count of flows next to the Flows nav item",
        ],
      },
      {
        heading: "CSV import improvements",
        items: [
          "CSV imports now fetch the original VideoAsk video URL from each share link, so videos play inline just like webhook-imported responses",
          "Backfilled video URLs for all 236 previously CSV-imported responses",
          "Cleaned up form names that were stored as full file paths \u2014 116 responses now show readable form names",
        ],
      },
      {
        heading: "API key generation",
        items: [
          "When generating a new API key, the name field now pre-fills with your organization name so you can quickly add a label like \u201CJumpsuit VideoAsk webhook\u201D",
        ],
      },
    ],
  },
  {
    version: "0.7",
    date: "April 2, 2026",
    title: "Bulk Editing, CSV Import, Background Processing, Personas & Analytics",
    summary:
      "Bulk selection and management for people and responses, CSV import from VideoAsk exports, background job processing for all AI analysis, audience insights, personas data page, in-app analytics with PostHog, organization member management, and three rounds of security hardening.",
    sections: [
      {
        heading: "Personas & Audience Insights",
        items: [
          "New Personas page in the main navigation \u2014 see your audience organized by persona with descriptions and people cards",
          "Audience Insights card on the Dashboard \u2014 AI-generated summary of your audience, cached and refreshed automatically after 3 new responses",
          "Manual refresh button with once-per-day rate limit to control API costs",
          "Insight uses summary statistics (not raw transcriptions) for efficiency",
          "Persona filter dropdown now dynamically populated from your taxonomy definitions on both People and Responses pages",
          "Sidebar shows persona count next to the Personas nav item",
          "Persona Config renamed from Personas Config and moved above Analysis Config in settings",
        ],
      },
      {
        heading: "Dashboard",
        items: [
          "Five stat cards: People, Responses, Top Persona, Top Mood, Avg Sentiment",
          "People and Responses cards link to their respective pages",
          "Top Persona card links to the Personas page",
          "All stat values capitalized (Positive, not positive)",
          "Audience Insights sits in the left column above Sentiment Breakdown",
        ],
      },
      {
        heading: "Background Processing",
        items: [
          "All AI analysis now runs in the background \u2014 CSV imports, multi-link imports, re-analysis, and bulk re-analysis no longer block the page",
          "Persistent progress banner in the bottom-right corner follows you across all pages",
          "Real-time progress bar with counts: processed, imported, skipped, failed",
          "Jobs table stores state server-side so progress survives page navigation",
          "Client-driven batch processing \u2014 each batch runs within Vercel\u2019s timeout, then the next batch starts automatically",
          "Completed jobs show for one hour with a dismiss button, failed jobs show with error details",
        ],
      },
      {
        heading: "Bulk Editing",
        items: [
          "Select multiple people or responses with checkboxes and a \u201CSelect all\u201D toggle",
          "Bulk actions: Hide, Re-analyze, Delete, and Move to another organization",
          "Inline action bar with live count that stays visible while scrolling",
          "Show/hide hidden items toggle at the bottom of each list",
          "Delete confirmation dialog to prevent accidental removal",
        ],
      },
      {
        heading: "CSV Import",
        items: [
          "Upload a VideoAsk CSV export to import all responses at once \u2014 no OAuth or share links needed",
          "Client-side CSV parsing with row-by-row processing to avoid server timeouts",
          "Live progress bar showing import status in real time",
          "Detailed results breakdown: imported, skipped (no email, no transcription, duplicate), and failed",
          "Original response dates preserved from VideoAsk\u2019s Date/Time column",
          "Share URLs captured and stored for linking back to VideoAsk",
        ],
      },
      {
        heading: "Organization Management",
        items: [
          "Manage Members modal on the Admin page \u2014 list, invite, change roles, and remove members",
          "Role validation enforced server-side (viewer, admin, owner only)",
          "Organization switcher persists selection across page reloads and OAuth redirects",
          "Full page reload on org switch to clear stale state",
          "Org context banner on all settings pages showing which organization you\u2019re editing",
        ],
      },
      {
        heading: "People & Responses",
        items: [
          "Sortable columns on the People table \u2014 click any header to sort by Name, Persona, Mood, Sentiment, Responses, or Responded date",
          "New \u201CResponded\u201D column showing the actual date the person submitted their response (not the import date)",
          "Matching filters on both pages: Sentiment, Mood, Persona, Source, Form, and Sort",
          "Multi-row filter layout \u2014 search and source on the first row, analysis filters on the second",
          "People table scrolls horizontally on smaller screens",
          "Sidebar shows people and response counts next to each nav item",
          "Page titles show counts: \u201C120 Responses\u201D instead of separate total",
        ],
      },
      {
        heading: "Response Cards",
        items: [
          "Wider metadata column for tags and pills to breathe",
          "Inline video player \u2014 \u201CPlay video\u201D toggles the original recording right in the card",
          "\u201CView on VideoAsk\u201D link to the original conversation (when share URL is available)",
          "Edit transcript fine print clarifying changes are only saved within We Hear You",
          "Source labels cleaned up: \u201CVideoAsk Import\u201D instead of \u201Cvideoask-link\u201D",
          "Form name displayed on each response when available",
        ],
      },
      {
        heading: "Brand & Design",
        items: [
          "W.H.Y. logo in Source Serif 4 with peach, seafoam, and sunshine dots",
          "Logo placed on sidebar, login, reset password, and all secondary pages",
          "Improved light mode contrast \u2014 darker tag colors for better readability against the warm background",
          "Custom checkboxes with centered checkmarks and consistent sizing",
          "Copy-to-clipboard fields on webhook URLs, header names, and API keys",
        ],
      },
      {
        heading: "Analytics",
        items: [
          "PostHog integration for page views, user identity, and custom event tracking",
          "Tracked events: sign up, sign in, sign out, all import types, persona saves, config changes, transcript edits, and bulk actions",
          "User identified by Supabase auth ID with email for cohort analysis",
        ],
      },
      {
        heading: "Security (Audit #3)",
        items: [
          "Cross-tenant data access fixed in bulk reanalyze \u2014 all queries now scoped by tenant_id",
          "Member management scoped by tenant_id on all PUT/DELETE operations",
          "Bulk operation IDs capped at 25 (reanalyze) or 100 (other actions) to prevent API abuse",
          "Role validation on member invite and role change (viewer/admin/owner only)",
          "Transcription sanitization added to all import and reprocess routes",
          "Raw email removed from import-link API response",
          "CSV import dedup key includes content hash to prevent collisions",
          "Reanalyze added to bulk action validation whitelist (was silently blocked)",
          "Auto-provisioning optimized to only run when user has zero memberships",
        ],
      },
      {
        heading: "Infrastructure",
        items: [
          "App moved to app.wehearyou.io subdomain (root domain reserved for marketing site)",
          "All webhook URLs, OAuth callbacks, and instructions updated to new domain",
          "Support page with FAQ, how-it-works guide, and contact information",
        ],
      },
    ],
  },
  {
    version: "0.6",
    date: "April 1, 2026",
    title: "Dashboard, Import Tools & Security Hardening",
    summary:
      "Major UX overhaul, VideoAsk quick import, AI-powered persona suggestions, neumorphic design system, comprehensive security fixes, and multi-organization management.",
    sections: [
      {
        heading: "Design & UX",
        items: [
          "Neumorphic design system — soft raised cards, inset inputs, and tactile button states across the entire interface",
          "W.H.Y. brand logo in Source Serif 4 with peach, seafoam, and sunshine accent dots",
          "Light and dark mode with system preference detection and persistent toggle",
          "Three-dot animated loading indicator in brand colors replaces all loading states",
          "Consistent spacing, card sizing, and form styling across all pages",
          "Instructional copy on every page written for non-technical users",
        ],
      },
      {
        heading: "Import Tools",
        items: [
          "Quick Import — paste a single VideoAsk share link to import and analyze one response instantly",
          "Multi-link import — paste multiple share links (one per line) to batch import with live progress",
          "Inline video playback — play the original video response directly within the response card",
          "Edit transcript & re-process — modify a transcription and re-run AI analysis in place",
          "VideoAsk OAuth integration for bulk import via the VideoAsk API",
          "Per-tenant duplicate detection — the same response can exist in different organizations",
        ],
      },
      {
        heading: "AI Features",
        items: [
          "AI-suggested personas — analyze your responses and get persona recommendations with confidence levels and example quotes",
          "Gap detection — identify emerging patterns that don\u2019t fit existing personas",
          "Starter persona templates — choose from Buyer Personas, User Personas, or Brand Archetypes to get started quickly",
          "Suggest a prompt — AI generates an optimized system prompt based on your analysis fields and personas",
        ],
      },
      {
        heading: "Organization Management",
        items: [
          "Create organizations from the Admin panel with name, slug, allowed domains, and admin invites",
          "Domain-based auto-provisioning — users with matching email domains join automatically on signup",
          "Organization switcher in the sidebar for users with access to multiple workspaces",
          "Super admin can switch between and manage all organizations",
        ],
      },
      {
        heading: "Connections & Setup",
        items: [
          "Combined Connections page with API keys, webhook setup guides, and active sources",
          "Step-by-step VideoAsk webhook setup with exact field values matching VideoAsk\u2019s UI",
          "API key generation with Bearer prefix pre-included for easy copy-paste",
          "Inline \u201CGenerate Key\u201D button within the setup guide flow",
          "Scope explainer (ingest, read, admin) with color-coded badges",
        ],
      },
      {
        heading: "Security",
        items: [
          "Tenant isolation enforced on all 13+ dashboard API routes via shared auth utility",
          "Role-based access control — admin required for state-changing operations, viewer for reads",
          "OAuth state parameter signed with HMAC to prevent CSRF and state forgery",
          "Prompt injection guard always prepended to system prompts (cannot be removed by tenants)",
          "Error messages sanitized — no internal details leaked to clients",
          "Per-tenant email uniqueness constraint (same email can exist in different organizations)",
          "URL validation and hostname allowlists on all external fetch operations",
          "Pagination bounded to prevent memory-heavy queries",
        ],
      },
      {
        heading: "Performance",
        items: [
          "Stats route optimized — sentiment and theme counting from limited dataset instead of loading all rows",
          "Admin tenants route reduced from 2N queries to 3 total queries",
          "Bulk import processes contacts in parallel batches of 3 instead of serially",
          "Tab-focus no longer triggers full page reload (tenant resolution cached by user ID)",
        ],
      },
      {
        heading: "Pages & Navigation",
        items: [
          "Support page with FAQ, how-it-works guide, and contact information",
          "Release notes page (you\u2019re reading it)",
          "Privacy policy and terms of service with wehearyou.io contact emails",
          "Password reset flow with email link + new password form",
          "Cross-linking throughout — response cards link to person profiles, dashboard links to full lists",
          "Sidebar divider between data views and settings sections",
          "Sign out properly redirects to login page",
          "\u201CNo access\u201D page includes support link and sign out button",
        ],
      },
    ],
  },
  {
    version: "0.5",
    date: "March 31, 2026",
    title: "Foundation Release",
    summary:
      "The first version of We Hear You — a complete platform for capturing, analyzing, and classifying qualitative feedback from video and transcription sources.",
    sections: [
      {
        heading: "Dashboard",
        items: [
          "Overview page with real-time stats, sentiment breakdown, top themes, and recent responses",
          "People directory with filtering by persona, sentiment, and search",
          "Individual person profiles with full response timelines",
          "Response feed with full-text search and filtering by source, sentiment, and date",
        ],
      },
      {
        heading: "AI Analysis",
        items: [
          "Configurable analysis engine powered by Claude — define exactly what insights you want to extract",
          "Visual schema builder for adding custom fields (text, lists, choices, numbers, yes/no) without writing code",
          "System prompt editor for fine-tuning how the AI interprets your data",
          "Live preview — test your analysis configuration with a sample transcription before saving",
        ],
      },
      {
        heading: "Personas",
        items: [
          "Define custom personas with names, descriptions, and classification criteria",
          "Automatic classification — every new response is sorted into a persona",
          "Re-analyze existing responses when you update your persona definitions",
        ],
      },
      {
        heading: "Sources & Integrations",
        items: [
          "VideoAsk adapter — connect your VideoAsk forms with one webhook URL",
          "Custom adapter — send data from any tool that supports webhooks",
          "Per-source API keys with scoped permissions (ingest, read, admin)",
          "Webhook signature verification for secure data delivery",
        ],
      },
      {
        heading: "Organizations & Access",
        items: [
          "Multi-tenant architecture — each organization gets a fully isolated workspace",
          "Domain-based auto-provisioning — add an email domain and anyone at that company can sign up and join automatically",
          "Role-based access: Admin (full control) and Viewer (read-only)",
          "Email/password authentication with password reset flow",
        ],
      },
      {
        heading: "Security & Privacy",
        items: [
          "AES-256-GCM encryption for all personally identifiable information at rest",
          "Row-level security ensuring no organization can access another\u2019s data",
          "Per-tenant rate limiting to prevent API abuse",
          "Input sanitization and prompt injection defenses on all AI processing",
          "Security headers on all endpoints (HSTS, X-Content-Type-Options, X-Frame-Options)",
        ],
      },
      {
        heading: "Design",
        items: [
          "Light and dark mode with system preference detection",
          "Soft, minimal interface with peach, seafoam, and sunshine accents",
          "Instructional copy on every page — built for non-technical users",
          "Privacy policy, terms of service, and release notes",
        ],
      },
    ],
  },
];

export default function ReleasesPage() {
  return (
    <main className="min-h-screen flex justify-center px-4 py-16">
      <div className="max-w-2xl w-full">
        <div className="flex items-center justify-between mb-8">
          <Logo size="sm" />
          <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
            &larr; Back
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-2">Release Notes</h1>
        <p className="text-sm text-muted mb-10">
          What&apos;s new in We Hear You. We ship updates regularly — check back
          to see what&apos;s changed.
        </p>

        <div className="flex flex-col gap-12">
          {releases.map((release) => (
            <article key={release.version}>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-sm font-bold bg-accent/10 text-accent px-3 py-1 rounded-full">
                  v{release.version}
                </span>
                <span className="text-sm text-muted">{release.date}</span>
              </div>
              <h2 className="text-lg font-bold mb-1">{release.title}</h2>
              <p className="text-sm text-muted mb-6">{release.summary}</p>

              <div className="flex flex-col gap-5">
                {release.sections.map((section) => (
                  <div key={section.heading}>
                    <h3 className="text-sm font-medium mb-2">
                      {section.heading}
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {section.items.map((item, i) => (
                        <li
                          key={i}
                          className="text-sm text-muted pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[9px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-card-border"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
