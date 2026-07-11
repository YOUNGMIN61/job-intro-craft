import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bookmark,
  Check,
  Clipboard,
  ClipboardList,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Star,
  WandSparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  analyzeJobPosting,
  generateCoverLetterVersions,
  reviseCoverLetter,
} from "@/lib/generate-intro.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "알바몬 맞춤 자기소개서" },
      {
        name: "description",
        content: "알바몬 공고와 실제 지원자 경험으로 자기소개서를 작성합니다.",
      },
    ],
  }),
  component: App,
});

type JobInfo = {
  company: string;
  role: string;
  duties: string;
  qualifications: string;
  preferred: string;
  conditions: string;
  keywords: string;
  competencies: string;
};
type ApplicantInfo = {
  hasExperience: "있음" | "없음" | "미입력";
  previousField: string;
  previousDuties: string;
  customerService: string;
  strengths: string;
  motivation: string;
  availablePeriod: string;
  highlightExperience: string;
  additionalRequest: string;
};
type ResultKey = "experience" | "motivation" | "concise";
type Results = Record<ResultKey, string>;
type Tone = "친근하게" | "성실하게" | "적극적으로" | "간결하게";
type Length = 200 | 300 | 500;
type View = "write" | "history" | "favorites" | "resume" | "settings";

const EMPTY_JOB: JobInfo = {
  company: "",
  role: "",
  duties: "",
  qualifications: "",
  preferred: "",
  conditions: "",
  keywords: "",
  competencies: "",
};
const EMPTY_APPLICANT: ApplicantInfo = {
  hasExperience: "미입력",
  previousField: "",
  previousDuties: "",
  customerService: "",
  strengths: "",
  motivation: "",
  availablePeriod: "",
  highlightExperience: "",
  additionalRequest: "",
};
const EMPTY_RESULTS: Results = { experience: "", motivation: "", concise: "" };
const RESULT_LABELS: Record<ResultKey, string> = {
  experience: "경험 강조형",
  motivation: "지원동기 강조형",
  concise: "간결한 알바몬 제출형",
};
const FIELDS = [
  "카페·음료",
  "외식·서비스",
  "매장관리·판매",
  "사무·행정",
  "고객상담",
  "물류·배송",
  "생산·제조",
  "IT·개발",
  "기타",
];

