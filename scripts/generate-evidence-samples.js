// One-off generator for samples/evidence_images/*.jpg — synthetic placeholder site photos
// referenced by samples/contractor_daily_activity_evidence_demo.csv. Not part of the app;
// run manually with `node scripts/generate-evidence-samples.js` if you need to regenerate them.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const outDir = path.resolve(__dirname, "..", "samples", "evidence_images");
fs.mkdirSync(outDir, { recursive: true });

function svgPhoto({ bg, fg, title, subtitle, tag }) {
  return Buffer.from(`
    <svg width="1024" height="768" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg[0]}"/>
          <stop offset="100%" stop-color="${bg[1]}"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="768" fill="url(#g)"/>
      <rect x="24" y="24" width="976" height="720" fill="none" stroke="${fg}" stroke-width="4" stroke-dasharray="14,10"/>
      <text x="512" y="330" font-family="Arial, sans-serif" font-size="46" font-weight="bold" fill="${fg}" text-anchor="middle">${title}</text>
      <text x="512" y="390" font-family="Arial, sans-serif" font-size="28" fill="${fg}" text-anchor="middle">${subtitle}</text>
      <text x="512" y="700" font-family="Arial, sans-serif" font-size="20" fill="${fg}" text-anchor="middle" opacity="0.85">${tag}</text>
    </svg>
  `);
}

const photos = [
  {
    file: "site_before_renovation.jpg",
    bg: ["#78350f", "#451a03"],
    fg: "#fef3c7",
    title: "BEFORE — Anganwadi Renovation",
    subtitle: "Ward 12 · Site Baseline Photo",
    tag: "SAMPLE / SYNTHETIC — replace with a real site photo",
  },
  {
    file: "site_progress_wall_work.jpg",
    bg: ["#c2410c", "#7c2d12"],
    fg: "#ffedd5",
    title: "IN PROGRESS — Wall Plastering",
    subtitle: "Day 20 · Ward 12",
    tag: "SAMPLE / SYNTHETIC — replace with a real site photo",
  },
  {
    file: "site_final_handover.jpg",
    bg: ["#166534", "#052e16"],
    fg: "#dcfce7",
    title: "COMPLETED — Final Handover",
    subtitle: "Ward 12 · Anganwadi Renovation",
    tag: "SAMPLE / SYNTHETIC — replace with a real site photo",
  },
];

(async () => {
  for (const p of photos) {
    await sharp(svgPhoto(p)).jpeg({ quality: 90 }).toFile(path.join(outDir, p.file));
    console.log("wrote", p.file);
  }

  // Byte-for-byte duplicate of the "in progress" photo, uploaded later under a different
  // filename/date — this is the image-reuse demo (WORK_004: exact fileHash match).
  fs.copyFileSync(
    path.join(outDir, "site_progress_wall_work.jpg"),
    path.join(outDir, "site_progress_wall_work_reused.jpg")
  );
  console.log("wrote site_progress_wall_work_reused.jpg (exact duplicate)");
})();
