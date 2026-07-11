import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  field: z.string().min(1),
  strengths: z.string().default(""),
  tone: z.enum(["polite", "bright", "concise"]),
  extra: z.string().default(""),
});

const toneMap: Record<string, string> = {
  polite: "정중하고 예의 바른",
  bright: "밝고 적극적인",
  concise: "간결하고 명확한",
};

export const generateIntro = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const prompt = `아르바이트 지원용 자기소개서 문구를 한국어로 작성해줘.

- 지원 분야: ${data.field}
- 경험 및 강점: ${data.strengths || "(미입력)"}
- 원하는 분위기: ${toneMap[data.tone]}
- 추가 요청: ${data.extra || "(없음)"}

조건:
- 4개 문단, 각 문단은 2~3문장.
- 자연스럽고 진정성 있는 어조.
- 마지막은 "감사합니다."로 끝맺음.
- 불필요한 머리말/설명 없이 본문만 출력.`;

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      prompt,
    });
    return { text };
  });
