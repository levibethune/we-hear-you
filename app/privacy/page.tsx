import Link from "next/link";
import { Logo } from "../components/Logo";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen flex justify-center px-4 py-16">
      <div className="max-w-2xl w-full">
        <div className="flex items-center justify-between mb-8">
          <Logo size="sm" />
          <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
            &larr; Back
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>

        <div className="flex flex-col gap-5 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="text-foreground font-medium mb-2">What We Collect</h2>
            <p>
              We Hear You collects email addresses for authentication, along with video
              transcriptions and associated metadata submitted through connected sources.
              Our AI analysis engine processes transcriptions to extract themes, sentiment,
              mood, and persona classifications as configured by your organization.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">How We Protect Your Data</h2>
            <p>
              All personally identifiable information — including names, emails, and
              transcription content — is encrypted at rest using AES-256-GCM encryption.
              Data is isolated per organization using row-level security policies, ensuring
              no organization can access another&apos;s data. All connections use HTTPS/TLS
              encryption in transit.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">AI Processing</h2>
            <p>
              Transcriptions are sent to Anthropic&apos;s Claude API for analysis. This
              processing extracts structured insights based on your organization&apos;s
              configuration. Transcription data is not used to train AI models. Analysis
              results are stored within your organization&apos;s isolated database space.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">Data Retention</h2>
            <p>
              Your data is retained for as long as your organization&apos;s account is active.
              Organization administrators can request data deletion at any time by contacting
              us. Upon account termination, all associated data is permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">Contact</h2>
            <p>
              For privacy inquiries, contact us at{" "}
              <a href="mailto:privacy@wehearyou.io" className="text-accent hover:underline">
                privacy@wehearyou.io
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
