import type { Metadata } from "next";
import Link from "next/link";

import { ScreenHeader } from "@/components/ui/screen-header";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The rules and responsibilities of using ${siteConfig.name}.`,
};

const EFFECTIVE_DATE = "June 4, 2026";
const CONTACT_EMAIL = "support@wondavu.com";

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Terms of Service" back="/settings" />

      <article className="prose mx-auto max-w-2xl px-5 pb-12 pt-2 text-foreground">
        <p className="text-base text-muted">
          <strong>Effective date:</strong> {EFFECTIVE_DATE}
        </p>

        <p className="mt-4 text-lg leading-relaxed">
          Welcome to {siteConfig.name}. These Terms of Service (&ldquo;Terms&rdquo;)
          form a binding agreement between you and {siteConfig.name} (&ldquo;
          {siteConfig.name},&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or
          &ldquo;us&rdquo;). By creating an account or using {siteConfig.name},
          you agree to these Terms and to our{" "}
          <Link href="/privacy" className="text-glow underline">
            Privacy Policy
          </Link>
          . If you don&rsquo;t agree, please don&rsquo;t use the service.
        </p>

        <Section title="1. Who can use Wondavu">
          <p>
            You must be at least 16 years old (or the minimum digital-consent
            age in your country) to use {siteConfig.name}. If you&rsquo;re
            using the service on behalf of an organisation, you confirm
            you&rsquo;re authorised to bind that organisation.
          </p>
          <p>
            You agree to provide accurate information when you sign up, keep
            your password confidential, and let us know promptly if you suspect
            unauthorised access to your account.
          </p>
        </Section>

        <Section title="2. The traveler community">
          <p>
            {siteConfig.name} is a live social map for travelers. The service
            connects people who are physically nearby; you decide what to share,
            who to chat with, and which events to attend. We don&rsquo;t
            background-check users, and we can&rsquo;t guarantee anyone&rsquo;s
            identity or intentions.
          </p>
          <p>
            <strong>Meet smart.</strong> Read our{" "}
            <Link href="/safety" className="text-glow underline">
              safety tips
            </Link>{" "}
            before your first in-person meet-up. Trust your judgment, meet in
            public the first time, and tell someone where you&rsquo;re going.
          </p>
        </Section>

        <Section title="3. Your content">
          <p>
            You own the photos, messages, profile info, journal entries, and
            other content you post on {siteConfig.name} (&ldquo;Your Content&rdquo;).
            By posting Your Content, you grant {siteConfig.name} a worldwide,
            non-exclusive, royalty-free licence to host, store, reproduce,
            display, and adapt it solely to operate and improve the service —
            for example, generating image thumbnails, caching feed posts on our
            CDN, or surfacing your profile to other travelers in your region.
            This licence ends when you delete Your Content (subject to
            reasonable retention windows for backups and audit logs).
          </p>
          <p>
            You&rsquo;re responsible for Your Content. Don&rsquo;t post anything
            you don&rsquo;t have the right to share.
          </p>
        </Section>

        <Section title="4. Acceptable use">
          <p>You agree NOT to use {siteConfig.name} to:</p>
          <ul className="list-disc pl-6">
            <li>
              Harass, threaten, dox, impersonate, or sexually exploit anyone —
              especially minors. We will report violations to law enforcement.
            </li>
            <li>
              Post spam, scams, phishing links, malware, or paid promotions
              disguised as organic posts.
            </li>
            <li>
              Sell illegal goods or services, or arrange transactions that
              violate local law.
            </li>
            <li>
              Scrape, mass-download, reverse-engineer, or otherwise abuse the
              service infrastructure, our APIs, or third-party providers like
              Supabase or our map tiles.
            </li>
            <li>
              Misrepresent your identity, location, or age, or operate multiple
              accounts to evade a ban.
            </li>
            <li>
              Use {siteConfig.name} to train AI models, build derivative
              datasets, or otherwise extract user data in bulk without our
              explicit written permission.
            </li>
            <li>
              Interfere with the service&rsquo;s operation — including
              circumventing rate limits, gating logic, or safety reporting.
            </li>
          </ul>
        </Section>

        <Section title="5. Moderation, suspension, and removal">
          <p>
            We can remove content, suspend accounts, or close accounts that
            violate these Terms, our community guidelines, or applicable law —
            with or without notice depending on severity. We may also restrict
            features (e.g. group-chat creation, image uploads) for users with a
            history of violations.
          </p>
          <p>
            If your account is suspended or closed by mistake, email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-glow underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and we&rsquo;ll review.
          </p>
        </Section>

        <Section title="6. Susen, AI suggestions, and third-party content">
          <p>
            {siteConfig.name} includes AI-assisted features (notably the Susen
            chat concierge) and surfaces third-party content like restaurant
            listings, place ratings, and event details. These are provided for
            informational purposes only and can be inaccurate, out of date, or
            inappropriate for your situation. Don&rsquo;t rely on AI output for
            medical, legal, financial, or safety-critical decisions.
          </p>
        </Section>

        <Section title="7. Beta / changing features">
          <p>
            {siteConfig.name} is under active development. Features may be
            added, changed, or removed at any time. We&rsquo;ll do our best to
            give notice for material changes (e.g. closing a major surface),
            but we don&rsquo;t guarantee that any specific feature will remain
            available.
          </p>
        </Section>

        <Section title="8. Intellectual property">
          <p>
            {siteConfig.name}, our logos, the Wondavu name, the Susen persona,
            and the look and feel of the app are our intellectual property or
            licensed to us. You may not use our trademarks without written
            permission. Map tiles, place data, and other third-party content
            are licensed from the respective providers (CARTO, OpenStreetMap,
            etc.) under their own terms.
          </p>
        </Section>

        <Section title="9. Termination by you">
          <p>
            You can stop using {siteConfig.name} at any time and request
            account deletion via{" "}
            <Link href="/settings" className="text-glow underline">
              Settings
            </Link>{" "}
            or by emailing{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-glow underline"
            >
              {CONTACT_EMAIL}
            </a>
            . We&rsquo;ll delete or anonymise your data within 30 days, except
            where retention is required by law.
          </p>
        </Section>

        <Section title="10. Disclaimers">
          <p>
            {siteConfig.name} is provided &ldquo;as is&rdquo; and &ldquo;as
            available.&rdquo; We disclaim all warranties to the maximum extent
            permitted by law, including warranties of merchantability, fitness
            for a particular purpose, and non-infringement. We do not warrant
            that the service will be uninterrupted, secure, or error-free, or
            that any information presented through the service (including
            traveler recommendations, AI replies, place listings, and event
            details) is accurate.
          </p>
        </Section>

        <Section title="11. Limitation of liability">
          <p>
            To the maximum extent permitted by law, {siteConfig.name} and our
            affiliates won&rsquo;t be liable for any indirect, incidental,
            special, consequential, or punitive damages, or any loss of
            profits, revenue, data, or goodwill, arising out of or related to
            your use of the service. Our total liability for any claim arising
            from these Terms or the service is limited to the greater of (a)
            the amount you paid us in the 12 months before the event giving
            rise to the claim, or (b) USD $50.
          </p>
          <p>
            Some jurisdictions don&rsquo;t allow the exclusion of certain
            warranties or limitation of certain damages. In those
            jurisdictions, the above limitations apply only to the extent
            permitted.
          </p>
        </Section>

        <Section title="12. Indemnification">
          <p>
            You agree to indemnify and hold {siteConfig.name}, our affiliates,
            and our personnel harmless from any claims, damages, liabilities,
            and expenses (including reasonable legal fees) arising out of (a)
            Your Content, (b) your use of the service, (c) your violation of
            these Terms, or (d) your violation of any third-party right —
            except where prohibited by law.
          </p>
        </Section>

        <Section title="13. Governing law and disputes">
          <p>
            These Terms are governed by the laws of the jurisdiction where{" "}
            {siteConfig.name} is operated. Any disputes will be brought
            exclusively in the courts of that jurisdiction, unless you live in
            a country whose mandatory consumer-protection laws require
            otherwise. If a dispute can be resolved by emailing us, please try
            that first.
          </p>
        </Section>

        <Section title="14. Changes to these Terms">
          <p>
            We may update these Terms as {siteConfig.name} evolves. When we
            make material changes, we&rsquo;ll notify you in-app or by email
            before they take effect. Continuing to use the service after that
            point means you accept the new Terms; if you don&rsquo;t, please
            close your account.
          </p>
        </Section>

        <Section title="15. Contact">
          <p>
            Questions about these Terms? Reach us at{" "}
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
          These Terms are provided for informational purposes and are not legal
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
