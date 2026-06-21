import MemberLayout from "@/manus/components/MemberLayout";
import { Link } from "wouter";
import { ArrowLeft, Download } from "lucide-react";

const CURRENT_ISSUE = {
  title: "Winter 2026",
  date: "December 2025 - February 2026",
  videoUrl: "/manus-storage/Winter26(1)_a8a1dfca.mp4",
  description: "Discover the latest trends in winter interior design, cozy color palettes, and how to create warm, inviting spaces during the colder months. Join Lorena as she explores layering techniques, textile selection, and creating ambiance with lighting.",
};

const ARCHIVES = [
  {
    id: 1,
    title: "Autumn 2026",
    date: "March - June 2026",
    fileUrl: "/manus-storage/Autumn26_72d46f26.pdf",
    fileType: "PDF",
    fileSize: "56 MB",
    thumbnail: "/manus-storage/Autumn26winter26(2)_4494b1e7.png",
  },
];

export default function Magazine() {
  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        {/* Back Button */}
        <Link href="/dashboard">
          <a className="flex items-center gap-2 mb-8 text-sm" style={{ color: "var(--aa-text-mid)" }}>
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </a>
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="font-serif text-4xl md:text-5xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            Magazine
          </h1>
          <p className="text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            Exclusive insights and inspiration for members.
          </p>
        </div>

        {/* Current Issue Section */}
        <div className="mb-16">
          <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
            Current Issue
          </h2>
          <div className="p-8 rounded-lg" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Video Player */}
              <div className="flex justify-center">
                <video
                  controls
                  style={{
                    width: "100%",
                    maxWidth: "400px",
                    height: "auto",
                    borderRadius: "8px",
                    backgroundColor: "var(--aa-cacao)",
                    aspectRatio: "9/16",
                    objectFit: "contain",
                  }}
                >
                  <source src={CURRENT_ISSUE.videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Issue Details */}
              <div className="flex flex-col justify-center">
                <p className="text-xs mb-3" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {CURRENT_ISSUE.date}
                </p>
                <h3 className="font-serif text-3xl mb-4" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                  {CURRENT_ISSUE.title}
                </h3>
                <p className="text-sm mb-6" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", lineHeight: "1.6" }}>
                  {CURRENT_ISSUE.description}
                </p>
                <a
                  href={CURRENT_ISSUE.videoUrl}
                  download
                  style={{
                    backgroundColor: "var(--aa-gold)",
                    color: "var(--aa-cacao)",
                    padding: "12px 24px",
                    borderRadius: "4px",
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    border: "none",
                    cursor: "pointer",
                    display: "inline-block",
                    textDecoration: "none",
                  }}
                >
                  Download This Issue
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Archives Section */}
        <div>
          <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
            Archives
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ARCHIVES.map((archive) => (
              <a
                key={archive.id}
                href={archive.fileUrl}
                download
                className="group cursor-pointer hover:shadow-lg transition"
                style={{
                  border: "1px solid var(--aa-cream-dark)",
                  backgroundColor: "var(--aa-white)",
                  borderRadius: "8px",
                  overflow: "hidden",
                  textDecoration: "none",
                }}
              >
                {/* Archive Thumbnail */}
                <div
                  className="relative overflow-hidden"
                  style={{
                    backgroundColor: "var(--aa-cacao)",
                    height: "400px",
                    backgroundImage: archive.thumbnail ? `url('${archive.thumbnail}')` : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition" />
                </div>

                {/* Archive Info */}
                <div className="p-6">
                  <p className="text-xs mb-2" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em" }}>
                    {archive.date}
                  </p>
                  <h3 className="font-serif text-lg mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                    {archive.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                      {archive.fileSize}
                    </span>
                    <Download size={16} style={{ color: "var(--aa-gold)" }} />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-border/50">
          <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:bg-card transition">
            ← Back
          </a>
          <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg btn-gold transition">
            Exit
          </a>
        </div>
    </MemberLayout>
  );
}
