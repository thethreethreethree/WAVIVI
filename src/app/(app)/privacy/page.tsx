import type { Metadata } from "next";

import { ScreenHeader } from "@/components/ui/screen-header";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${siteConfig.name} collects, uses, and protects your information.`,
};

const EFFECTIVE_DATE = "May 28, 2026";
const CONTACT_EMAIL = "privacy@wondavu.com";

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Privacy Policy" back="/settings" />

      <article className="prose mx-auto max-w-2xl px-5 pb-12 pt-2 text-foreground">
        <p className="text-base text-muted">
          <strong>Effective date:</strong> {EFFECTIVE_DATE}
        </p>

        <p className="mt-4 text-lg leading-relaxed">
          {siteConfig.name} (&ldquo;{siteConfig.name},&rdquo; &ldquo;we,&rdquo;
          &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is a live social map for
          travelers. This Privacy Policy explains what information we collect,
          how we use it, and the choices you have. By using {siteConfig.name},
          you agree to the practices described here.
        </p>

        <Section title="1. Who we are">
          <p>
            {siteConfig.name} is an installable progressive web app (PWA) that
            helps travelers discover nearby travelers, join group chats, find
            events, and feel the vibe of every place. If you have questions
            about this policy or your data, contact us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-glow underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="2. Information we collect">
          <h3 className="mt-4 text-xl font-bold">a) Information you give us</h3>
          <ul className="list-disc pl-6">
            <li>
              <strong>Account data:</strong> email address, password (stored as
              a one-way hash), display name, username.
            </li>
            <li>
              <strong>Profile data:</strong> avatar photo, bio, country flags,
              traveler identity preferences, and any quotes you write.
            </li>
            <li>
              <strong>Trip plans &amp; itineraries:</strong> destinations,
              dates, preferences you submit through the &ldquo;Where to
              next?&rdquo; questionnaire, saved stays, restaurants, and
              experiences.
            </li>
            <li>
              <strong>Social content:</strong> group-chat messages, direct
              messages, photos, reactions, and reports you submit.
            </li>
            <li>
              <strong>Verification info (optional):</strong> any identity
              materials you choose to upload for the &ldquo;Verified
              traveler&rdquo; badge.
            </li>
          </ul>

          <h3 className="mt-6 text-xl font-bold">
            b) Information collected automatically
          </h3>
          <ul className="list-disc pl-6">
            <li>
              <strong>Approximate location:</strong> when you tap
              &ldquo;What&rsquo;s near me&rdquo; or open the map, we ask your
              browser for geolocation. We never store your precise coordinates
              unless you explicitly check in to a place.
            </li>
            <li>
              <strong>Device &amp; usage data:</strong> browser type, screen
              size, language, time zone, and which pages you visit. Used to
              keep the app fast and debug issues.
            </li>
            <li>
              <strong>Cookies &amp; local storage:</strong> a session cookie
              from Supabase (our auth provider) keeps you signed in; local
              storage holds your theme choice, dismissed splash screens, and
              cached UI preferences. These do not track you across other
              websites.
            </li>
          </ul>

          <h3 className="mt-6 text-xl font-bold">
            c) Information from third parties
          </h3>
          <p>
            If you sign in through a social provider (e.g. Google), that
            provider shares basic profile info (name, email, avatar) with us
            per their own privacy terms.
          </p>
        </Section>

        <Section title="3. How we use your information">
          <ul className="list-disc pl-6">
            <li>To create and secure your {siteConfig.name} account.</li>
            <li>
              To show you relevant travelers, group chats, events, and
              recommended places near you.
            </li>
            <li>
              To match you with travel plans and itineraries that fit your
              questionnaire answers.
            </li>
            <li>
              To send service notifications (account verification, password
              resets, safety alerts) — we do not send marketing emails without
              your consent.
            </li>
            <li>To prevent fraud, abuse, harassment, and policy violations.</li>
            <li>To improve {siteConfig.name} based on aggregated usage.</li>
          </ul>
        </Section>

        <Section title="4. Who we share your information with">
          <p>
            We do not sell your personal information. We share data only with
            the following categories of recipients, and only as needed to
            operate {siteConfig.name}:
          </p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Other {siteConfig.name} travelers:</strong> your public
              profile (display name, username, avatar, bio, countries,
              identity) is visible to other signed-in users. Your private
              messages are visible only to recipients.
            </li>
            <li>
              <strong>Supabase:</strong> our backend provider. Stores account,
              profile, chat, and itinerary data. See{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noreferrer noopener"
                className="text-glow underline"
              >
                Supabase Privacy
              </a>
              .
            </li>
            <li>
              <strong>Vercel:</strong> our hosting provider. Serves the app and
              records basic request logs. See{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noreferrer noopener"
                className="text-glow underline"
              >
                Vercel Privacy
              </a>
              .
            </li>
            <li>
              <strong>CARTO &amp; OpenStreetMap:</strong> provide the map
              tiles. We send your map viewport (not your identity) to load
              tiles. See{" "}
              <a
                href="https://carto.com/privacy/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-glow underline"
              >
                CARTO Privacy
              </a>
              .
            </li>
            <li>
              <strong>Law-enforcement / legal requests:</strong> we may share
              data when legally required, or to protect the safety of our users
              or the public.
            </li>
            <li>
              <strong>Successor entities:</strong> if {siteConfig.name} is
              acquired, merged, or sold, your data may be transferred to the
              successor under the same protections as this policy.
            </li>
          </ul>
        </Section>

        <Section title="5. Where your data is stored">
          <p>
            Your data is stored on Supabase&rsquo;s managed Postgres
            infrastructure and on Vercel&rsquo;s global edge network.
            Depending on your region, your data may be processed in the United
            States, the European Union, or other jurisdictions where these
            providers operate. We rely on standard contractual clauses and the
            providers&rsquo; security certifications.
          </p>
        </Section>

        <Section title="6. How long we keep your data">
          <ul className="list-disc pl-6">
            <li>
              <strong>Account data:</strong> retained for as long as your
              account is active.
            </li>
            <li>
              <strong>Chat messages:</strong> retained until you or the other
              participant deletes them, or until the group is removed.
            </li>
            <li>
              <strong>Itineraries &amp; saved places:</strong> retained until
              you delete them.
            </li>
            <li>
              <strong>Request logs:</strong> retained by Vercel for up to 30
              days for debugging and security.
            </li>
            <li>
              <strong>Deleted accounts:</strong> we delete or anonymize your
              data within 30 days of an account-deletion request, except where
              we&rsquo;re required to keep it for legal or fraud-prevention
              reasons.
            </li>
          </ul>
        </Section>

        <Section title="7. Your rights">
          <p>
            Depending on where you live, you may have the right to:
          </p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Access</strong> a copy of the personal data we hold about
              you.
            </li>
            <li>
              <strong>Correct</strong> data that is inaccurate or out of date.
            </li>
            <li>
              <strong>Delete</strong> your account and associated data.
            </li>
            <li>
              <strong>Export</strong> your data in a portable format.
            </li>
            <li>
              <strong>Object</strong> to certain processing, including for
              direct marketing (we don&rsquo;t do this anyway).
            </li>
            <li>
              <strong>Withdraw consent</strong> at any time where we rely on
              consent.
            </li>
          </ul>
          <p>
            To exercise any of these rights, email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-glow underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            from the email associated with your account. We respond within 30
            days. EU/UK residents may also lodge a complaint with their local
            data-protection authority; California residents have the rights
            described in the CCPA/CPRA.
          </p>
        </Section>

        <Section title="8. Security">
          <p>
            We use industry-standard safeguards: TLS in transit, encrypted
            storage at rest, hashed passwords, scoped row-level security in
            Postgres, and audit logging. No system is perfectly secure, so we
            also encourage you to use a strong, unique password and to enable
            additional account-protection features when offered.
          </p>
        </Section>

        <Section title="9. Children">
          <p>
            {siteConfig.name} is not intended for children under 16. We do not
            knowingly collect data from anyone under 16. If you believe a child
            has provided us data, contact{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-glow underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and we will delete it.
          </p>
        </Section>

        <Section title="10. Cookies &amp; tracking">
          <p>
            We use only the cookies and local-storage entries necessary to
            run the app:
          </p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Authentication cookie</strong> (Supabase) — keeps you
              signed in.
            </li>
            <li>
              <strong>Theme &amp; preferences</strong> — remembers your dark /
              cute / orange / sketch theme choice, dismissed splash, etc.
            </li>
            <li>
              <strong>Diagnostic logs</strong> (Vercel) — basic request logs.
            </li>
          </ul>
          <p>
            We do not use third-party advertising cookies, cross-site tracking
            pixels, or behavioral-ad networks.
          </p>
        </Section>

        <Section title="11. International transfers">
          <p>
            If you are outside the United States, your information will be
            transferred to and processed in countries where our providers
            operate. We rely on standard contractual clauses or equivalent
            mechanisms to keep your data protected.
          </p>
        </Section>

        <Section title="12. Changes to this policy">
          <p>
            We&rsquo;ll update this policy as {siteConfig.name} grows. When we
            make material changes, we&rsquo;ll notify you in-app or by email
            before the changes take effect. The &ldquo;Effective date&rdquo;
            above always reflects the current version.
          </p>
        </Section>

        <Section title="13. Contact us">
          <p>
            Questions, requests, or concerns? Reach us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-glow underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <p className="mt-8 text-sm text-muted">
          This policy is provided for informational purposes and is not legal
          advice. If you operate {siteConfig.name} in a regulated jurisdiction,
          consult qualified counsel to confirm compliance with applicable laws.
        </p>
      </article>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-2xl font-bold">{title}</h2>
      <div className="space-y-3 text-base leading-relaxed">{children}</div>
    </section>
  );
}
