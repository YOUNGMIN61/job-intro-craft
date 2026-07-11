import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Bookmark,
  Check,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Lightbulb,
  Loader2,
  Pencil,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
} from "lucide-react";
import { analyzeJobPosting, generateCoverLetter } from "@/lib/generate-intro.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "알바 자기소개서 자동 작성" },
      { name: "description", content: "알바 공고 URL을 분석해 맞춤형 자기소개서를 작성합니다." },
    ],
  }),
  component: Index,
});

const FIELDS = [
  "카페·음료",
  "외식·서비스",
  "매장관리·판매",
  "사무·행정",
  "고객상담·콜센터",
  "물류·배송",
  "생산·제조",
  "IT·개발",
  "디자인",
  "기타",
];
const SECTIONS = [
  { id: "growth", label: "성장 과정" },
  { id: "strengths", label: "성격의 장단점" },
  { id: "motivation", label: "지원 동기" },
  { id: "aspiration", label: "입사 후 포부" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];
type Job = {
  title: string;
  company: string;
  location: string;
  description: string;
  keywords: string[];
  sourceUrl: string;
};
type SavedItem = { id: string; createdAt: string; job: Job; field: string; result: string };

function readSaved(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("job-intro-saved") || "[]");
  } catch {
    return [];
  }
}

