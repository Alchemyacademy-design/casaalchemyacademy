import LegalPageLayout from "./LegalPageLayout";

export default function Support() {
  return (
    <LegalPageLayout
      title="Support & Contact"
      description="How to reach Casa Alchemy Academy and resolve common issues with sign-in, courses and the Google Calendar integration."
    >
      <p>
        We're here to help. Before writing to us, check whether your question is already answered in the guides below.
      </p>

      <h2>Official channel</h2>
      <p>
        Email: <a href="mailto:contact@casaalchemystudio.com">contact@casaalchemystudio.com</a>
        <br />
        Company website:{" "}
        <a href="https://www.casaalchemystudio.com/" target="_blank" rel="noopener noreferrer">
          casaalchemystudio.com
        </a>
      </p>

      <h2>Sign-in issues</h2>
      <ul>
        <li>Make sure you're using the same email you signed up with.</li>
        <li>If you forgot your password, use <em>Reset password</em> on the sign-in screen.</li>
        <li>If you signed up with Google, use the <em>Continue with Google</em> button instead of email and password.</li>
        <li>If the confirmation email doesn't arrive, check your spam folder.</li>
      </ul>

      <h2>Course and certificate issues</h2>
      <ul>
        <li>Confirm that your subscription is active at <em>/profile</em>.</li>
        <li>Reload the course page; progress is saved automatically.</li>
        <li>Certificates appear at <em>/profile</em> as soon as the course criteria are met.</li>
      </ul>

      <h2>Google Calendar issues</h2>
      <ul>
        <li>The connection is optional and set up at <em>/profile</em>, under the "Google Calendar integration" card.</li>
        <li>If you authorized it and don't see the events, try disconnecting and connecting again.</li>
        <li>To revoke access directly from your Google Account, go to{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/permissions
          </a>.
        </li>
        <li>We only sync the Casa Alchemy Academy events and workshops you choose — we do not read your personal calendar.</li>
      </ul>

      <h2>Request account deletion</h2>
      <p>
        See <a href="/data-deletion">Account and data deletion</a> for the full procedure.
      </p>

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "var(--aa-text-light)" }}>
        Response time is provided on a best-effort basis. [CONFIRMATION REQUIRED: official support SLA, if one is defined.]
      </p>
    </LegalPageLayout>
  );
}