function App() {
  const analyzeServer = useServerFn(analyzeJobPosting);
  const generateServer = useServerFn(generateCoverLetterVersions);
  const reviseServer = useServerFn(reviseCoverLetter);
  const [view, setView] = useState<View>("write");
  const [url, setUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedField, setSelectedField] = useState(FIELDS[0]);
  const [job, setJob] = useState<JobInfo>(EMPTY_JOB);
  const [applicant, setApplicant] = useState<ApplicantInfo>(EMPTY_APPLICANT);
  const [tone, setTone] = useState<Tone>("성실하게");
  const [length, setLength] = useState<Length>(300);
  const [results, setResults] = useState<Results>(EMPTY_RESULTS);
  const [requests, setRequests] = useState<Record<ResultKey, string>>({
    experience: "",
    motivation: "",
    concise: "",
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState<ResultKey | null>(null);
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<
    { id: string; title: string; text: string; savedAt: string }[]
  >([]);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("cover-letter-history") || "[]"));
    } catch {
      setHistory([]);
    }
  }, []);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };
  const setJobField = (key: keyof JobInfo, value: string) =>
    setJob((current) => ({ ...current, [key]: value }));
  const setApplicantField = <K extends keyof ApplicantInfo>(key: K, value: ApplicantInfo[K]) =>
    setApplicant((current) => ({ ...current, [key]: value }));

  const analyze = async () => {
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      notify("올바른 알바몬 또는 잡코리아 공고 URL을 입력해 주세요.");
      return;
    }
    setAnalyzing(true);
    setResults(EMPTY_RESULTS);
    try {
      const data = await analyzeServer({ data: { url: parsed.toString() } });
      setSourceUrl(data.sourceUrl);
      setJob({
        company: data.company,
        role: data.role || data.title,
        duties: data.duties || data.description,
        qualifications: data.qualifications || "공고에 명시되지 않음",
        preferred: data.preferred || "공고에 명시되지 않음",
        conditions: data.conditions || data.location,
        keywords: Array.isArray(data.keywords)
          ? data.keywords.join(", ")
          : String(data.keywords || ""),
        competencies: data.competencies || "공고에 명시되지 않음",
      });
      notify(data.warning || "공고 분석을 완료했습니다. 내용을 확인하고 수정해 주세요.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "공고를 분석하지 못했습니다.");
    } finally {
      setAnalyzing(false);
    }
  };

  const jobPayload = () => ({ ...job, role: `${job.role} (${selectedField})` });
  const generate = async () => {
    if (!job.company.trim() || !job.role.trim()) {
      notify("먼저 공고를 분석하거나 업체명과 모집 직무를 입력해 주세요.");
      return;
    }
    setGenerating(true);
    try {
      const data = await generateServer({ data: { job: jobPayload(), applicant, tone, length } });
      setResults(data);
      notify("3가지 자기소개서를 생성했습니다.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "자기소개서를 생성하지 못했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const revise = async (key: ResultKey, request: string) => {
    if (!results[key] || !request.trim()) return;
    setEditing(key);
    try {
      const data = await reviseServer({
        data: { job: jobPayload(), applicant, tone, length, original: results[key], request },
      });
      setResults((current) => ({ ...current, [key]: data.text }));
      setRequests((current) => ({ ...current, [key]: "" }));
      notify("요청한 부분을 중심으로 수정했습니다.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "수정하지 못했습니다.");
    } finally {
      setEditing(null);
    }
  };

  const save = (key: ResultKey) => {
    const item = {
      id: crypto.randomUUID(),
      title: RESULT_LABELS[key],
      text: results[key],
      savedAt: new Date().toISOString(),
    };
    const next = [item, ...history].slice(0, 30);
    setHistory(next);
    localStorage.setItem("cover-letter-history", JSON.stringify(next));
    notify("작성 내역에 저장했습니다.");
  };
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    notify("클립보드에 복사했습니다.");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {notice && (
        <div
          role="status"
          className="fixed right-5 top-5 z-50 max-w-sm rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl"
        >
          {notice}
        </div>
      )}
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <Sidebar view={view} setView={setView} historyCount={history.length} />
        <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
          <MobileNav view={view} setView={setView} />
          {view === "write" ? (
            <>
              <header>
                <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                  <Sparkles className="h-3.5 w-3.5" /> 입력한 사실만 사용하는 AI
                </span>
                <h1 className="mt-3 text-3xl font-bold">알바몬 맞춤 자기소개서</h1>
                <p className="mt-2 text-sm text-slate-500">
                  공고 분석 결과를 확인하고 실제 경험만 입력하면 3가지 버전을 작성합니다.
                </p>
              </header>
              <Card>
                <Step n={1} title="알바몬 공고 분석" />
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && analyze()}
                    placeholder="알바몬 상세 공고 URL"
                    className="form-input flex-1"
                  />
                  <button
                    onClick={analyze}
                    disabled={!url.trim() || analyzing}
                    className="btn-primary"
                  >
                    {analyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <WandSparkles className="h-4 w-4" />
                    )}
                    공고 분석하기
                  </button>
                </div>
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-orange-600"
                  >
                    공고 원문 보기 <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </Card>
              <Card>
                <Step n={2} title="분석된 공고 정보 확인·수정" />
                <p className="mt-2 text-xs text-slate-500">
                  자동 분석이 정확하지 않으면 생성 전에 직접 수정하세요.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <JobField
                    label="업체명"
                    value={job.company}
                    onChange={(v) => setJobField("company", v)}
                  />
                  <JobField
                    label="모집 직무"
                    value={job.role}
                    onChange={(v) => setJobField("role", v)}
                  />
                  <JobField
                    label="주요 업무"
                    value={job.duties}
                    onChange={(v) => setJobField("duties", v)}
                    large
                  />
                  <JobField
                    label="지원 자격"
                    value={job.qualifications}
                    onChange={(v) => setJobField("qualifications", v)}
                    large
                  />
                  <JobField
                    label="우대사항"
                    value={job.preferred}
                    onChange={(v) => setJobField("preferred", v)}
                    large
                  />
                  <JobField
                    label="근무 조건"
                    value={job.conditions}
                    onChange={(v) => setJobField("conditions", v)}
                    large
                  />
                  <JobField
                    label="공고 핵심 키워드"
                    value={job.keywords}
                    onChange={(v) => setJobField("keywords", v)}
                  />
                  <JobField
                    label="필요 역량"
                    value={job.competencies}
                    onChange={(v) => setJobField("competencies", v)}
                    large
                  />
                </div>
                <div className="mt-5">
                  <b className="text-sm">분야 선택</b>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {FIELDS.map((field) => (
                      <button
                        key={field}
                        onClick={() => setSelectedField(field)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-xs",
                          selectedField === field
                            ? "border-orange-400 bg-orange-50 text-orange-600"
                            : "border-slate-200",
                        )}
                      >
                        {field}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
              <Card>
                <Step n={3} title="지원자 정보" />
                <p className="mt-2 text-xs text-amber-700">
                  입력하지 않은 경험은 자기소개서에 사용하지 않습니다.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="아르바이트 경험 유무"
                    value={applicant.hasExperience}
                    onChange={(v) =>
                      setApplicantField("hasExperience", v as ApplicantInfo["hasExperience"])
                    }
                    options={["미입력", "있음", "없음"]}
                  />
                  <TextField
                    label="이전 근무 분야"
                    value={applicant.previousField}
                    onChange={(v) => setApplicantField("previousField", v)}
                  />
                  <TextField
                    label="담당했던 업무"
                    value={applicant.previousDuties}
                    onChange={(v) => setApplicantField("previousDuties", v)}
                    large
                  />
                  <TextField
                    label="고객 응대 경험"
                    value={applicant.customerService}
                    onChange={(v) => setApplicantField("customerService", v)}
                    large
                  />
                  <TextField
                    label="본인의 장점"
                    value={applicant.strengths}
                    onChange={(v) => setApplicantField("strengths", v)}
                    large
                  />
                  <TextField
                    label="지원동기"
                    value={applicant.motivation}
                    onChange={(v) => setApplicantField("motivation", v)}
                    large
                  />
                  <TextField
                    label="근무 가능 기간"
                    value={applicant.availablePeriod}
                    onChange={(v) => setApplicantField("availablePeriod", v)}
                  />
                  <TextField
                    label="강조하고 싶은 경험"
                    value={applicant.highlightExperience}
                    onChange={(v) => setApplicantField("highlightExperience", v)}
                    large
                  />
                  <div className="md:col-span-2">
                    <TextField
                      label="추가 요청 사항"
                      value={applicant.additionalRequest}
                      onChange={(v) => setApplicantField("additionalRequest", v)}
                      large
                    />
                  </div>
                </div>
                <div className="mt-6 grid gap-5 border-t pt-6 md:grid-cols-2">
                  <ChoiceGroup
                    label="문체"
                    values={["친근하게", "성실하게", "적극적으로", "간결하게"]}
                    selected={tone}
                    onSelect={(v) => setTone(v as Tone)}
                  />
                  <ChoiceGroup
                    label="글자 수"
                    values={["200자", "300자", "500자"]}
                    selected={`${length}자`}
                    onSelect={(v) => setLength(Number(v.replace("자", "")) as Length)}
                  />
                </div>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="btn-primary mt-6 w-full py-3.5"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  3가지 자기소개서 생성
                </button>
              </Card>
              {(Object.keys(RESULT_LABELS) as ResultKey[]).some((key) => results[key]) && (
                <section className="mt-6 space-y-5">
                  <h2 className="text-xl font-bold">생성 결과</h2>
                  {(Object.keys(RESULT_LABELS) as ResultKey[]).map(
                    (key) =>
                      results[key] && (
                        <ResultCard
                          key={key}
                          resultKey={key}
                          title={RESULT_LABELS[key]}
                          text={results[key]}
                          request={requests[key]}
                          setRequest={(v) => setRequests((current) => ({ ...current, [key]: v }))}
                          loading={editing === key}
                          copy={() => copy(results[key])}
                          save={() => save(key)}
                          revise={(request) => revise(key, request)}
                        />
                      ),
                  )}
                </section>
              )}
            </>
          ) : view === "history" ? (
            <History
              items={history}
              onDelete={(id) => {
                const next = history.filter((item) => item.id !== id);
                setHistory(next);
                localStorage.setItem("cover-letter-history", JSON.stringify(next));
              }}
            />
          ) : (
            <Placeholder view={view} />
          )}
        </main>
      </div>
    </div>
  );
}

function ResultCard({
  title,
  text,
  request,
  setRequest,
  loading,
  copy,
  save,
  revise,
}: {
  resultKey: ResultKey;
  title: string;
  text: string;
  request: string;
  setRequest: (v: string) => void;
  loading: boolean;
  copy: () => void;
  save: () => void;
  revise: (request: string) => void;
}) {
  const actions = [
    { label: "다시 생성", request: "같은 방향과 사실을 유지하되 표현을 새롭게 다듬어 주세요." },
    { label: "더 짧게", request: "핵심 사실은 유지하고 전체 글을 더 짧게 줄여 주세요." },
    {
      label: "더 자연스럽게",
      request: "내용은 유지하고 실제 알바 지원자가 쓴 것처럼 더 자연스럽게 다듬어 주세요.",
    },
    {
      label: "경험 강조",
      request: "입력된 실제 경험만 사용하여 경험 부분을 조금 더 강조해 주세요.",
    },
    {
      label: "지원동기 강화",
      request: "입력된 지원동기와 공고 정보만 사용하여 지원 이유를 강화해 주세요.",
    },
  ];
  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-orange-600">{title}</h3>
        <div className="flex gap-2">
          <button onClick={copy} className="btn-secondary text-xs">
            <Clipboard className="h-3.5 w-3.5" />
            복사하기
          </button>
          <button onClick={save} className="btn-secondary text-xs">
            <Bookmark className="h-3.5 w-3.5" />
            저장하기
          </button>
        </div>
      </div>
      <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">
        {text}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => revise(action.request)}
            disabled={loading}
            className="btn-secondary text-xs"
          >
            {action.label === "다시 생성" && <RefreshCw className="h-3.5 w-3.5" />}
            {action.label}
          </button>
        ))}
      </div>
      <div className="mt-5 border-t pt-5">
        <label className="text-sm font-semibold">AI에게 수정 요청</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && request.trim() && revise(request)}
            placeholder="예: 첫 문장을 더 친근하게 바꿔줘"
            className="form-input flex-1"
          />
          <button
            onClick={() => revise(request)}
            disabled={!request.trim() || loading}
            className="btn-primary"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}요청 반영
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          기존 글 전체를 새로 쓰지 않고 요청한 부분을 중심으로 수정합니다.
        </p>
      </div>
    </article>
  );
}

