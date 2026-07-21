import LegalPageLayout from "./LegalPageLayout";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="How Casa Alchemy Academy collects, uses and protects your personal data, including the optional Google Calendar integration."
      updatedAt="July 21, 2026"
    >
      <p>
        This Policy explains how Casa Alchemy Academy handles personal data of users of the platform
        <em> casaalchemyacademy.lovable.app</em>. It is written in plain language and reflects how the app actually works.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Casa Alchemy Academy is an educational platform operated by Casa Alchemy Studio, offering courses, materials,
        workshops and live events for authenticated members. For privacy matters, write to{" "}
        <a href="mailto:contact@casaalchemystudio.com">contact@casaalchemystudio.com</a>.
      </p>

      <h2>2. Data we collect</h2>
      <ul>
        <li><strong>Sign-up and authentication:</strong> name, email, password (hashed) and sign-in provider (email or Google).</li>
        <li><strong>Profile:</strong> avatar, biography and preferences voluntarily provided by the user.</li>
        <li><strong>Platform usage:</strong> courses accessed, lessons completed, notes, community comments, event and workshop registrations, and issued certificates.</li>
        <li><strong>Support:</strong> messages sent through official channels.</li>
        <li><strong>Technical data:</strong> minimal logs required for security, fraud prevention and error diagnosis.</li>
      </ul>

      <h2>3. Purposes</h2>
      <ul>
        <li>Create and maintain your account and authenticate your sessions.</li>
        <li>Provide courses, events, workshops, certificates and the community area.</li>
        <li>Record registrations for events and workshops.</li>
        <li>Send operational communications related to your use of the platform.</li>
        <li>Comply with legal obligations and respond to data subject requests.</li>
      </ul>

      <h2>4. Use of Google Calendar data</h2>
      <p>
        Connecting your Google account to Casa Alchemy Academy is <strong>optional</strong> and requires your explicit consent.
        It is used exclusively to add, update and remove Casa Alchemy Academy events and workshops that you choose in your
        Google Calendar.
      </p>
      <ul>
        <li>Scope requested: <code>https://www.googleapis.com/auth/calendar.events</code>.</li>
        <li>We do not read or store other appointments on your personal calendar.</li>
        <li>We <strong>do not use</strong> Google Calendar data for advertising.</li>
        <li>We <strong>do not sell</strong> Google Calendar data to third parties.</li>
        <li>We <strong>do not build</strong> advertising profiles from this data.</li>
        <li>OAuth tokens are stored <strong>encrypted</strong> in the backend (AES-GCM) and are never sent to the frontend.</li>
        <li>You may disconnect your Google account at any time at <em>/profile</em>. Disconnecting revokes the token on Google's side and deletes the connection data from our database.</li>
      </ul>
      <div className="legal-callout">
        The use and transfer of information received from Google APIs to any other app adhere to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>,
        including the <em>Limited Use</em> requirements.
      </div>

      <h2>5. Sharing with service providers</h2>
      <p>We use the following providers, confirmed to be integrated with the app:</p>
      <ul>
        <li><strong>Supabase</strong> — database, authentication and backend functions.</li>
        <li><strong>Google</strong> — optional sign-in and Google Calendar integration when authorized by the user.</li>
        <li><strong>Stripe</strong> — subscription payment processing.</li>
        <li><strong>Resend</strong> — transactional email delivery.</li>
        <li><strong>HubSpot</strong> — management of leads who opt in to receive free materials.</li>
      </ul>

      <h2>6. Security</h2>
      <p>
        We apply controls such as encryption at rest for OAuth tokens, row-level security (RLS) policies in the database,
        JWT-based authentication and least-privilege principles in backend functions. No system is 100% secure, but we work
        continuously to mitigate risks.
      </p>

      <h2>7. Your rights</h2>
      <p>At any time you may:</p>
      <ul>
        <li>Access and update your profile data at <em>/profile</em>.</li>
        <li>Disconnect Google Calendar at <em>/profile</em>.</li>
        <li>Request deletion of your account and associated data — see{" "}
          <a href="/data-deletion">Account and data deletion</a>.
        </li>
        <li>Ask questions by writing to <a href="mailto:contact@casaalchemystudio.com">contact@casaalchemystudio.com</a>.</li>
      </ul>

      <h2>8. Retention</h2>
      <p>
        We keep data while your account is active and for as long as necessary to comply with legal, accounting and security
        obligations. After account deletion, identifying data is removed; minimal records may be retained where required by
        law (for example, payment receipts).
      </p>

      <h2>9. Contact</h2>
      <p>
        For questions about privacy or to exercise your rights, write to{" "}
        <a href="mailto:contact@casaalchemystudio.com">contact@casaalchemystudio.com</a>.
      </p>

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "var(--aa-text-light)" }}>
        This text was drafted based on how the app actually works and should be reviewed by the responsible legal party
        before being considered a definitive legal notice.
      </p>
    </LegalPageLayout>
  );
}