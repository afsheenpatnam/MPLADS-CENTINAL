/* eslint-disable no-console */
import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/db";
import { User } from "../models/User";
import { Project } from "../models/Project";
import { Sanction } from "../models/Sanction";
import { Milestone } from "../models/Milestone";
import { Progress } from "../models/Progress";
import { Expenditure } from "../models/Expenditure";
import { SiteVisit } from "../models/SiteVisit";
import { Evidence } from "../models/Evidence";
import { Condition } from "../models/Condition";
import { Finding } from "../models/Finding";
import { RiskAssessment } from "../models/RiskAssessment";
import { AuditLog } from "../models/AuditLog";
import { AIReport } from "../models/AIReport";
import { Clarification } from "../models/Clarification";
import { ExceptionRequest } from "../models/ExceptionRequest";
import { ProjectDocument } from "../models/Document";
import { Activity } from "../models/Activity";
import { runDetectionPipeline } from "../services/detection/detectionPipeline";

const DEMO_PASSWORD = "Demo@123";

const DISTRICTS = [
  { state: "Uttar Pradesh", district: "Lucknow", lat: 26.8467, lng: 80.9462 },
  { state: "Maharashtra", district: "Pune", lat: 18.5204, lng: 73.8567 },
  { state: "Karnataka", district: "Mysuru", lat: 12.2958, lng: 76.6394 },
  { state: "Tamil Nadu", district: "Madurai", lat: 9.9252, lng: 78.1198 },
  { state: "West Bengal", district: "Howrah", lat: 22.5958, lng: 88.2636 },
  { state: "Rajasthan", district: "Jodhpur", lat: 26.2389, lng: 73.0243 },
];

const PROJECT_TYPES = ["Road Construction", "Drinking Water Supply", "Community Hall", "School Building", "Drainage System", "Solar Street Lighting"];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function clearDatabase() {
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Sanction.deleteMany({}),
    Condition.deleteMany({}),
    Milestone.deleteMany({}),
    Progress.deleteMany({}),
    Expenditure.deleteMany({}),
    SiteVisit.deleteMany({}),
    Evidence.deleteMany({}),
    ProjectDocument.deleteMany({}),
    Finding.deleteMany({}),
    RiskAssessment.deleteMany({}),
    AIReport.deleteMany({}),
    Clarification.deleteMany({}),
    ExceptionRequest.deleteMany({}),
    AuditLog.deleteMany({}),
    Activity.deleteMany({}),
  ]);
}

async function createUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const officers = await User.insertMany(
    ["Officer A. Sharma", "Officer R. Nair", "Officer M. Iyer"].map((name, i) => ({
      name,
      email: i === 0 ? "officer@mplad.local" : `officer${i + 1}@mplad.local`,
      passwordHash,
      role: "OFFICER",
      department: "District Development Office",
    }))
  );

  const contractorNames = [
    "Shree Infra Builders", "Ganga Construction Co.", "Sunrise Civil Works", "Metro Roadways Pvt Ltd",
    "Vishwakarma Contractors", "Bluewave Engineering", "Nirman Associates", "Prime Structures Ltd",
  ];
  const contractors = await User.insertMany(
    contractorNames.map((name, i) => ({
      name,
      email: i === 0 ? "contractor@mplad.local" : `contractor${i + 1}@mplad.local`,
      passwordHash,
      role: "CONTRACTOR",
      phone: `9${String(800000000 + i * 111111).slice(0, 9)}`,
    }))
  );

  return { officers, contractors };
}

let projectCounter = 0;
async function nextProjectCode() {
  projectCounter += 1;
  return `MPLAD-2026-${String(projectCounter).padStart(4, "0")}`;
}

interface BuildOpts {
  officerId: Types.ObjectId;
  contractorId: Types.ObjectId;
  name: string;
  elapsedPercent: number; // 0-150, drives startDate/endDate
  durationMonths: number;
  sanctionedAmount: number;
  spentPercent: number;
  actualProgress: number;
  requiredVisits: number;
  actualVisits: number;
  approvedQuantity: number;
  reportedQuantity?: number;
  locationMismatch?: boolean;
  imageReuse?: boolean;
  missingJustification?: boolean;
  duplicateInvoice?: boolean;
}

