import LegalPageLayout from "./LegalPageLayout";

export default function TermsOfUse() {
  return (
    <LegalPageLayout
      title="Terms of Use"
      description="Conditions of use for the Casa Alchemy Academy educational platform: sign-up, courses, events, workshops and optional integrations."
      updatedAt="July 21, 2026"
    >
      <p>
        These Terms govern the use of the Casa Alchemy Academy platform, available at{" "}
        <em>casaalchemyacademy.lovable.app</em>. By creating an account or accessing the service, you agree to these terms.
      </p>

      <h2>1. Acceptance</h2>
      <p>
        If you do not agree with these terms, do not use the platform. We may update this document; material changes will
        be communicated to authenticated users.
      </p>

      <h2>2. Sign-up and account security</h2>
      <ul>
        <li>You must provide accurate information at sign-up.</li>
        <li>You are responsible for safeguarding your credentials and for all activity on your account.</li>
        <li>You may sign in with email and password or with Google Sign-In.</li>
      </ul>

      <h2>3. Courses and materials</h2>
      <p>
        Active members have access to the courses, lessons, guides and supplementary materials published on the platform.
        Completion certificates are issued according to the criteria of each course.
      </p>

      <h2>4. Workshops and events</h2>
      <p>
        Live workshops and events are organized by Casa Alchemy Academy. Your registration is recorded on your account and
        can be synced with your Google Calendar when you authorize the integration.
      </p>

      <h2>5. Community and conduct</h2>
      <ul>
        <li>Treat other members with respect.</li>
        <li>Do not post illegal, offensive, discriminatory content or content that infringes third-party rights.</li>
        <li>Do not send spam or use the community for unauthorized commercial purposes.</li>
        <li>We reserve the right to moderate, remove content and suspend accounts that violate these rules.</li>
      </ul>

      <h2>6. Intellectual property</h2>
      <p>
        All content (lessons, text, images, videos, brand) is owned by Casa Alchemy Studio or its licensors. Copying,
        redistributing, reselling or sharing credentials and materials outside the platform is prohibited.
      </p>

      <h2>7. Third-party integrations</h2>
      <p>
        The platform integrates with Supabase, Google (sign-in and Google Calendar), Stripe, Resend and HubSpot. Each
        integration is also governed by the respective provider's terms. The Google Calendar connection is <strong>optional</strong>
        and can be revoked at any time at <em>/profile</em>.
      </p>

      <h2>8. Service availability</h2>
      <p>
        We aim to keep the platform continuously available, but the service may be subject to maintenance, updates or
        downtime. We do not guarantee uninterrupted or error-free operation.
      </p>

      <h2>9. Payments and subscriptions</h2>
      <p>
        Paid plans may be offered and processed via Stripe. Specific price, term and cancellation conditions are shown at
        the moment of purchase. [CONFIRMATION REQUIRED: final refund and cancellation policy to be validated by the
        commercial owner.]
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by applicable law, Casa Alchemy Academy shall not be liable for indirect damages,
        lost profits or loss of data arising from use of the platform.
      </p>

      <h2>11. Suspension and termination</h2>
      <p>
        We may suspend or terminate accounts that violate these terms. You may request termination of your account at any
        time as described in <a href="/data-deletion">Account and data deletion</a>.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update these terms. The current version will always display the update date at the top of this page.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:contact@casaalchemystudio.com">contact@casaalchemystudio.com</a>.
      </p>

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "var(--aa-text-light)" }}>
        This document should be reviewed by the responsible legal party before being considered definitive legal text.
        Venue, jurisdiction and governing law clauses depend on confirmation by the contracting entity.
      </p>
    </LegalPageLayout>
  );
}