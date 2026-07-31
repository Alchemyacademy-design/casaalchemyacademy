import { createRoot } from "react-dom/client";
import CertificateArtwork from "./manus/components/certificates/CertificateArtwork";

createRoot(document.getElementById("root")!).render(
  <CertificateArtwork
    studentName="Alex Alchemist"
    courseTitle="The path to a COLOURFUL life"
    certificateNumber="AA-PREVIEW-0000"
    issuedAt={new Date("2026-07-30")}
  />,
);
