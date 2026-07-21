import LegalPageLayout from "./LegalPageLayout";

export default function DataDeletion() {
  return (
    <LegalPageLayout
      title="Account and data deletion"
      description="How to request deletion of your Casa Alchemy Academy account, disconnect Google Calendar and revoke access."
    >
      <p>
        You have the right to request deletion of your account and associated data at any time. This page describes the
        steps and what happens after your request.
      </p>

      <h2>1. Disconnect Google Calendar</h2>
      <p>
        If you connected your Google account to Casa Alchemy Academy, the first step is to revoke that connection:
      </p>
      <ul>
        <li>Sign in to the platform and go to <em>/profile</em>.</li>
        <li>In the "Google Calendar integration" card, click <strong>Disconnect</strong>.</li>
        <li>This action revokes the token with Google and deletes the connection from our database.</li>
        <li>
          Alternatively, you can revoke it directly from your Google Account:{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/permissions
          </a>.
        </li>
      </ul>

      <h2>2. Request account deletion</h2>
      <p>
        Send an email to{" "}
        <a href="mailto:contact@casaalchemystudio.com?subject=Account%20deletion">
          contact@casaalchemystudio.com
        </a>{" "}
        from the email address registered on the platform, with the subject <em>"Account deletion"</em>. We'll confirm your
        identity and process the request.
      </p>
      <div className="legal-callout">
        [CONFIRMATION REQUIRED] A self-service deletion flow inside the app is not yet available. Deletion is currently
        handled upon email request.
      </div>

      <h2>3. What is deleted</h2>
      <ul>
        <li>Profile data (name, avatar, biography, preferences).</li>
        <li>Course progress, notes, community comments and reactions.</li>
        <li>Event and workshop registrations.</li>
        <li>The Google Calendar connection and associated OAuth tokens.</li>
        <li>Issued certificates are no longer linked to your account.</li>
      </ul>

      <h2>4. What may be retained</h2>
      <p>
        We may keep minimal records required by law or necessary for security, fraud prevention and accounting obligations
        (for example, payment receipts processed via Stripe). These records remain in a restricted environment and are not
        used for other purposes.
      </p>

      <h2>5. Timeline</h2>
      <p>
        Deletion is processed within a reasonable time after your request is confirmed. [CONFIRMATION REQUIRED: official
        timeline to be confirmed by the responsible party.]
      </p>

      <h2>6. Contact</h2>
      <p>
        Questions: <a href="mailto:contact@casaalchemystudio.com">contact@casaalchemystudio.com</a>.
      </p>
    </LegalPageLayout>
  );
}