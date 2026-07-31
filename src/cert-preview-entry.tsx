import { createRoot } from "react-dom/client";
import { pdf } from "@react-pdf/renderer";
import { CertificatePdfDoc } from "./manus/components/certificates/CertificatePdf";

const root = document.getElementById("root")!;
createRoot(root).render(<div id="status">rendering…</div>);
void (async () => {
  const blob = await pdf(
    <CertificatePdfDoc
      studentName="Alex Alchemist"
      courseTitle="The path to a COLOURFUL life"
      certificateNumber="AA-PREVIEW-0000"
    />,
  ).toBlob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  buf.forEach((b) => (s += String.fromCharCode(b)));
  (window as unknown as { __pdf: string }).__pdf = btoa(s);
  document.title = "pdf-ready";
})();
