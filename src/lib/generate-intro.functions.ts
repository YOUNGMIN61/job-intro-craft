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
const JobDetailsInput = z.object({
  company: z.string().max(300),
  role: z.string().max(500),
  duties: z.string().max(3000),
  qualifications: z.string().max(3000),
  preferred: z.string().max(3000),
  conditions: z.string().max(3000),
  keywords: z.string().max(1000),
  competencies: z.string().max(2000),
});
const ApplicantInput = z.object({
  hasExperience: z.enum(["있음", "없음", "미입력"]),
  previousField: z.string().max(1000),
  previousDuties: z.string().max(2000),
  customerService: z.string().max(2000),
  strengths: z.string().max(2000),
  motivation: z.string().max(2000),
  availablePeriod: z.string().max(1000),
  highlightExperience: z.string().max(2000),
  additionalRequest: z.string().max(2000),
});
const VersionsInput = z.object({
  job: JobDetailsInput,
  applicant: ApplicantInput,
  tone: z.enum(["친근하게", "성실하게", "적극적으로", "간결하게"]),
  length: z.enum([200, 300, 500]),
});
const RevisionInput = VersionsInput.extend({
  original: z.string().min(1).max(3000),
  request: z.string().min(1).max(1000),
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

function postalAddress(structured: Record<string, unknown>[]) {
  for (const item of structured) {
    const location = item.jobLocation;
    if (!location || typeof location !== "object") continue;
    const address = (location as Record<string, unknown>).address;
    if (!address || typeof address !== "object") continue;
    const value = (address as Record<string, unknown>).streetAddress;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
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
    role: id ? `${site} 공고 #${id}` : "공고 원문에서 확인",
    duties: "공고 원문을 확인한 뒤 주요 업무를 입력해 주세요.",
    qualifications: "공고 원문을 확인한 뒤 지원 자격을 입력해 주세요.",
    preferred: "공고 원문을 확인한 뒤 우대사항을 입력해 주세요.",
    conditions: "공고 원문을 확인한 뒤 근무 조건을 입력해 주세요.",
    competencies: "업무에 필요한 역량을 입력해 주세요.",
    sourceUrl: target.toString(),
    warning: reason,
  };
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced || text.match(/\{[\s\S]*\}/)?.[0] || "";
  return JSON.parse(raw) as Record<string, unknown>;
}

async function structureJobDetails(base: {
  title: string;
  company: string;
  location: string;
  description: string;
  keywords: string[];
}) {
  const fallback = {
    role: base.title,
    duties: base.description.slice(0, 1200) || "공고 원문에서 확인",
    qualifications: "공고 원문에서 확인",
    preferred: "공고 원문에서 확인",
    conditions: base.location || "공고 원문에서 확인",
    competencies: base.keywords.join(", ") || "공고 원문에서 확인",
  };
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return fallback;
  try {
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      prompt: `다음 아르바이트 공고 내용만 근거로 정보를 구조화하세요. 없는 내용은 반드시 "공고에 명시되지 않음"으로 쓰세요. 추측하지 마세요. JSON 외에는 출력하지 마세요.\n\n공고명: ${base.title}\n업체명: ${base.company}\n공고 내용: ${base.description}\n\nJSON 형식: {"role":"모집 직무","duties":"주요 업무","qualifications":"지원 자격","preferred":"우대사항","conditions":"근무 조건","competencies":"필요 역량"}`,
    });
    const parsed = extractJson(text);
    return {
      role: typeof parsed.role === "string" ? parsed.role : fallback.role,
      duties: typeof parsed.duties === "string" ? parsed.duties : fallback.duties,
      qualifications:
        typeof parsed.qualifications === "string" ? parsed.qualifications : fallback.qualifications,
      preferred: typeof parsed.preferred === "string" ? parsed.preferred : fallback.preferred,
      conditions: typeof parsed.conditions === "string" ? parsed.conditions : fallback.conditions,
      competencies:
        typeof parsed.competencies === "string" ? parsed.competencies : fallback.competencies,
    };
  } catch {
    return fallback;
  }
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
    const pageText = cleanText(html);
    const descriptionParts = [
      ...structured.map((item) => item.description),
      meta(html, "og:description"),
      meta(html, "twitter:description"),
      meta(html, "description"),
      pageText,
    ].filter((value): value is string => typeof value === "string" && value.trim() !== "");
    const description = [...new Set(descriptionParts)].join("\n").slice(0, 6000);
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
    const location = postalAddress(structured) || "공고 원문에서 확인";
    const details = await structureJobDetails({
      title,
      company,
      location,
      description,
      keywords,
    });
    return {
      title: title.slice(0, 300),
      company: company.slice(0, 200),
      location,
      description,
      keywords,
      ...details,
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

export const generateCoverLetterVersions = createServerFn({ method: "POST" })
  .validator((input: unknown) => VersionsInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI 생성용 LOVABLE_API_KEY가 설정되지 않았습니다.");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      prompt: `알바몬 제출용 자기소개서 3개를 자연스러운 한국어로 작성하세요.

채용공고 정보: ${JSON.stringify(data.job)}
지원자가 직접 입력한 정보: ${JSON.stringify(data.applicant)}
문체: ${data.tone}
목표 글자 수: 각 버전 약 ${data.length}자

절대 규칙:
- 채용공고와 지원자가 직접 입력한 사실만 사용하세요.
- 비어 있거나 "미입력"인 내용은 언급하지 마세요.
- 입력하지 않은 알바 경험, 경력, 자격증, 성과, 성격, 근무 가능 시간을 절대 만들어내지 마세요.
- 뻔한 취업 문구, 과장, 회사에 대한 근거 없는 칭찬을 피하세요.
- 실제 아르바이트 지원자가 쓴 것처럼 구체적이고 자연스럽게 쓰세요.
- JSON 외에는 출력하지 마세요.

JSON 형식: {"experience":"경험 강조형","motivation":"지원동기 강조형","concise":"간결한 알바몬 제출형"}`,
    });
    const parsed = extractJson(text);
    const result = {
      experience: String(parsed.experience || "").trim(),
      motivation: String(parsed.motivation || "").trim(),
      concise: String(parsed.concise || "").trim(),
    };
    if (!result.experience || !result.motivation || !result.concise)
      throw new Error("자기소개서 결과 형식을 확인하지 못했습니다. 다시 생성해 주세요.");
    return result;
  });

export const reviseCoverLetter = createServerFn({ method: "POST" })
  .validator((input: unknown) => RevisionInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI 생성용 LOVABLE_API_KEY가 설정되지 않았습니다.");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      prompt: `기존 알바 자기소개서의 전체 구조와 사실은 최대한 유지하고, 사용자의 수정 요청과 직접 관련된 부분만 고치세요.

기존 글: ${data.original}
수정 요청: ${data.request}
채용공고 정보: ${JSON.stringify(data.job)}
지원자가 직접 입력한 정보: ${JSON.stringify(data.applicant)}
문체: ${data.tone}, 목표 길이: 약 ${data.length}자

입력하지 않은 경험, 경력, 자격증, 성과를 추가하지 마세요. 수정된 본문만 출력하세요.`,
    });
    return { text: text.trim() };
  });
