import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bookmark,
  Check,
  Clipboard,
  ClipboardList,
  ExternalLink,
  FileText,
  Heart,
  Loader2,
  MapPin,
  Pencil,
  Send,
  Settings,
  Sparkles,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { analyzeJobPosting, generateApplicationMessage } from "@/lib/generate-intro.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "알바 간단 온라인 지원" },
      { name: "description", content: "알바 공고를 분석해 온라인 지원 메시지를 자동 작성합니다." },
    ],
  }),
  component: App,
});

type View = "apply" | "history" | "favorites" | "resume" | "settings";
type Job = {
  title: string;
  company: string;
  location: string;
  sourceUrl: string;
  description: string;
  keywords: string[];
  warning?: string;
};
type FormData = { name: string; age: string; region: string; message: string };
type SavedApplication = FormData & { id: string; savedAt: string; job: Job | null; field: string };
type FavoriteJob = Job & { id: string; savedAt: string };

const EMPTY_FORM: FormData = { name: "", age: "", region: "", message: "" };
const FIELDS = [
  "카페·음료",
  "외식·서비스",
  "매장관리·판매",
  "사무·행정",
  "고객상담",
  "물류·배송",
  "생산·제조",
  "IT·개발",
  "디자인",
  "기타",
];

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "") as T;
  } catch {
    return fallback;
  }
}

