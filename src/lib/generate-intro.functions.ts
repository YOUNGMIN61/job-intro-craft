import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  jobTitle: z.string(),
  field: z.string(),
  keywords: z.array(z.string()).default([]),
  sections: z.array(z.enum(["growth", "strengths", "motivation", "aspiration"])).min(1),
});

const SECTION_LABELS: Record<string, string> = {
  growth: "성장과정",
  strengths: "성격의 장단점",
  motivation: "지원동기",
  aspiration: "입사 후 포부",
};

export const generateCoverLetter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const sectionList = data.sections.map((s) => SECTION_LABELS[s]).join(", ");
    const prompt = `아르바이트 자기소개서를 한국어로 작성해줘.

공고: ${data.jobTitle}
지원 분야: ${data.field}
주요 키워드: ${data.keywords.join(", ") || "(없음)"}
포함 항목: ${sectionList}

규칙:
- 각 항목마다 "### {항목명}" 형식의 소제목을 붙이고, 그 아래 3~4문장 본문을 작성.
- 공고 키워드를 자연스럽게 녹여낼 것.
- 진정성 있고 성실한 어조.
- 머리말/설명 없이 본문만 출력.`;

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      prompt,
    });
    return { text };
  });