function Index() {
  const analyzeOnServer = useServerFn(analyzeJobPosting);
  const generate = useServerFn(generateCoverLetter);
  const [url, setUrl] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [field, setField] = useState(FIELDS[0]);
  const [sections, setSections] = useState<SectionId[]>(SECTIONS.map((s) => s.id));
  const [result, setResult] = useState("");
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [view, setView] = useState<"write" | "saved">("write");

  useEffect(() => setSaved(readSaved()), []);
  const showNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const analyze = async () => {
    setNotice("");
    setJob(null);
    setResult("");
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      showNotice("올바른 공고 URL을 입력해 주세요.");
      return;
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      showNotice("http 또는 https URL만 사용할 수 있습니다.");
      return;
    }
    setAnalyzing(true);
    try {
      const data = await analyzeOnServer({ data: { url: parsed.toString() } });
      setJob(data);
      showNotice("공고 정보를 불러왔습니다.");
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "공고를 분석하지 못했습니다.");
    } finally {
      setAnalyzing(false);
    }
  };

  const runGenerate = async () => {
    if (!job || sections.length === 0) return;
    setGenerating(true);
    setNotice("");
    try {
      const data = await generate({
        data: {
          jobTitle: job.title,
          company: job.company,
          description: job.description,
          field,
          keywords: job.keywords,
          sections,
        },
      });
      setResult(data.text);
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "자기소개서 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (result) {
      await navigator.clipboard.writeText(result);
      showNotice("클립보드에 복사했습니다.");
    }
  };
  const download = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${job?.company || "알바"}-자기소개서.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    showNotice("자기소개서를 다운로드했습니다.");
  };
  const save = () => {
    if (!job || !result) return;
    const next = [
      { id: crypto.randomUUID(), createdAt: new Date().toISOString(), job, field, result },
      ...saved,
    ];
    setSaved(next);
    localStorage.setItem("job-intro-saved", JSON.stringify(next));
    showNotice("작성 내역에 저장했습니다.");
  };
  const removeSaved = (id: string) => {
    const next = saved.filter((x) => x.id !== id);
    setSaved(next);
    localStorage.setItem("job-intro-saved", JSON.stringify(next));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {notice && (
        <div
          role="status"
          className="fixed right-5 top-5 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl"
        >
          {notice}
        </div>
      )}
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-64 shrink-0 flex-col justify-between border-r bg-white p-6 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white">
                <Pencil />
              </div>
              <div>
                <b>알바 자기소개서</b>
                <div className="text-xs text-slate-500">AI 작성 도우미</div>
              </div>
            </div>
            <nav className="mt-8 space-y-1">
              <Nav
                icon={Pencil}
                label="자기소개서 작성"
                active={view === "write"}
                onClick={() => setView("write")}
              />
              <Nav
                icon={FileText}
                label={`작성 내역 (${saved.length})`}
                active={view === "saved"}
                onClick={() => setView("saved")}
              />
              <Nav
                icon={Star}
                label="즐겨찾기 공고"
                onClick={() => showNotice("작성 결과를 저장하면 작성 내역에서 확인할 수 있습니다.")}
              />
              <Nav
                icon={ClipboardList}
                label="이력서 관리"
                onClick={() => showNotice("이력서 관리 기능은 준비 중입니다.")}
              />
              <Nav
                icon={Settings}
                label="설정"
                onClick={() => showNotice("설정 기능은 준비 중입니다.")}
              />
            </nav>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
            <div className="mb-2 flex gap-1 font-semibold text-slate-700">
              <Lightbulb className="h-4 w-4 text-amber-500" /> 작성 팁
            </div>
            공고의 핵심 업무와 요구 역량을 경험에 연결하면 더 설득력 있는 글이 됩니다.
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-8 md:px-10">
          {view === "saved" ? (
            <SavedView
              items={saved}
              onOpen={(item) => {
                setJob(item.job);
                setField(item.field);
                setResult(item.result);
                setView("write");
              }}
              onRemove={removeSaved}
            />
          ) : (
            <>
              <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
                    알바 자기소개서 자동 작성 <Sparkles className="text-orange-500" />
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    공고 URL을 입력하면 내용을 분석해 맞춤형 자기소개서를 작성합니다.
                  </p>
                </div>
                <button
                  onClick={() =>
                    showNotice(
                      "URL 입력 → 공고 분석 → 항목 선택 → 자기소개서 생성 순서로 이용하세요.",
                    )
                  }
                  className="btn-secondary"
                >
                  <HelpCircle className="h-4 w-4" /> 사용 가이드
                </button>
              </header>
              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                  <Card>
                    <Step n={1} title="채용 공고 URL 입력" />
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <input
                        aria-label="채용 공고 URL"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && analyze()}
                        placeholder="https://www.albamon.com/jobs/detail/..."
                        className="flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      />
                      <button
                        onClick={analyze}
                        disabled={analyzing || !url.trim()}
                        className="btn-primary"
                      >
                        {analyzing && <Loader2 className="h-4 w-4 animate-spin" />}공고 분석하기
                      </button>
                    </div>
                    <a
                      href="https://www.albamon.com/jobs"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-orange-600 hover:underline"
                    >
                      알바몬에서 공고 찾기 <ExternalLink className="h-3 w-3" />
                    </a>
                  </Card>
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                      <Step n={2} title="지원 분야 선택" />
                      <div className="mt-4 flex flex-wrap gap-2">
                        {FIELDS.map((f) => (
                          <button
                            key={f}
                            onClick={() => setField(f)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-xs",
                              f === field
                                ? "border-orange-400 bg-orange-50 text-orange-600"
                                : "border-slate-200",
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </Card>
                    <Card>
                      <Step n={3} title="작성 항목 선택" />
                      <div className="mt-4 space-y-3">
                        {SECTIONS.map((s) => (
                          <label key={s.id} className="flex cursor-pointer gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={sections.includes(s.id)}
                              onChange={() =>
                                setSections((old) =>
                                  old.includes(s.id)
                                    ? old.filter((x) => x !== s.id)
                                    : [...old, s.id],
                                )
                              }
                              className="accent-orange-500"
                            />
                            {s.label}
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={runGenerate}
                        disabled={!job || generating || !sections.length}
                        className="btn-primary mt-5 w-full"
                      >
                        {generating && <Loader2 className="h-4 w-4 animate-spin" />}자기소개서
                        생성하기
                      </button>
                      {!job && (
                        <p className="mt-2 text-center text-xs text-slate-400">
                          먼저 공고를 분석해 주세요.
                        </p>
                      )}
                    </Card>
                  </div>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-bold">생성된 자기소개서</h2>
                      <div className="flex flex-wrap gap-2">
                        <Action icon={Copy} label="복사" onClick={copy} disabled={!result} />
                        <Action
                          icon={Download}
                          label="TXT 다운로드"
                          onClick={download}
                          disabled={!result}
                        />
                        <Action icon={Bookmark} label="저장" onClick={save} disabled={!result} />
                        {result && (
                          <Action
                            icon={RefreshCw}
                            label="다시 생성"
                            onClick={runGenerate}
                            disabled={generating}
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-4 min-h-56 rounded-xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                      {generating ? (
                        <span className="flex gap-2 text-slate-400">
                          <Loader2 className="animate-spin" />
                          작성 중입니다...
                        </span>
                      ) : result ? (
                        <FormattedResult text={result} />
                      ) : (
                        <span className="text-slate-400">
                          공고를 분석한 뒤 자기소개서를 생성해 주세요.
                        </span>
                      )}
                    </div>
                  </Card>
                </div>
                <aside className="h-fit rounded-2xl border bg-white p-6">
                  <h2 className="font-bold">분석된 공고 정보</h2>
                  {job ? (
                    <div className="mt-5 space-y-4 text-sm">
                      <Info label="공고명" value={job.title} />
                      <Info label="회사" value={job.company} />
                      <Info label="근무 지역" value={job.location || "공고에서 확인"} />
                      <div>
                        <span className="text-xs text-slate-500">핵심 키워드</span>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {job.keywords.map((k) => (
                            <span
                              key={k}
                              className="rounded bg-orange-50 px-2 py-1 text-xs text-orange-600"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                      <a
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex gap-1 text-xs text-orange-600"
                      >
                        원문 보기 <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <p className="mt-5 text-sm text-slate-400">
                      URL을 입력하고 분석하면 공고 정보가 여기에 표시됩니다.
                    </p>
                  )}
                </aside>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {children}
    </section>
  );
}
function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
        {n}
      </span>
      <h2 className="font-bold">{title}</h2>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}
function Nav({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
        active ? "bg-orange-50 text-orange-600" : "text-slate-600 hover:bg-slate-50",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
function Action({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="btn-secondary text-xs">
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
function FormattedResult({ text }: { text: string }) {
  return <div className="whitespace-pre-wrap">{text}</div>;
}
function SavedView({
  items,
  onOpen,
  onRemove,
}: {
  items: SavedItem[];
  onOpen: (x: SavedItem) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold">작성 내역</h1>
      <p className="mt-2 text-sm text-slate-500">이 브라우저에 저장된 자기소개서입니다.</p>
      <div className="mt-6 space-y-3">
        {items.length ? (
          items.map((x) => (
            <div
              key={x.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-5"
            >
              <div>
                <b>{x.job.title}</b>
                <div className="mt-1 text-xs text-slate-500">
                  {x.job.company} · {new Date(x.createdAt).toLocaleString("ko-KR")}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => onOpen(x)}>
                  열기
                </button>
                <button className="btn-secondary text-red-600" onClick={() => onRemove(x.id)}>
                  삭제
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center text-slate-400">
            저장된 자기소개서가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
