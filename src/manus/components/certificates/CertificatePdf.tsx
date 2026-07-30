import { Document, Image as PdfImage, Page, StyleSheet, Svg, Circle, Line, Text as PdfText, View } from "@react-pdf/renderer";

export type CertificatePdfProps = {
  studentName: string;
  courseTitle: string;
  issuedAt?: string | Date;
  certificateNumber: string;
  verifyUrl?: string;
};

/**
 * PDF twin of CertificateArtwork. Uses @react-pdf/renderer built-in
 * font stack (Helvetica/Times-Italic) so no external font files need to
 * ship. Colors and layout mirror the on-screen artwork.
 */
const styles = StyleSheet.create({
  page: {
    backgroundColor: "#F5F0E8",
    color: "#2E2A1E",
    padding: 0,
    fontFamily: "Helvetica",
  },
  outerBorder: {
    position: "absolute",
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderWidth: 1,
    borderColor: "#B08A3E",
  },
  innerBorder: {
    position: "absolute",
    top: 32,
    left: 32,
    right: 32,
    bottom: 32,
    borderWidth: 1,
    borderColor: "#D8B872",
  },
  body: {
    position: "absolute",
    top: 96,
    left: 110,
    right: 90,
    bottom: 96,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 3,
    color: "#B08A3E",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  name: {
    fontFamily: "Times-Roman",
    fontSize: 52,
    color: "#2E2A1E",
    marginTop: 14,
  },
  rule: {
    marginTop: 16,
    marginBottom: 14,
    width: 42,
    height: 2,
    backgroundColor: "#C46A3F",
  },
  preamble: { fontSize: 10, color: "#6B6552" },
  course: {
    fontFamily: "Times-Italic",
    fontSize: 20,
    color: "#2E2A1E",
    marginTop: 6,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#6B5A2E",
    paddingTop: 14,
  },
  metaLabel: {
    fontSize: 7,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#9C9782",
    fontFamily: "Helvetica-Bold",
  },
  metaValue: { fontSize: 9, color: "#2E2A1E", marginTop: 4 },
  metaCol: { flex: 1 },
  logo: {
    position: "absolute",
    left: 110,
    bottom: 42,
    height: 34,
    objectFit: "contain",
  },
  rail: {
    position: "absolute",
    left: 50,
    top: 0,
    bottom: 0,
    width: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  railText: {
    fontSize: 7,
    letterSpacing: 3,
    color: "#6B5A2E",
    fontFamily: "Helvetica-Bold",
    transform: "rotate(-90deg)",
    width: 400,
    textAlign: "center",
  },
});

function Seal() {
  const ticks = Array.from({ length: 24 }).map((_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return (
      <Line
        key={i}
        x1={50 + Math.cos(a) * 42}
        y1={50 + Math.sin(a) * 42}
        x2={50 + Math.cos(a) * 45}
        y2={50 + Math.sin(a) * 45}
        stroke="#B08A3E"
        strokeWidth={0.5}
      />
    );
  });
  return (
    <View style={{ position: "absolute", top: 60, right: 60, width: 90, height: 90 }}>
      <Svg viewBox="0 0 100 100" style={{ width: 90, height: 90 }}>
        <Circle cx="50" cy="50" r="46" fill="none" stroke="#B08A3E" strokeWidth={0.6} />
        <Circle cx="50" cy="50" r="40" fill="none" stroke="#B08A3E" strokeWidth={0.3} />
        <Circle cx="50" cy="50" r="28" fill="#B08A3E" fillOpacity={0.08} />
        <PdfText x={50} y={50} style={{ fontFamily: "Times-Roman", fontSize: 22, fill: "#B08A3E", textAnchor: "middle" }}>
          A
        </PdfText>
        {ticks}
      </Svg>
    </View>
  );
}

export function CertificatePdfDoc({
  studentName,
  courseTitle,
  issuedAt,
  certificateNumber,
  verifyUrl,
}: CertificatePdfProps) {
  const dateLabel = issuedAt
    ? new Date(issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <Document title={`Certificate — ${studentName}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.outerBorder} />
        <View style={styles.innerBorder} />
        <Seal />
        <View style={styles.rail}>
          <PdfText style={styles.railText}>
            CASA ALCHEMY STUDIO   ·   CERTIFICATE №  {certificateNumber}
          </PdfText>
        </View>

        <View style={styles.body}>
          <View>
            <PdfText style={styles.eyebrow}>CERTIFICATE OF COMPLETION</PdfText>
            <PdfText style={styles.name}>{studentName}</PdfText>
            <View style={styles.rule} />
            <PdfText style={styles.preamble}>has completed, with dedication and craft, the course</PdfText>
            <PdfText style={styles.course}>{courseTitle}</PdfText>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <PdfText style={styles.metaLabel}>ISSUED</PdfText>
              <PdfText style={styles.metaValue}>{dateLabel}</PdfText>
            </View>
            <View style={styles.metaCol}>
              <PdfText style={styles.metaLabel}>CERTIFICATE №</PdfText>
              <PdfText style={styles.metaValue}>{certificateNumber}</PdfText>
            </View>
            <View style={styles.metaCol}>
              <PdfText style={styles.metaLabel}>VERIFY AT</PdfText>
              <PdfText style={styles.metaValue}>{verifyUrl ?? "casaalchemystudio.com"}</PdfText>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
