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
const ApplicationMessageInput = z.object({
  name: z.string().trim().min(1).max(30),
  age: z.coerce.number().int().min(15).max(100),
  region: z.string().trim().min(1).max(50),
  jobTitle: z.string().max(300),
  company: z.string().max(200).default(""),
  description: z.string().max(6000).default(""),
  keywords: z.array(z.string().max(50)).max(15).default([]),
});

const ALLOWED_DOMAINS = ["albamon.com", "jobkorea.co.kr"];

function isAllowedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return ALLOWED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

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

function jsonLdValues(html: string) {
  const values: Record<string, unknown>[] = [];
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]));
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) if (item && typeof item === "object") values.push(item);
    } catch {
      // Some sites emit malformed JSON-LD. Other extraction strategies still apply.
    }
  }
  return values;
}

function firstString(values: unknown[]) {
  return (
    values.find((value): value is string => typeof value === "string" && value.trim() !== "") || ""
  );
}

function fallbackJob(target: URL, reason: string) {
  const isAlbamon = target.hostname.toLowerCase().includes("albamon");
  const site = isAlbamon ? "알바몬" : "잡코리아";
  const id =
    target.pathname.match(/(?:detail\/|GI_Read\/)(\d+)/i)?.[1] ||
    target.searchParams.get("jobId") ||
    "";
  return {
    title: id ? `${site} 채용 공고 #${id}` : `${site} 채용 공고`,
    company: `${site} 등록 업체`,
    location: "공고 원문에서 확인",
    description:
      "공고 사이트의 자동 접근 제한으로 상세 내용을 가져오지 못했습니다. 원문을 확인한 뒤 지원 분야와 작성 항목을 선택해 주세요.",
    keywords: [site, "채용", "지원"],
    sourceUrl: target.toString(),
    warning: reason,
  };
}

export const analyzeJobPosting = createServerFn({ method: "POST" })
  .validator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }) => {
    const target = new URL(data.url);
    if (target.protocol !== "https:" || !isAllowedHost(target.hostname))
      throw new Error("현재는 알바몬과 잡코리아의 HTTPS 공고 URL을 지원합니다.");
    let response: Response;
    try {
      response = await fetch(target, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      return fallbackJob(target, "공고 사이트 연결이 지연되어 기본 정보로 계속합니다.");
    }
    if (!response.ok)
      return fallbackJob(target, `공고 사이트가 자동 분석을 제한했습니다. (${response.status})`);
    if (!isAllowedHost(new URL(response.url).hostname))
      throw new Error("공고 URL이 지원하지 않는 사이트로 이동되었습니다.");
    const html = await response.text();
    const structured = jsonLdValues(html);
    const title = firstString([
      ...structured.map((item) => item.title),
      ...structured.map((item) => item.name),
      meta(html, "og:title"),
      meta(html, "twitter:title"),
      cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || ""),
      cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""),
    ]).replace(/\s*[|｜-]\s*(알바몬|잡코리아).*$/i, "");
    const description = firstString([
      ...structured.map((item) => item.description),
      meta(html, "og:description"),
      meta(html, "twitter:description"),
      meta(html, "description"),
      cleanText(html).slice(0, 2500),
    ]);
    if (!title) return fallbackJob(target, "공고 상세 내용을 읽을 수 없어 기본 정보로 계속합니다.");
    const hiringOrganization = structured.find(
      (item) => item.hiringOrganization,
    )?.hiringOrganization;
    const company = firstString([
      typeof hiringOrganization === "object" && hiringOrganization
        ? (hiringOrganization as Record<string, unknown>).name
        : "",
      meta(html, "og:site_name"),
      target.hostname.includes("albamon") ? "알바몬 등록 업체" : "잡코리아 등록 업체",
    ]);
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
      warning: "",
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

export const generateApplicationMessage = createServerFn({ method: "POST" })
  .validator((input: unknown) => ApplicationMessageInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI 생성용 LOVABLE_API_KEY가 설정되지 않았습니다.");
    const gateway = createLovableAiGatewayProvider(key);
    const prompt = `아래 공고에 온라인 지원할 때 인사담당자에게 보낼 전달 메시지를 한국어로 작성해 주세요.

지원자: ${data.name}, ${data.age}세, ${data.region} 거주
공고명: ${data.jobTitle}
업체명: ${data.company}
공고 내용: ${data.description}
핵심 키워드: ${data.keywords.join(", ")}

공백 포함 350자 이내로 작성하세요. 자연스러운 인사로 시작하고 공고의 업무나 조건을 구체적으로 언급하세요. 이름, 나이, 거주 지역은 자연스럽게 포함하되, 경력·성격·근무 가능 시간처럼 제공되지 않은 사실은 만들지 마세요. 정중하고 적극적인 말투를 사용하고 실제 붙여넣을 본문만 출력하세요.`;
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      prompt,
    });
    return { text: text.trim().slice(0, 1000) };
  });