async function buildProject(opts: BuildOpts) {
  const loc = pick(DISTRICTS);
  const durationMs = opts.durationMonths * 30 * 24 * 60 * 60 * 1000;
  const elapsedMs = (opts.elapsedPercent / 100) * durationMs;
  const startDate = new Date(Date.now() - elapsedMs);
  const endDate = new Date(startDate.getTime() + durationMs);

  const project = await Project.create({
    projectCode: await nextProjectCode(),
    name: opts.name,
    description: `${opts.name} under MPLAD scheme in ${loc.district}, ${loc.state}.`,
    projectType: pick(PROJECT_TYPES),
    state: loc.state,
    district: loc.district,
    location: `${loc.district} Ward ${Math.ceil(Math.random() * 20)}`,
    latitude: loc.lat + rand(-0.01, 0.01),
    longitude: loc.lng + rand(-0.01, 0.01),
    officerId: opts.officerId,
    contractorId: opts.contractorId,
    sanctionedAmount: opts.sanctionedAmount,
    releasedAmount: opts.sanctionedAmount * 0.9,
    spentAmount: (opts.sanctionedAmount * opts.spentPercent) / 100,
    startDate,
    endDate,
    approvedWork: `Construction and completion of ${opts.name.toLowerCase()} as per sanctioned estimate.`,
    approvedQuantity: opts.approvedQuantity,
    approvedMaterials: "Cement, steel, aggregate as per PWD schedule of rates",
    expectedProgress: Number(opts.elapsedPercent.toFixed(1)),
    actualProgress: opts.actualProgress,
    status: "ACTIVE",
  });

  await Sanction.create({
    projectId: project._id,
    sanctionedAmount: opts.sanctionedAmount,
    duration: opts.durationMonths,
    approvedWork: project.approvedWork,
    approvedQuantity: opts.approvedQuantity,
    approvedMaterials: project.approvedMaterials,
    financialConditions: ["Funds to be utilized strictly for sanctioned work"],
    timelineConditions: [`Work to be completed within ${opts.durationMonths} months`],
    workConditions: ["Work must match approved specifications"],
    evidenceConditions: ["Geo-tagged photographs required for each progress update"],
    visitConditions: [`Minimum ${opts.requiredVisits} site visits required`],
    otherConditions: [],
    requiredVisits: opts.requiredVisits,
    status: "APPROVED",
    approvedBy: opts.contractorId,
    approvedAt: daysAgo(1),
    createdBy: opts.officerId,
  });

  await Milestone.insertMany([
    { projectId: project._id, name: "Foundation", expectedDate: new Date(startDate.getTime() + durationMs * 0.25), expectedProgress: 25, actualProgress: Math.min(opts.actualProgress, 25), status: opts.actualProgress >= 25 ? "COMPLETED" : "DELAYED" },
    { projectId: project._id, name: "Structure", expectedDate: new Date(startDate.getTime() + durationMs * 0.6), expectedProgress: 60, actualProgress: Math.min(opts.actualProgress, 60), status: opts.actualProgress >= 60 ? "COMPLETED" : "PENDING" },
    { projectId: project._id, name: "Finishing", expectedDate: endDate, expectedProgress: 100, actualProgress: Math.min(opts.actualProgress, 100), status: opts.actualProgress >= 100 ? "COMPLETED" : "PENDING" },
  ]);

  await Progress.create({
    projectId: project._id,
    submittedBy: opts.contractorId,
    date: daysAgo(5),
    physicalProgress: opts.actualProgress,
    reportedWork: opts.imageReuse
      ? "Completed excavation and laid foundation concrete as per plan"
      : project.approvedWork,
    reportedQuantity: opts.reportedQuantity,
    remarks: "Routine progress update",
  });

  await Expenditure.create({
    projectId: project._id,
    submittedBy: opts.contractorId,
    date: daysAgo(10),
    amount: project.spentAmount,
    category: "Materials & Labour",
    invoiceNumber: opts.duplicateInvoice ? "INV-DUPLICATE-001" : `INV-${project.projectCode}`,
    vendor: "Local Supplier Co-op",
    justification: opts.missingJustification ? "" : "Payment for materials and labour as per measurement book",
  });

  if (opts.duplicateInvoice) {
    // Create a second document with the same invoice number on a different expenditure to trigger FINANCIAL_004
    const secondExpenditure = await Expenditure.create({
      projectId: project._id,
      submittedBy: opts.contractorId,
      date: daysAgo(8),
      amount: project.spentAmount * 0.4,
      category: "Materials & Labour",
      invoiceNumber: "INV-DUPLICATE-001",
      vendor: "Local Supplier Co-op",
      justification: "Additional material procurement",
    });
    await ProjectDocument.create({
      projectId: project._id,
      uploadedBy: opts.contractorId,
      type: "INVOICE",
      fileName: "invoice-1.pdf",
      filePath: "seed/invoice-1.pdf",
      documentHash: "seedhash-duplicate-0001",
      amount: project.spentAmount,
      invoiceNumber: "INV-DUPLICATE-001",
      vendor: "Local Supplier Co-op",
    });
    await ProjectDocument.create({
      projectId: project._id,
      uploadedBy: opts.contractorId,
      type: "INVOICE",
      fileName: "invoice-1-copy.pdf",
      filePath: "seed/invoice-1-copy.pdf",
      documentHash: "seedhash-duplicate-0001",
      amount: secondExpenditure.amount,
      invoiceNumber: "INV-DUPLICATE-001",
      vendor: "Local Supplier Co-op",
    });
  }

  for (let i = 0; i < opts.actualVisits; i++) {
    await SiteVisit.create({
      projectId: project._id,
      contractorId: opts.contractorId,
      date: daysAgo(30 - i * 4),
      latitude: project.latitude + rand(-0.0005, 0.0005),
      longitude: project.longitude + rand(-0.0005, 0.0005),
      remarks: "Site visit completed, work in progress",
      status: "COMPLETED",
    });
  }

  if (opts.locationMismatch) {
    await Evidence.create({
      projectId: project._id,
      uploadedBy: opts.contractorId,
      fileName: "site-photo-mismatch.jpg",
      filePath: "seed/site-photo-mismatch.jpg",
      fileType: "image/jpeg",
      latitude: project.latitude + 0.05, // ~5.5km away
      longitude: project.longitude + 0.05,
      timestamp: daysAgo(6),
      fileHash: `seedhash-${project.projectCode}-mismatch`,
      perceptualHash: "1010101010101010101010101010101010101010101010101010101010101a".slice(0, 64),
      similarityResults: [],
      validationStatus: "VALID",
      metadata: { gpsStatus: "AVAILABLE" },
    });
  } else {
    await Evidence.create({
      projectId: project._id,
      uploadedBy: opts.contractorId,
      fileName: "site-photo.jpg",
      filePath: "seed/site-photo.jpg",
      fileType: "image/jpeg",
      latitude: project.latitude + rand(-0.0003, 0.0003),
      longitude: project.longitude + rand(-0.0003, 0.0003),
      timestamp: daysAgo(6),
      fileHash: `seedhash-${project.projectCode}-normal`,
      perceptualHash: Array.from({ length: 64 }, () => (Math.random() > 0.5 ? "1" : "0")).join(""),
      similarityResults: [],
      validationStatus: "VALID",
      metadata: { gpsStatus: "AVAILABLE" },
    });
  }

  if (opts.imageReuse) {
    const sharedHash = "1111000011110000111100001111000011110000111100001111000011110";
    const original = await Evidence.create({
      projectId: project._id,
      uploadedBy: opts.contractorId,
      fileName: "progress-photo-original.jpg",
      filePath: "seed/progress-photo-original.jpg",
      fileType: "image/jpeg",
      latitude: project.latitude,
      longitude: project.longitude,
      timestamp: daysAgo(20),
      fileHash: `seedhash-${project.projectCode}-orig`,
      perceptualHash: sharedHash,
      similarityResults: [],
      validationStatus: "VALID",
      metadata: { gpsStatus: "AVAILABLE" },
    });
    await Evidence.create({
      projectId: project._id,
      uploadedBy: opts.contractorId,
      fileName: "progress-photo-reused.jpg",
      filePath: "seed/progress-photo-reused.jpg",
      fileType: "image/jpeg",
      latitude: project.latitude,
      longitude: project.longitude,
      timestamp: daysAgo(3),
      fileHash: `seedhash-${project.projectCode}-reuse`,
      perceptualHash: sharedHash,
      similarityResults: [
        { comparedEvidenceId: original._id, similarityScore: 96.8, comparisonType: "PERCEPTUAL_HASH" },
      ],
      validationStatus: "SUSPICIOUS",
      metadata: { gpsStatus: "AVAILABLE" },
    });
  }

  return project;
}

