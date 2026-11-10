import { NextResponse } from "next/server";

export const runtime = "nodejs";

const maxSize = 15 * 1024 * 1024; // Up to 15 MB for lecture slides and course PDFs

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  const isFile =
    file &&
    typeof file === "object" &&
    typeof (file as unknown as Blob).arrayBuffer === "function" &&
    "name" in file;

  if (!isFile) {
    return NextResponse.json(
      { error: "Choose a .txt, .md, or .pdf note first." },
      { status: 400 }
    );
  }
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: "Use a note smaller than 15 MB." },
      { status: 413 }
    );
  }

  const name = file.name || "Uploaded note";
  const lowerName = name.toLowerCase();

  try {
    // 1. Text & Markdown Files
    if (
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".md") ||
      file.type.startsWith("text/")
    ) {
      const rawText = await file.text();
      const text = rawText.replace(/\r\n/g, "\n").trim().slice(0, 50_000);
      return NextResponse.json({
        title: name.replace(/\.(txt|md)$/i, ""),
        text,
      });
    }

    // 2. PDF Files (importing from pdf-parse/lib/pdf-parse.js directly to avoid the debug script in index.js)
    if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
      // Direct require/import of internal library avoids pdf-parse root debug ENOENT bug
      // @ts-expect-error - pdf-parse/lib/pdf-parse.js does not have distinct typedef declaration
      const pdfModule = await import("pdf-parse/lib/pdf-parse.js");
      const parsePdf = (typeof pdfModule.default === "function" ? pdfModule.default : pdfModule) as (
        buffer: Buffer
      ) => Promise<{ text: string; numpages: number }>;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await parsePdf(buffer);

      const text = result.text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim().slice(0, 50_000);
      if (!text) {
        return NextResponse.json(
          {
            error:
              "This PDF does not contain selectable text (it may be scanned images). You can copy/paste the notes instead.",
          },
          { status: 422 }
        );
      }

      return NextResponse.json({
        title: name.replace(/\.pdf$/i, ""),
        text,
        pages: result.numpages,
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Could not process this file (${errorMsg}). You can paste the note text directly.`,
      },
      { status: 422 }
    );
  }

  return NextResponse.json(
    { error: "Only .txt, .md, and .pdf documents are supported." },
    { status: 415 }
  );
}
