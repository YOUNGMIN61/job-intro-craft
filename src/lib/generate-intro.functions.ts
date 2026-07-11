import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const AnalyzeInput = z.object({ url: z.string().url().max(2048) });
const GenerateInput = z.object({
  jobTitle: z.string().max(300),
  company: z.string().max(200).default(""),
  description: z.string().max(6000).default(""),
  field: z.string().max(100),
  keywords: z.array(z.string().max(50)).max(15).default([]),
  sections: z.array(z.enum(["growth", "strengths", "motivation", "aspiration"])).min(1),
});

const ALLOWED_HOSTS = [
  "albamon.com",
  "www.albamon.com",
  "m.albamon.com",
  "jobkorea.co.kr",
  "www.jobkorea.co.kr",
];

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}
function meta(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const found = html.match(pattern)?.[1];
    if (found) return decodeHtml(found);
  }
  return "";
}
function cleanText(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).slice(0, 6000);
}

export const analyzeJobPosting = createServerFn({ method: "POST" })
  .validator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }) => {
    const target = new URL(data.url);
    if (target.protocol !== "https:" || !ALLOWED_HOSTS.includes(target.hostname.toLowerCase()))
      throw new Error("현재는 알바몬과 잡코리아의 HTTPS 공고 URL을 지원합니다.");
    const response = await fetch(target, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobIntroCraft/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`공고 페이지를 불러오지 못했습니다. (${response.status})`);
    const html = await response.text();
    const title =
      meta(html, "og:title") ||
      cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const description =
      meta(html, "og:description") || meta(html, "description") || cleanText(html).slice(0, 2500);
    if (!title)
      throw new Error("공고 제목을 찾지 못했습니다. 공개된 상세 공고 URL인지 확인해 주세요.");
    const company =
      meta(html, "og:site_name") ||
      (target.hostname.includes("albamon") ? "알바몬 공고" : "잡코리아 공고");
    const words = `${title} ${description}`.match(/[가-힣A-Za-z0-9+#]{2,}/g) || [];
    const stop = new Set([
      "채용",
      "모집",
      "알바몬",
      "잡코리아",
      "에서",
      "합니다",
      "있습니다",
      "근무",
      "공고",
    ]);
    const keywords = [...new Set(words.filter((w) => !stop.has(w)).slice(0, 8))];
    return {
      title: title.slice(0, 300),
      company: company.slice(0, 200),
      location: "공고 원문에서 확인",
      description,
      keywords,
      sourceUrl: target.toString(),
    };
  });

const LABELS = {
  growth: "성장 과정",
  strengths: "성격의 장단점",
  motivation: "지원 동기",
  aspiration: "입사 후 포부",
};

export const generateCoverLetter = createServerFn({ method: "POST" })
  .validator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI 생성용 LOVABLE_API_KEY가 설정되지 않았습니다.");
    const sectionList = data.sections.map((section) => LABELS[section]).join(", ");
    const prompt = `아래 채용 공고를 참고하여 아르바이트 지원용 자기소개서를 자연스러운 한국어로 작성해 주세요.\n\n공고명: ${data.jobTitle}\n회사: ${data.company}\n지원 분야: ${data.field}\n공고 설명: ${data.description}\n핵심 키워드: ${data.keywords.join(", ")}\n작성 항목: ${sectionList}\n\n각 항목은 '### 항목명'으로 시작하고 3~5문장으로 작성하세요. 확인되지 않은 경력이나 수치는 만들지 말고, 지원자가 직접 보완할 부분은 [경험 입력]처럼 표시하세요. 결과 본문만 출력하세요.`;
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({ model: gateway("google/gemini-2.5-flash"), prompt });
    return { text };
  });
