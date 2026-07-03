import { pdf } from "@react-pdf/renderer";
import { CertificatePdfDoc, type CertificatePdfProps } from "./CertificatePdf";

/** Client-side PDF generation → triggers a browser download. */
export async function downloadCertificatePdf(props: CertificatePdfProps) {
  const blob = await pdf(CertificatePdfDoc(props)).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Casa-Alchemy-Certificate-${props.certificateNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