function Sidebar({
  view,
  setView,
  historyCount,
}: {
  view: View;
  setView: (v: View) => void;
  historyCount: number;
}) {
  const nav: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "write", label: "자기소개서 작성", icon: Pencil },
    { id: "history", label: `작성 내역 (${historyCount})`, icon: FileText },
    { id: "favorites", label: "즐겨찾기 공고", icon: Star },
    { id: "resume", label: "이력서 관리", icon: ClipboardList },
    { id: "settings", label: "설정", icon: Settings },
  ];
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-white p-6 lg:block">
      <button onClick={() => setView("write")} className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white">
          <Pencil className="h-5 w-5" />
        </span>
        <span className="text-left">
          <b className="block">알바 지원 도우미</b>
          <small className="text-slate-500">사실 기반 AI 작성</small>
        </span>
      </button>
      <nav className="mt-8 space-y-1">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
              view === id ? "bg-orange-50 text-orange-600" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
function MobileNav({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto lg:hidden">
      {(["write", "history", "favorites", "resume", "settings"] as View[]).map((id) => (
        <button
          key={id}
          onClick={() => setView(id)}
          className={cn(
            "whitespace-nowrap rounded-lg px-3 py-2 text-xs",
            view === id ? "bg-orange-500 text-white" : "border bg-white",
          )}
        >
          {
            {
              write: "작성",
              history: "내역",
              favorites: "즐겨찾기",
              resume: "이력서",
              settings: "설정",
            }[id]
          }
        </button>
      ))}
    </div>
  );
}
function History({
  items,
  onDelete,
}: {
  items: { id: string; title: string; text: string; savedAt: string }[];
  onDelete: (id: string) => void;
}) {
  return (
    <section>
      <h1 className="text-2xl font-bold">작성 내역</h1>
      <div className="mt-6 space-y-3">
        {items.length ? (
          items.map((item) => (
            <article key={item.id} className="rounded-xl border bg-white p-5">
              <div className="flex justify-between">
                <b>{item.title}</b>
                <button onClick={() => onDelete(item.id)} className="text-xs text-red-500">
                  삭제
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(item.savedAt).toLocaleString("ko-KR")}
              </p>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {item.text}
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-dashed bg-white p-12 text-center text-slate-400">
            저장된 자기소개서가 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}
function Placeholder({ view }: { view: View }) {
  const names = {
    favorites: "즐겨찾기 공고",
    resume: "이력서 관리",
    settings: "설정",
    write: "",
    history: "",
  };
  return (
    <section>
      <h1 className="text-2xl font-bold">{names[view]}</h1>
      <div className="mt-6 rounded-xl border border-dashed bg-white p-12 text-center text-sm text-slate-400">
        이 메뉴는 다음 단계에서 지원 데이터와 연결할 수 있습니다.
      </div>
    </section>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
function JobField({
  label,
  value,
  onChange,
  large,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  large?: boolean;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {large ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="form-input resize-y"
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="form-input" />
      )}
    </label>
  );
}
function TextField({
  label,
  value,
  onChange,
  large,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  large?: boolean;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-semibold">
        {label} <small className="font-normal text-slate-400">(선택)</small>
      </span>
      {large ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="입력한 내용만 자기소개서에 사용됩니다."
          className="form-input resize-y"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="해당하는 경우 입력해 주세요."
          className="form-input"
        />
      )}
    </label>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="form-input">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
function ChoiceGroup({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div>
      <b className="text-sm">{label}</b>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.map((value) => (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs",
              selected === value
                ? "border-orange-400 bg-orange-50 text-orange-600"
                : "border-slate-200",
            )}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
