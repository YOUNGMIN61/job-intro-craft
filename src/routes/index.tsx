import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Pencil,
  FileText,
  Star,
  ClipboardList,
  Settings,
  HelpCircle,
  Sparkles,
  Copy,
  Download,
  Bookmark,
  Lightbulb,
  ExternalLink,
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { generateCoverLetter } from "@/lib/generate-intro.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "알바 자기소개서 자동 작성" },
      {
        name: "description",
        content: "알바몬 공고 URL을 입력하면 맞춤형 자기소개서를 자동으로 작성해드려요.",
      },
    ],
  }),
  component: Index,
});

const NAV = [
  { icon: Pencil, label: "자기소개서 작성", active: true },
  { icon: FileText, label: "작성 내역" },
  { icon: Star, label: "즐겨찾기 공고" },
  { icon: ClipboardList, label: "이력서 관리" },
  { icon: Settings, label: "설정" },
];

const FIELDS = [
  "카페·음료",
  "편의점",
  "음식점·서빙",
  "매장관리·판매",
  "사무·행정",
  "고객상담·콜센터",
  "기타 서비스",
  "물류·배송",
  "생산·제조",
  "IT·개발",
  "디자인",
  "기타",
];

const SECTIONS = [
  { id: "growth", label: "성장과정" },
  { id: "strengths", label: "성격의 장단점" },
  { id: "motivation", label: "지원동기" },
  { id: "aspiration", label: "입사 후 포부" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// Mock analyzed job for demo purposes
const MOCK_JOB = {
  title: "[카페] ○○커피 바리스타 모집",
  location: "서울 강남구 역삼동",
  hours: "주 5일 (09:00 ~ 18:00)",
  pay: "시급 10,000원",
  keywords: ["바리스타", "고객응대", "음료제조", "친절", "책임감"],
};

function Index() {
  const generate = useServerFn(generateCoverLetter);
  const [url, setUrl] = useState("https://www.albamon.com/jobs/detail/12345678");
  const [analyzed, setAnalyzed] = useState<typeof MOCK_JOB | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [field, setField] = useState("카페·음료");
  const [sections, setSections] = useState<SectionId[]>([
    "growth",
    "strengths",
    "motivation",
    "aspiration",
  ]);
  const [result, setResult] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleSection = (id: SectionId) =>
    setSections((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const analyze = async () => {
    if (!url.trim()) return;
    setAnalyzing(true);
    // Simulate URL analysis
    await new Promise((r) => setTimeout(r, 900));
    setAnalyzed(MOCK_JOB);
    setAnalyzing(false);
  };

  const runGenerate = async () => {
    if (!analyzed || sections.length === 0) return;
    setGenerating(true);
    try {
      const { text } = await generate({
        data: {
          jobTitle: analyzed.title,
          field,
          keywords: analyzed.keywords,
          sections,
        },
      });
      setResult(text);
    } catch (e) {
      console.error(e);
      setResult("생성 중 오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-6 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md">
                <Pencil className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold">알바 자기소개서</div>
                <div className="text-xs text-slate-500">자동 작성 도우미</div>
              </div>
            </div>

            <nav className="mt-8 space-y-1">
              {NAV.map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.label}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                      n.active
                        ? "bg-orange-50 text-orange-600"
                        : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
            <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-700">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> 작성 팁
            </div>
            공고의 주요 키워드를 반영하면 더 적합한 자기소개서가 작성돼요!
            <div className="mt-4 text-[10px] text-slate-400">© 2024 AlboHelper</div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 px-6 py-8 md:px-10">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-bold">
                알바 자기소개서 자동 작성 <Sparkles className="h-6 w-6 text-orange-500" />
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                알바몬 공고 URL을 입력하면 맞춤형 자기소개서를 자동으로 작성해드려요!
              </p>
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:border-slate-300">
              <HelpCircle className="h-4 w-4" /> 사용 가이드
            </button>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              {/* Step 1: URL */}
              <Card>
                <StepHeader n={1} title="알바몬 공고 URL 입력" />
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.albamon.com/jobs/detail/..."
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                  <button
                    onClick={analyze}
                    disabled={analyzing || !url.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-60"
                  >
                    {analyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    공고 분석하기
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500">
                    알바몬 공고 페이지의 URL을 복사하여 붙여넣어 주세요.
                  </span>
                  <a className="inline-flex items-center gap-1 text-orange-600 hover:underline" href="#">
                    알바몬에서 공고 찾아보기 <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </Card>

              {/* Step 2 + 3 */}
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
                <Card>
                  <StepHeader
                    n={2}
                    title={
                      <>
                        분야 선택{" "}
                        <span className="text-xs font-normal text-slate-400">(선택사항)</span>
                      </>
                    }
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    지원하는 분야를 선택하면 더욱 맞춤형 문구를 만들 수 있어요.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {FIELDS.map((f) => {
                      const active = f === field;
                      return (
                        <button
                          key={f}
                          onClick={() => setField(f)}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                            active
                              ? "border-orange-400 bg-orange-50 text-orange-600"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                          )}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
                    <Check className="h-3.5 w-3.5" />
                    선택한 분야: <span className="font-semibold">{field}</span>
                  </div>
                </Card>

                <div className="hidden items-center justify-center md:flex">
                  <ArrowRight className="h-6 w-6 text-slate-300" />
                </div>

                <Card>
                  <StepHeader n={3} title="자기소개서 생성" />
                  <p className="mt-1 text-xs text-slate-500">
                    원하는 항목을 선택하고 생성 버튼을 눌러주세요.
                  </p>
                  <div className="mt-4 space-y-2.5">
                    {SECTIONS.map((s) => {
                      const checked = sections.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700"
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded border transition",
                              checked
                                ? "border-orange-500 bg-orange-500 text-white"
                                : "border-slate-300 bg-white",
                            )}
                          >
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() => toggleSection(s.id)}
                          />
                          {s.label}
                        </label>
                      );
                    })}
                  </div>
                  <button
                    onClick={runGenerate}
                    disabled={!analyzed || generating || sections.length === 0}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> 생성 중...
                      </>
                    ) : (
                      <>
                        자기소개서 생성하기 <Sparkles className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  {!analyzed && (
                    <p className="mt-2 text-center text-[11px] text-slate-400">
                      먼저 공고를 분석해주세요.
                    </p>
                  )}
                </Card>
              </div>

              {/* Result */}
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold">생성된 자기소개서</h3>
                    {result && (
                      <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-medium text-orange-600">
                        방금 생성됨
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ActionBtn onClick={copy} disabled={!result} icon={copied ? Check : Copy}>
                      {copied ? "복사됨" : "복사하기"}
                    </ActionBtn>
                    <ActionBtn onClick={() => {}} disabled={!result} icon={Download}>
                      다운로드 (DOCX)
                    </ActionBtn>
                    <ActionBtn onClick={() => {}} disabled={!result} icon={Bookmark}>
                      즐겨찾기 저장
                    </ActionBtn>
                    {result && (
                      <ActionBtn onClick={runGenerate} disabled={generating} icon={RefreshCw}>
                        다시 생성
                      </ActionBtn>
                    )}
                  </div>
                </div>

                <div className="mt-4 min-h-[220px] rounded-xl bg-slate-50/70 p-5 text-sm leading-7 text-slate-700">
                  {result ? (
                    <FormattedResult text={result} />
                  ) : generating ? (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> 자기소개서를 작성하고 있어요...
                    </div>
                  ) : (
                    <div className="text-slate-400">
                      공고 분석 후 &apos;자기소개서 생성하기&apos; 버튼을 눌러주세요.
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right: analyzed info */}
            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-base font-bold">분석된 공고 정보</h3>
              {analyzed ? (
                <div className="mt-5 space-y-4 text-sm">
                  <Info label="공고명" value={analyzed.title} />
                  <Info label="근무지역" value={analyzed.location} />
                  <Info label="근무시간" value={analyzed.hours} />
                  <Info label="급여" value={analyzed.pay} />
                  <div>
                    <div className="text-xs font-medium text-slate-500">주요 키워드</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {analyzed.keywords.map((k) => (
                        <span
                          key={k}
                          className="rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                  <a
                    href="#"
                    className="inline-flex items-center gap-1 text-xs text-orange-600 hover:underline"
                  >
                    상세 정보 보기 <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-400">
                  공고 URL을 입력하고 분석하면 정보가 여기에 표시돼요.
                </p>
              )}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
  );
}

function StepHeader({ n, title }: { n: number; title: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
        {n}
      </span>
      <h2 className="text-base font-bold">{title}</h2>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-slate-800">{value}</div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  icon: Icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-orange-300 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function FormattedResult({ text }: { text: string }) {
  // Render "### Title" headers in orange, keep rest as paragraphs
  const blocks = text.split(/\n(?=###\s)/);
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        const m = block.match(/^###\s+(.+?)\n([\s\S]*)$/);
        if (m) {
          return (
            <div key={i}>
              <h4 className="mb-1 font-bold text-orange-600">{m[1].trim()}</h4>
              <p className="whitespace-pre-wrap">{m[2].trim()}</p>
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {block.trim()}
          </p>
        );
      })}
    </div>
  );
}
