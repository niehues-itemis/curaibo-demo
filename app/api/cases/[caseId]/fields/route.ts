import { NextRequest, NextResponse } from "next/server";
import { updateCaseField, getAllFields } from "@/lib/storage/case-store";
import type { FieldStatus } from "@/lib/extraction/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const body = await req.json();
    const { groupId, fieldId, instanceIndex = null, status, correctedValue } = body as {
      groupId: string;
      fieldId: string;
      instanceIndex?: number | null;
      status: FieldStatus;
      correctedValue?: string;
    };

    if (!groupId || !fieldId || !status) {
      return NextResponse.json({ error: "groupId, fieldId und status sind Pflichtfelder." }, { status: 400 });
    }

    const updated = await updateCaseField(caseId, groupId, fieldId, instanceIndex, {
      status,
      correctedValue,
    });

    const allFields = getAllFields(updated);
    const confirmedCount = allFields.filter((f) => f.status !== "extracted_unreviewed").length;

    return NextResponse.json({
      caseStatus: updated.status,
      confirmedCount,
      totalCount: allFields.length,
    });
  } catch (err) {
    console.error("[/api/cases/[caseId]/fields]", err);
    return NextResponse.json({ error: "Update fehlgeschlagen." }, { status: 500 });
  }
}
