/**
 * PDF export for compliance reports using PDFKit.
 * Generates a formatted PDF document from a ComplianceReport object.
 */

import PDFDocument from "pdfkit";
import type {
  ComplianceReport,
  ComplianceGap,
  RegulationSummary,
  CertificateSummary,
} from "./compliance-report.js";

/** Options for PDF generation. */
export type PdfExportOptions = {
  readonly title?: string | undefined;
  readonly author?: string | undefined;
  readonly pageSize?: "A4" | "LETTER" | undefined;
};

const FONT_SIZE_TITLE = 20;
const FONT_SIZE_HEADING = 14;
const FONT_SIZE_SUBHEADING = 11;
const FONT_SIZE_BODY = 9;
const LINE_GAP = 2;
const SECTION_GAP = 18;

function addTitle(doc: InstanceType<typeof PDFDocument>, text: string): void {
  doc
    .fontSize(FONT_SIZE_TITLE)
    .font("Helvetica-Bold")
    .text(text)
    .moveDown(0.5);
}

function addHeading(doc: InstanceType<typeof PDFDocument>, text: string): void {
  doc
    .fontSize(FONT_SIZE_HEADING)
    .font("Helvetica-Bold")
    .text(text)
    .moveDown(0.3);
}

function addSubheading(doc: InstanceType<typeof PDFDocument>, text: string): void {
  doc
    .fontSize(FONT_SIZE_SUBHEADING)
    .font("Helvetica-Bold")
    .text(text)
    .moveDown(0.2);
}

function addBody(doc: InstanceType<typeof PDFDocument>, text: string): void {
  doc
    .fontSize(FONT_SIZE_BODY)
    .font("Helvetica")
    .text(text, { lineGap: LINE_GAP });
}

function addLabelValue(
  doc: InstanceType<typeof PDFDocument>,
  label: string,
  value: string,
): void {
  doc
    .fontSize(FONT_SIZE_BODY)
    .font("Helvetica-Bold")
    .text(`${label}: `, { continued: true })
    .font("Helvetica")
    .text(value);
}

function renderChainIntegrity(
  doc: InstanceType<typeof PDFDocument>,
  report: ComplianceReport,
): void {
  addHeading(doc, "Chain Integrity Verification");
  addLabelValue(doc, "Chain ID", report.chainId);
  addLabelValue(doc, "Total Entries", String(report.chainIntegrity.totalEntries));
  addLabelValue(doc, "Status", report.chainIntegrity.valid ? "VALID" : "INVALID");
  if (report.chainIntegrity.error) {
    addLabelValue(doc, "Error", report.chainIntegrity.error.type);
  }
  doc.moveDown(SECTION_GAP / 12);
}

function renderRegulationSummaries(
  doc: InstanceType<typeof PDFDocument>,
  summaries: ReadonlyArray<RegulationSummary>,
): void {
  addHeading(doc, "Regulation Summaries");
  for (const summary of summaries) {
    addSubheading(doc, summary.regulationName);
    addLabelValue(doc, "Regulation ID", summary.regulationId);
    addLabelValue(doc, "Total Requirements", String(summary.totalRequirements));
    addLabelValue(doc, "Applicable", String(summary.applicableRequirements));
    addLabelValue(doc, "Satisfied", String(summary.satisfiedRequirements));
    addLabelValue(
      doc,
      "Compliance Rate",
      `${(summary.complianceRate * 100).toFixed(1)}%`,
    );
    doc.moveDown(0.3);
  }
  doc.moveDown(SECTION_GAP / 12);
}

function renderGaps(
  doc: InstanceType<typeof PDFDocument>,
  gaps: ReadonlyArray<ComplianceGap>,
): void {
  addHeading(doc, "Compliance Gaps");
  if (gaps.length === 0) {
    addBody(doc, "No compliance gaps identified.");
    doc.moveDown(SECTION_GAP / 12);
    return;
  }

  for (const gap of gaps) {
    addSubheading(
      doc,
      `Entry #${gap.sequenceNumber} - ${gap.requirementTitle}`,
    );
    addLabelValue(doc, "Entry ID", gap.entryId);
    addLabelValue(doc, "Requirement", gap.requirementId);
    addLabelValue(doc, "Regulation", gap.regulationId);
    if (gap.missingFields.length > 0) {
      addLabelValue(doc, "Missing Fields", gap.missingFields.join(", "));
    }
    for (const gapDetail of gap.gaps) {
      addBody(doc, `  - ${gapDetail}`);
    }
    doc.moveDown(0.3);
  }
  doc.moveDown(SECTION_GAP / 12);
}

function renderCertificateSummaries(
  doc: InstanceType<typeof PDFDocument>,
  summaries: ReadonlyArray<CertificateSummary>,
): void {
  addHeading(doc, "Reasoning Certificate Summaries");
  if (summaries.length === 0) {
    addBody(doc, "No reasoning certificates present in this chain segment.");
    doc.moveDown(SECTION_GAP / 12);
    return;
  }

  for (const cert of summaries) {
    addSubheading(doc, `Certificate ${cert.certificateId}`);
    addLabelValue(doc, "Entry ID", cert.entryId);
    addLabelValue(doc, "Model", `${cert.modelProvider}/${cert.modelId}`);
    addLabelValue(doc, "Claims", String(cert.claimCount));
    addLabelValue(doc, "Unsupported Claims", String(cert.unsupportedClaimCount));
    addLabelValue(
      doc,
      "Confidence",
      `${cert.confidenceLevel} (${(cert.confidenceScore * 100).toFixed(1)}%)`,
    );
    doc.moveDown(0.3);
  }
  doc.moveDown(SECTION_GAP / 12);
}

function renderStatistics(
  doc: InstanceType<typeof PDFDocument>,
  report: ComplianceReport,
): void {
  addHeading(doc, "Report Statistics");
  addLabelValue(doc, "Total Entries", String(report.statistics.totalEntries));
  addLabelValue(
    doc,
    "Entries with Certificates",
    String(report.statistics.entriesWithCertificates),
  );
  addLabelValue(
    doc,
    "Entries with Provenance",
    String(report.statistics.entriesWithProvenance),
  );
  addLabelValue(doc, "Total Gaps", String(report.statistics.totalGaps));
  addLabelValue(
    doc,
    "Overall Compliance Rate",
    `${(report.statistics.overallComplianceRate * 100).toFixed(1)}%`,
  );
}

/**
 * Export a compliance report as a PDF document.
 * Returns a Buffer containing the PDF bytes.
 */
export function exportReportAsPdf(
  report: ComplianceReport,
  options?: PdfExportOptions,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: options?.pageSize ?? "A4",
      info: {
        Title: options?.title ?? `Compliance Report - ${report.chainId}`,
        Author: options?.author ?? "GridSeal",
        CreationDate: new Date(report.generatedAt),
      },
      bufferPages: true,
    });

    const chunks: Array<Buffer> = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (error: Error) => reject(error));

    addTitle(
      doc,
      options?.title ?? `Compliance Report`,
    );
    addLabelValue(doc, "Report ID", report.reportId);
    addLabelValue(doc, "Generated At", report.generatedAt);
    doc.moveDown(SECTION_GAP / 12);

    renderChainIntegrity(doc, report);
    renderRegulationSummaries(doc, report.regulationSummaries);
    renderGaps(doc, report.gaps);
    renderCertificateSummaries(doc, report.certificateSummaries);
    renderStatistics(doc, report);

    doc.end();
  });
}