function App() {
  const analyzeOnServer = useServerFn(analyzeJobPosting);
  const generateMessage = useServerFn(generateApplicationMessage);
  const [view, setView] = useState<View>("apply");
  const [url, setUrl] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [field, setField] = useState(FIELDS[0]);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [history, setHistory] = useState<SavedApplication[]>([]);
  const [favorites, setFavorites] = useState<FavoriteJob[]>([]);
  const [autoSave, setAutoSave] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setForm({ ...EMPTY_FORM, ...readStorage("simple-application-draft", EMPTY_FORM) });
    setHistory(readStorage("simple-applications", []));
    setFavorites(readStorage("favorite-jobs", []));
    setAutoSave(readStorage("application-auto-save", true));
  }, []);

  useEffect(() => {
    if (autoSave) localStorage.setItem("simple-application-draft", JSON.stringify(form));
  }, [form, autoSave]);

  const showNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2800);
  };
  const update = (key: keyof FormData, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const hasProfile = Boolean(form.name.trim() && form.age && form.region.trim());
  const isComplete = Boolean(job && hasProfile && form.message.trim());

  const analyze = async () => {
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      showNotice("올바른 알바몬 또는 잡코리아 공고 URL을 입력해 주세요.");
      return;
    }
    setAnalyzing(true);
    setJob(null);
    update("message", "");
    try {
      const result = await analyzeOnServer({ data: { url: parsed.toString() } });
      setJob(result);
      showNotice(result.warning || "공고 분석을 완료했습니다.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "공고를 분석하지 못했습니다.");
    } finally {
      setAnalyzing(false);
    }
  };

  const createMessage = async () => {
    if (!job || !hasProfile) return;
    setGenerating(true);
    try {
      const result = await generateMessage({
        data: {
          name: form.name,
          age: Number(form.age),
          region: form.region,
          jobTitle: job.title,
          company: job.company,
          description: `${job.description}\n지원 분야: ${field}`,
          keywords: [field, ...job.keywords],
        },
      });
      update("message", result.text);
      showNotice("공고에 맞춘 지원 메시지를 작성했습니다.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "지원 메시지를 작성하지 못했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const applicationText = () =>
    [
      `지원 공고: ${job?.title || ""}`,
      `지원 분야: ${field}`,
      `이름: ${form.name}`,
      `나이: ${form.age}세`,
      `사는 지역: ${form.region}`,
      "",
      "전달 메시지",
      form.message,
    ]
      .join("\n")
      .trim();
  const copyApplication = async () => {
    if (isComplete) {
      await navigator.clipboard.writeText(applicationText());
      showNotice("지원 내용을 복사했습니다.");
    }
  };
  const saveApplication = () => {
    if (!isComplete) return;
    const item: SavedApplication = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      job,
      field,
      ...form,
    };
    const next = [item, ...history].slice(0, 30);
    setHistory(next);
    localStorage.setItem("simple-applications", JSON.stringify(next));
    showNotice("작성 내역에 저장했습니다.");
  };
  const addFavorite = () => {
    if (!job) return;
    if (favorites.some((item) => item.sourceUrl === job.sourceUrl)) {
      showNotice("이미 즐겨찾기에 있는 공고입니다.");
      return;
    }
    const next = [
      { ...job, id: crypto.randomUUID(), savedAt: new Date().toISOString() },
      ...favorites,
    ];
    setFavorites(next);
    localStorage.setItem("favorite-jobs", JSON.stringify(next));
    showNotice("공고를 즐겨찾기에 저장했습니다.");
  };
  const openFavorite = (item: FavoriteJob) => {
    setJob(item);
    setUrl(item.sourceUrl);
    setView("apply");
    update("message", "");
  };
  const deleteHistory = (id: string) => {
    const next = history.filter((item) => item.id !== id);
    setHistory(next);
    localStorage.setItem("simple-applications", JSON.stringify(next));
  };
  const deleteFavorite = (id: string) => {
    const next = favorites.filter((item) => item.id !== id);
    setFavorites(next);
    localStorage.setItem("favorite-jobs", JSON.stringify(next));
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
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-6 lg:flex">
          <button onClick={() => setView("apply")} className="flex items-center gap-3 text-left">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white">
              <Pencil className="h-5 w-5" />
            </span>
            <span>
              <b className="block">알바 지원 도우미</b>
              <small className="text-slate-500">AI 간단 온라인 지원</small>
            </span>
          </button>
          <nav className="mt-8 space-y-1">
            <Nav
              icon={Pencil}
              label="간단 지원서 작성"
              active={view === "apply"}
              onClick={() => setView("apply")}
            />
            <Nav
              icon={FileText}
              label={`작성 내역 (${history.length})`}
              active={view === "history"}
              onClick={() => setView("history")}
            />
            <Nav
              icon={Star}
              label={`즐겨찾기 공고 (${favorites.length})`}
              active={view === "favorites"}
              onClick={() => setView("favorites")}
            />
            <Nav
              icon={ClipboardList}
              label="이력서 관리"
              active={view === "resume"}
              onClick={() => setView("resume")}
            />
            <Nav
              icon={Settings}
              label="설정"
              active={view === "settings"}
              onClick={() => setView("settings")}
            />
          </nav>
          <div className="mt-auto rounded-xl bg-orange-50 p-4 text-xs leading-5 text-orange-800">
            <Sparkles className="mb-2 h-4 w-4" />
            공고 URL과 기본 정보만 입력하면 알바몬 온라인 지원창에 넣을 메시지를 작성합니다.
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
          <MobileNav view={view} setView={setView} />
          {view === "apply" && (
            <ApplyView
              {...{
                url,
                setUrl,
                analyze,
                analyzing,
                job,
                field,
                setField,
                form,
                update,
                createMessage,
                generating,
                hasProfile,
                isComplete,
                copyApplication,
                saveApplication,
                addFavorite,
              }}
            />
          )}
          {view === "history" && (
            <ListView
              title="작성 내역"
              empty="저장된 지원서가 없습니다."
              items={history.map((item) => ({
                id: item.id,
                title: item.job?.title || "간단 지원서",
                subtitle: `${item.name} · ${item.field} · ${new Date(item.savedAt).toLocaleString("ko-KR")}`,
                body: item.message,
              }))}
              onDelete={deleteHistory}
            />
          )}
          {view === "favorites" && (
            <FavoriteView items={favorites} onOpen={openFavorite} onDelete={deleteFavorite} />
          )}
          {view === "resume" && <ProfileView form={form} update={update} showNotice={showNotice} />}
          {view === "settings" && (
            <SettingsView
              autoSave={autoSave}
              setAutoSave={(value) => {
                setAutoSave(value);
                localStorage.setItem("application-auto-save", JSON.stringify(value));
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

type ApplyViewProps = {
  url: string;
  setUrl: (value: string) => void;
  analyze: () => Promise<void>;
  analyzing: boolean;
  job: Job | null;
  field: string;
  setField: (value: string) => void;
  form: FormData;
  update: (key: keyof FormData, value: string) => void;
  createMessage: () => Promise<void>;
  generating: boolean;
  hasProfile: boolean;
  isComplete: boolean;
  copyApplication: () => Promise<void>;
  saveApplication: () => void;
  addFavorite: () => void;
};

function ApplyView({
  url,
  setUrl,
  analyze,
  analyzing,
  job,
  field,
  setField,
  form,
  update,
  createMessage,
  generating,
  hasProfile,
  isComplete,
  copyApplication,
  saveApplication,
  addFavorite,
}: ApplyViewProps) {
  return (
    <>
      <header>
        <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
          <Send className="h-3.5 w-3.5" /> 알바몬 맞춤 간단 지원
        </span>
        <h1 className="mt-3 text-3xl font-bold">공고에 맞는 지원 메시지를 자동으로</h1>
        <p className="mt-2 text-sm text-slate-500">
          URL 분석 후 기본 정보만 입력하면 온라인 지원용 전달 메시지를 작성합니다.
        </p>
      </header>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <Card>
            <Step n={1} title="공고 URL 분석" />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && url.trim() && analyze()}
                placeholder="알바몬 또는 잡코리아 상세 공고 URL"
                className="form-input min-w-0 flex-1"
              />
              <button
                onClick={analyze}
                disabled={!url.trim() || analyzing}
                className="btn-primary whitespace-nowrap"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                공고 분석
              </button>
            </div>
          </Card>
          <Card>
            <Step n={2} title="지원 분야 선택" />
            <div className="mt-4 flex flex-wrap gap-2">
              {FIELDS.map((item) => (
                <button
                  key={item}
                  onClick={() => setField(item)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-medium transition",
                    field === item
                      ? "border-orange-400 bg-orange-50 text-orange-600"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <Step n={3} title="간단 지원서" />
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="이름" required>
                <input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  maxLength={30}
                  placeholder="이름"
                  className="form-input"
                />
              </Field>
              <Field label="나이" required>
                <input
                  type="number"
                  min="15"
                  max="100"
                  value={form.age}
                  onChange={(e) => update("age", e.target.value)}
                  placeholder="나이"
                  className="form-input"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="사는 지역" required>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.region}
                      onChange={(e) => update("region", e.target.value)}
                      maxLength={50}
                      placeholder="예: 서울시 강남구"
                      className="form-input pl-11"
                    />
                  </div>
                </Field>
              </div>
            </div>
            <div className="mt-7 border-t pt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <b className="text-sm">온라인 지원 전달 메시지</b>
                  <p className="mt-1 text-xs text-slate-500">
                    생성된 내용을 확인하고 필요하면 수정하세요.
                  </p>
                </div>
                <button
                  onClick={createMessage}
                  disabled={!job || !hasProfile || generating}
                  className="btn-primary"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {form.message ? "다시 작성" : "AI 자동 작성"}
                </button>
              </div>
              <div className="relative mt-3">
                <textarea
                  value={form.message}
                  onChange={(e) => update("message", e.target.value.slice(0, 1000))}
                  maxLength={1000}
                  rows={7}
                  placeholder="공고 분석과 기본 정보 입력 후 AI 자동 작성을 눌러 주세요."
                  className="w-full resize-y rounded-xl border border-slate-800 px-5 py-4 pb-9 text-sm leading-6 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
                <span className="absolute bottom-3 right-4 text-xs">
                  <b className="text-orange-500">{form.message.length}</b>
                  <span className="text-slate-400">/1000</span>
                </span>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={saveApplication} disabled={!isComplete} className="btn-secondary">
                <Bookmark className="h-4 w-4" />
                작성 내역 저장
              </button>
              <button onClick={copyApplication} disabled={!isComplete} className="btn-primary">
                <Clipboard className="h-4 w-4" />
                지원 내용 복사
              </button>
            </div>
          </Card>
        </div>
        <JobPanel job={job} onFavorite={addFavorite} />
      </div>
    </>
  );
}

function JobPanel({ job, onFavorite }: { job: Job | null; onFavorite: () => void }) {
  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold">분석 공고 정보</h2>
      {job ? (
        <div className="mt-5 space-y-4 text-sm">
          <Info label="공고명" value={job.title} />
          <Info label="업체" value={job.company} />
          <Info label="근무 지역" value={job.location} />
          <div>
            <span className="text-xs text-slate-500">핵심 키워드</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.keywords.map((word) => (
                <span
                  key={word}
                  className="rounded-md bg-orange-50 px-2 py-1 text-xs text-orange-600"
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
          {job.warning && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-700">
              {job.warning}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={onFavorite} className="btn-secondary flex-1">
              <Heart className="h-4 w-4" />
              즐겨찾기
            </button>
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary flex-1"
            >
              원문 <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm leading-6 text-slate-400">
          공고 URL을 분석하면 공고명, 업체, 지역과 핵심 키워드가 표시됩니다.
        </p>
      )}
    </aside>
  );
}
function ListView({
  title,
  empty,
  items,
  onDelete,
}: {
  title: string;
  empty: string;
  items: { id: string; title: string; subtitle: string; body: string }[];
  onDelete: (id: string) => void;
}) {
  return (
    <section>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="mt-6 space-y-3">
        {items.length ? (
          items.map((item) => (
            <article key={item.id} className="rounded-xl border bg-white p-5">
              <div className="flex justify-between gap-4">
                <div>
                  <b>{item.title}</b>
                  <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
                </div>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-4 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {item.body}
              </p>
            </article>
          ))
        ) : (
          <Empty text={empty} />
        )}
      </div>
    </section>
  );
}
function FavoriteView({
  items,
  onOpen,
  onDelete,
}: {
  items: FavoriteJob[];
  onOpen: (item: FavoriteJob) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section>
      <h1 className="text-2xl font-bold">즐겨찾기 공고</h1>
      <div className="mt-6 space-y-3">
        {items.length ? (
          items.map((item) => (
            <article
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-5"
            >
              <div>
                <b>{item.title}</b>
                <p className="mt-1 text-xs text-slate-500">{item.company}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onOpen(item)} className="btn-secondary">
                  지원서 작성
                </button>
                <button onClick={() => onDelete(item.id)} className="btn-secondary text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))
        ) : (
          <Empty text="즐겨찾기한 공고가 없습니다." />
        )}
      </div>
    </section>
  );
}
function ProfileView({
  form,
  update,
  showNotice,
}: {
  form: FormData;
  update: (key: keyof FormData, value: string) => void;
  showNotice: (text: string) => void;
}) {
  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-bold">이력서 관리</h1>
      <p className="mt-2 text-sm text-slate-500">
        간단 지원에 반복 사용하는 기본 정보를 관리합니다.
      </p>
      <Card>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="이름">
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>
          <Field label="나이">
            <input
              className="form-input"
              type="number"
              value={form.age}
              onChange={(e) => update("age", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="사는 지역">
              <input
                className="form-input"
                value={form.region}
                onChange={(e) => update("region", e.target.value)}
              />
            </Field>
          </div>
        </div>
        <button
          onClick={() => showNotice("기본 정보가 저장되었습니다.")}
          className="btn-primary mt-5"
        >
          기본 정보 저장
        </button>
      </Card>
    </section>
  );
}
function SettingsView({
  autoSave,
  setAutoSave,
}: {
  autoSave: boolean;
  setAutoSave: (value: boolean) => void;
}) {
  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-bold">설정</h1>
      <div className="mt-6 flex items-center justify-between rounded-xl border bg-white p-5">
        <div>
          <b className="text-sm">입력 내용 자동 저장</b>
          <p className="mt-1 text-xs text-slate-500">
            현재 브라우저에 이름, 나이, 지역과 메시지를 임시 저장합니다.
          </p>
        </div>
        <button
          onClick={() => setAutoSave(!autoSave)}
          className={cn(
            "relative h-7 w-12 rounded-full transition",
            autoSave ? "bg-orange-500" : "bg-slate-300",
          )}
        >
          <span
            className={cn(
              "absolute top-1 h-5 w-5 rounded-full bg-white transition",
              autoSave ? "left-6" : "left-1",
            )}
          />
        </button>
      </div>
    </section>
  );
}
function MobileNav({ view, setView }: { view: View; setView: (view: View) => void }) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">
      {(["apply", "history", "favorites", "resume", "settings"] as View[]).map((item) => (
        <button
          key={item}
          onClick={() => setView(item)}
          className={cn(
            "whitespace-nowrap rounded-lg px-3 py-2 text-xs",
            view === item ? "bg-orange-500 text-white" : "border bg-white",
          )}
        >
          {
            {
              apply: "지원서 작성",
              history: "작성 내역",
              favorites: "즐겨찾기",
              resume: "이력서",
              settings: "설정",
            }[item]
          }
        </button>
      ))}
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
  active: boolean;
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
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">
        {label}
        {required && <span className="ml-1 text-orange-500">*</span>}
      </span>
      {children}
    </label>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-slate-500">{label}</span>
      <p className="mt-1 leading-6">{value || "공고 원문에서 확인"}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-white p-12 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
