import Link from "next/link";
import { Logo } from "../components/Logo";

const faqs = [
  {
    q: "I signed up but it says I have no access. What do I do?",
    a: "Your email domain needs to be added to an organization by an administrator. If you were invited to use We Hear You, ask the person who invited you to add your email domain in the Admin panel. If you\u2019re setting up your own organization, contact us at hello@wehearyou.io.",
  },
  {
    q: "How does the AI analysis work?",
    a: "When a response comes in (via webhook or import), we send the transcription to Claude, Anthropic\u2019s AI, which extracts themes, sentiment, mood, and persona classifications based on your configuration. The AI treats the transcription as data to analyze \u2014 it never follows instructions embedded in the text.",
  },
  {
    q: "Can other organizations see my data?",
    a: "No. Every organization is completely isolated. Your data, personas, analysis settings, and API keys are invisible to everyone outside your organization. We use row-level database security and encrypted storage to enforce this.",
  },
  {
    q: "How do I connect VideoAsk?",
    a: "Go to Connections in the sidebar, follow the step-by-step VideoAsk guide, and you\u2019ll be set up in a few minutes. You\u2019ll need to generate an API key and paste it into VideoAsk\u2019s webhook settings.",
  },
  {
    q: "Can I import responses that were recorded before I connected the webhook?",
    a: "Yes. Go to the Import page in the sidebar. You can paste individual VideoAsk share links for quick imports, or paste multiple links at once. For bulk imports via the VideoAsk API, you\u2019ll need to connect your VideoAsk account via OAuth.",
  },
  {
    q: "What are personas?",
    a: "Personas are categories you define to sort respondents. For example, \u201CChampion,\u201D \u201CSkeptic,\u201D and \u201CNew User.\u201D You give each persona a name, description, and classification criteria, and the AI automatically sorts every new response into the best-fitting persona.",
  },
  {
    q: "Can I customize what the AI looks for?",
    a: "Absolutely. On the Analysis Config page, you can add custom fields (text, lists, choices, numbers, yes/no), write your own system prompt, and preview the output before saving. The AI will extract exactly what you configure.",
  },
  {
    q: "Is my data encrypted?",
    a: "Yes. All personally identifiable information \u2014 names, emails, and transcriptions \u2014 is encrypted at rest using AES-256-GCM encryption. Data is also encrypted in transit via HTTPS.",
  },
  {
    q: "What\u2019s the difference between Admin and Viewer roles?",
    a: "Admins can modify analysis settings, manage personas, generate API keys, import data, and manage connections. Viewers have read-only access to people, responses, and insights.",
  },
];

export default function SupportPage() {
  return (
    <main className="min-h-screen flex justify-center px-4 py-16">
      <div className="max-w-2xl w-full">
        <div className="flex items-center justify-between mb-8">
          <Logo size="sm" />
          <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
            &larr; Back
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-2">Support</h1>
        <p className="text-sm text-muted mb-10">
          Find answers to common questions, learn how things work, or get in touch.
        </p>

        {/* FAQ */}
        <h2 className="text-base font-bold mb-4">Frequently Asked Questions</h2>
        <div className="flex flex-col gap-4 mb-12">
          {faqs.map((faq, i) => (
            <details key={i} className="soft-card p-4 group">
              <summary className="text-sm font-medium cursor-pointer list-none flex items-start justify-between gap-3">
                <span>{faq.q}</span>
                <span className="text-muted text-xs mt-0.5 shrink-0 group-open:rotate-180 transition-transform">&#9660;</span>
              </summary>
              <p className="text-sm text-muted mt-3 leading-relaxed">
                {faq.a}
              </p>
            </details>
          ))}
        </div>

        {/* How it works */}
        <h2 className="text-base font-bold mb-4">How We Hear You Works</h2>
        <div className="soft-card p-5 mb-12">
          <ol className="flex flex-col gap-4 text-sm text-muted list-decimal list-inside">
            <li>
              <strong className="text-foreground">Collect responses</strong>{" "}
              &mdash; Connect a tool like VideoAsk via webhook, or paste share
              links to import responses manually.
            </li>
            <li>
              <strong className="text-foreground">AI analyzes everything</strong>{" "}
              &mdash; Each response is sent to Claude, which extracts themes,
              sentiment, mood, and persona classifications based on your settings.
            </li>
            <li>
              <strong className="text-foreground">Explore insights</strong>{" "}
              &mdash; Browse your dashboard to see patterns, filter by persona
              or sentiment, search transcriptions, and understand what people
              are really saying.
            </li>
            <li>
              <strong className="text-foreground">Customize over time</strong>{" "}
              &mdash; Refine your personas, add new analysis fields, and let the
              AI suggest improvements as more data comes in.
            </li>
          </ol>
        </div>

        {/* Contact */}
        <h2 className="text-base font-bold mb-4">Get in Touch</h2>
        <div className="soft-card p-5">
          <p className="text-sm text-muted mb-4">
            Can&apos;t find what you&apos;re looking for? We&apos;re here to help.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted w-16">Email</span>
              <a
                href="mailto:hello@wehearyou.io"
                className="text-sm text-accent hover:underline"
              >
                hello@wehearyou.io
              </a>
            </div>
            <p className="text-xs text-muted">
              We typically respond within 24 hours on business days.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