async function run() {
  await connectDatabase();
  console.log("[seed] clearing existing data...");
  await clearDatabase();

  console.log("[seed] creating users...");
  const { officers, contractors } = await createUsers();

  console.log("[seed] creating projects (this runs the full detection pipeline per project)...");

  // SCENARIO 1 — Normal project -> LOW
  await buildProject({
    officerId: officers[0]._id, contractorId: contractors[0]._id, name: "Village Road Resurfacing",
    elapsedPercent: 40, durationMonths: 12, sanctionedAmount: 3000000, spentPercent: 38, actualProgress: 40,
    requiredVisits: 8, actualVisits: 4, approvedQuantity: 1000, reportedQuantity: 1010,
  }).then((p) => runDetectionPipeline(p._id));

  // SCENARIO 2 — Progress anomaly (11 months into 12, 90% expected, 20% actual)
  await buildProject({
    officerId: officers[0]._id, contractorId: contractors[1]._id, name: "Community Drinking Water Scheme",
    elapsedPercent: 92, durationMonths: 12, sanctionedAmount: 4000000, spentPercent: 45, actualProgress: 20,
    requiredVisits: 8, actualVisits: 6, approvedQuantity: 1000, reportedQuantity: 1000,
  }).then((p) => runDetectionPipeline(p._id));

  // SCENARIO 3 — Cost-progress mismatch (90% spent, 20% progress)
  await buildProject({
    officerId: officers[1]._id, contractorId: contractors[2]._id, name: "Primary School Renovation",
    elapsedPercent: 55, durationMonths: 10, sanctionedAmount: 5000000, spentPercent: 90, actualProgress: 20,
    requiredVisits: 6, actualVisits: 5, approvedQuantity: 800, reportedQuantity: 810,
  }).then((p) => runDetectionPipeline(p._id));

  // SCENARIO 4 — Visit violation (required 8, actual 3)
  await buildProject({
    officerId: officers[1]._id, contractorId: contractors[3]._id, name: "Community Hall Construction",
    elapsedPercent: 50, durationMonths: 12, sanctionedAmount: 3500000, spentPercent: 48, actualProgress: 45,
    requiredVisits: 8, actualVisits: 3, approvedQuantity: 500, reportedQuantity: 505,
  }).then((p) => runDetectionPipeline(p._id));

  // SCENARIO 5 — Image reuse warning
  await buildProject({
    officerId: officers[2]._id, contractorId: contractors[4]._id, name: "Drainage Channel Construction",
    elapsedPercent: 60, durationMonths: 12, sanctionedAmount: 2800000, spentPercent: 55, actualProgress: 50,
    requiredVisits: 6, actualVisits: 5, approvedQuantity: 1200, reportedQuantity: 1180, imageReuse: true,
  }).then((p) => runDetectionPipeline(p._id));

  // SCENARIO 6 — Location mismatch
  await buildProject({
    officerId: officers[2]._id, contractorId: contractors[5]._id, name: "Solar Street Lighting Phase 2",
    elapsedPercent: 45, durationMonths: 8, sanctionedAmount: 1800000, spentPercent: 40, actualProgress: 42,
    requiredVisits: 5, actualVisits: 4, approvedQuantity: 150, reportedQuantity: 150, locationMismatch: true,
  }).then((p) => runDetectionPipeline(p._id));

  // SCENARIO 7 — Quantity deviation (approved 1000, reported 1500)
  await buildProject({
    officerId: officers[0]._id, contractorId: contractors[6]._id, name: "Culvert Construction Project",
    elapsedPercent: 65, durationMonths: 9, sanctionedAmount: 2200000, spentPercent: 60, actualProgress: 58,
    requiredVisits: 6, actualVisits: 6, approvedQuantity: 1000, reportedQuantity: 1500,
  }).then((p) => runDetectionPipeline(p._id));

  // SCENARIO 8 — MAIN DEMO: combines everything -> CRITICAL / HIGH PRIORITY
  const mainDemo = await buildProject({
    officerId: officers[0]._id, contractorId: contractors[7]._id, name: "Rural Road & Bridge Connectivity Project",
    elapsedPercent: 88, durationMonths: 12, sanctionedAmount: 5000000, spentPercent: 90, actualProgress: 20,
    requiredVisits: 8, actualVisits: 3, approvedQuantity: 1000, reportedQuantity: 1500,
    locationMismatch: true, imageReuse: true, missingJustification: true, duplicateInvoice: true,
  });
  await runDetectionPipeline(mainDemo._id);

  console.log(`[seed] MAIN DEMO project code: ${mainDemo.projectCode}`);

  // Additional variety: ~22 more randomized projects across risk spectrum
  const extraNames = [
    "Anganwadi Building Upgrade", "Public Toilet Complex", "Park Beautification Project", "Bus Shelter Construction",
    "Overhead Water Tank", "Village Library Building", "Sports Ground Development", "Crematorium Shed Construction",
    "Storm Water Drain Extension", "Foot Overbridge Construction", "Market Shed Construction", "Health Sub-Centre Building",
    "Panchayat Bhawan Renovation", "Irrigation Canal Lining", "Rural Electrification Extension", "Check Dam Construction",
    "Cattle Shed Cluster", "Skill Training Centre", "Cycle Track Development", "Playground Equipment Installation",
    "Waste Management Facility", "Street Lighting Upgrade",
  ];

  for (let i = 0; i < extraNames.length; i++) {
    const officer = pick(officers);
    const contractor = pick(contractors);
    const riskTier = Math.random();
    let elapsedPercent: number, spentPercent: number, actualProgress: number, actualVisits: number;
    const requiredVisits = pick([4, 6, 8]);

    if (riskTier < 0.5) {
      // normal-ish
      elapsedPercent = rand(10, 90);
      actualProgress = clampNum(elapsedPercent + rand(-8, 8), 0, 100);
      spentPercent = clampNum(actualProgress + rand(-10, 10), 0, 100);
      actualVisits = Math.round(requiredVisits * rand(0.75, 1));
    } else if (riskTier < 0.75) {
      // medium risk
      elapsedPercent = rand(50, 95);
      actualProgress = clampNum(elapsedPercent - rand(15, 30), 0, 100);
      spentPercent = clampNum(actualProgress + rand(10, 25), 0, 100);
      actualVisits = Math.round(requiredVisits * rand(0.4, 0.75));
    } else {
      // high risk
      elapsedPercent = rand(70, 100);
      actualProgress = clampNum(elapsedPercent - rand(35, 55), 0, 100);
      spentPercent = clampNum(actualProgress + rand(30, 50), 0, 120);
      actualVisits = Math.round(requiredVisits * rand(0.1, 0.4));
    }

    const project = await buildProject({
      officerId: officer._id,
      contractorId: contractor._id,
      name: extraNames[i],
      elapsedPercent,
      durationMonths: pick([6, 8, 9, 10, 12]),
      sanctionedAmount: rand(1000000, 6000000),
      spentPercent,
      actualProgress,
      requiredVisits,
      actualVisits,
      approvedQuantity: 1000,
      reportedQuantity: 1000 * rand(0.92, 1.08),
    });
    await runDetectionPipeline(project._id);
  }

  const totalProjects = await Project.countDocuments();
  console.log(`[seed] Done. ${totalProjects} projects created.`);
  console.log("[seed] Demo credentials (password for all): " + DEMO_PASSWORD);
  console.log("  Officer:    officer@mplad.local");
  console.log("  Contractor: contractor@mplad.local");

  await disconnectDatabase();
  await mongoose.connection.close().catch(() => undefined);
}

function clampNum(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

run().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
