"use client";

import { PdfDownloadButton } from "@/components/PdfDownloadButton";
import { buildReviewPdfBlocks } from "@/lib/pdf/blocks";
import { buildExportFilename } from "@/lib/pdf/filename";
import { renderPdfDocuments } from "@/lib/pdf/writer";
import type { ReviewContent } from "@/lib/reviews/schema";
import type { PdfLetterhead } from "@/lib/pdf/writer";

/** "Baixar PDF" do parecer (diagnóstico, avaliação, como desenvolveria, perguntas críticas). */
export function ReviewExportBar({
  content,
  meetingTitle,
  letterhead,
}: {
  content: ReviewContent;
  meetingTitle: string;
  letterhead: PdfLetterhead;
}) {
  return (
    <PdfDownloadButton
      filename={buildExportFilename("Parecer", meetingTitle, "pdf")}
      shareTitle={`Parecer — ${meetingTitle}`}
      buildPdf={() => renderPdfDocuments([buildReviewPdfBlocks(content, meetingTitle)], letterhead)}
    />
  );
}
