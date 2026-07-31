import AdminTablePage from "@/manus/components/admin/AdminTablePage";

export function AdminCertificatesInner({ embedded = false }: { embedded?: boolean }) {
  return (
    <AdminTablePage
      noShell={embedded}
      title="Certificates"
      description="Issued course-completion certificates."
      table="certificates"
      orderBy={{ column: "issued_at", ascending: false }}
      searchFields={["certificate_number"]}
      publicInvalidateKeys={[["public", "certificates"]]}
      deletionMode="hard"
      fields={[
        { name: "certificate_number", label: "Number", type: "text", required: true },
        { name: "user_id", label: "User ID", type: "text", required: true },
        { name: "course_id", label: "Course ID", type: "number", required: true },
        { name: "issued_at", label: "Issued at", type: "datetime" },
        { name: "certificate_url", label: "URL", type: "text", hideInTable: true },
        { name: "metadata", label: "Metadata (JSON)", type: "json", hideInTable: true },
      ]}
    />
  );
}

export default function AdminCertificates() { return <AdminCertificatesInner />; }
