// Hidden anti-bot field. Named and flagged so password managers and Android
// autofill skip it; the server only flags (never rejects) a filled value.
export function HoneypotField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "none" }} aria-hidden="true">
      <input
        type="text"
        name="hp_company_url"
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        data-lpignore="true"
        data-form-type="other"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
