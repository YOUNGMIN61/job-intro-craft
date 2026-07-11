import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clipboard, ExternalLink, Loader2, MapPin, Send, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { analyzeJobPosting, generateApplicationMessage } from "@/lib/generate-intro.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "간단 온라인 지원" },
      {
        name: "description",
        content: "채용 공고를 확인하고 간단한 온라인 지원 내용을 작성합니다.",
      },
    ],
  }),
  component: SimpleApplication,
});

type Job = {
  title: string;
  company: string;
  location: string;
  sourceUrl: string;
  description: string;
  keywords: string[];
  warning?: string;
};

type FormData = {
  name: string;
  age: string;
  region: string;
  message: string;
};

const EMPTY_FORM: FormData = { name: "", age: "", region: "", message: "" };

function SimpleApplication() {
  const analyzeOnServer = useServerFn(analyzeJobPosting);
  const generateMessage = useServerFn(generateApplicationMessage);
  const [url, setUrl] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const draft = localStorage.getItem("simple-application-draft");
      if (draft) setForm({ ...EMPTY_FORM, ...JSON.parse(draft) });
    } catch {
      // A corrupt draft should not prevent the form from loading.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("simple-application-draft", JSON.stringify(form));
  }, [form]);

  const update = (key: keyof FormData, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const showNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2800);
  };

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
    try {
      const result = await analyzeOnServer({ data: { url: parsed.toString() } });
      setJob(result);
      showNotice(result.warning || "공고를 확인했습니다.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "공고를 확인하지 못했습니다.");
    } finally {
      setAnalyzing(false);
    }
  };

  const applicationText = () => {
    const lines = [
      job ? `지원 공고: ${job.title}` : "",
      job?.company ? `업체: ${job.company}` : "",
      `이름: ${form.name}`,
      `나이: ${form.age}세`,
      `사는 지역: ${form.region}`,
      "",
      "전달 메시지",
      form.message,
    ];
    return lines
      .filter((line, index) => line || index >= 5)
      .join("\n")
      .trim();
  };

  const hasProfile = Boolean(form.name.trim() && form.age && form.region.trim());
  const isComplete = Boolean(hasProfile && form.message.trim());

  const createMessage = async () => {
    if (!job) {
      showNotice("먼저 공고 URL을 분석해 주세요.");
      return;
    }
    if (!hasProfile) {
      showNotice("이름, 나이, 사는 지역을 모두 입력해 주세요.");
      return;
    }
    setGenerating(true);
    try {
      const result = await generateMessage({
        data: {
          name: form.name,
          age: Number(form.age),
          region: form.region,
          jobTitle: job.title,
          company: job.company,
          description: job.description,
          keywords: job.keywords,
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

  const copyApplication = async () => {
    if (!isComplete) return;
    await navigator.clipboard.writeText(applicationText());
    showNotice("지원 내용을 복사했습니다. 공고 사이트의 지원창에 붙여넣어 주세요.");
  };

  const saveApplication = () => {
    if (!isComplete) return;
    const item = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), job, ...form };
    try {
      const previous = JSON.parse(localStorage.getItem("simple-applications") || "[]");
      localStorage.setItem("simple-applications", JSON.stringify([item, ...previous].slice(0, 20)));
      showNotice("지원 내용을 이 브라우저에 저장했습니다.");
    } catch {
      showNotice("지원 내용을 저장하지 못했습니다.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:py-14">
      {notice && (
        <div
          role="status"
          className="fixed right-5 top-5 z-50 max-w-sm rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl"
        >
          {notice}
        </div>
      )}

      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            <Send className="h-3.5 w-3.5" /> 간단 온라인 지원
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            지원 내용만 빠르게 작성하세요
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            공고 URL과 기본 정보만 입력하면 AI가 담당자에게 보낼 메시지를 작성합니다.
          </p>
        </header>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <label htmlFor="job-url" className="text-sm font-semibold">
            공고 URL <span className="text-orange-500">*</span>
          </label>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              id="job-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && url.trim() && analyze()}
              placeholder="알바몬 또는 잡코리아 상세 공고 URL"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
            <button
              type="button"
              onClick={analyze}
              disabled={!url.trim() || analyzing}
              className="btn-primary whitespace-nowrap"
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              공고 확인
            </button>
          </div>

          {job && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{job.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{job.company}</p>
                </div>
                <a
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline"
                >
                  원문 보기 <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              {job.warning && (
                <p className="mt-3 text-xs leading-5 text-amber-700">{job.warning}</p>
              )}
            </div>
          )}
        </section>

        <form
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="mb-6 flex items-center gap-2">
            <UserRound className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-bold">지원자 정보</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="이름" required>
              <input
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                maxLength={30}
                placeholder="이름을 입력해 주세요"
                className="form-input"
              />
            </Field>
            <Field label="나이" required>
              <div className="relative">
                <input
                  type="number"
                  min="15"
                  max="100"
                  value={form.age}
                  onChange={(event) => update("age", event.target.value)}
                  placeholder="나이"
                  className="form-input pr-10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  세
                </span>
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="사는 지역" required>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.region}
                    onChange={(event) => update("region", event.target.value)}
                    maxLength={50}
                    placeholder="예: 서울시 강남구"
                    className="form-input pl-11"
                  />
                </div>
              </Field>
            </div>
          </div>

          <div className="mt-7 border-t border-slate-100 pt-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <label htmlFor="message" className="text-sm font-semibold">
                  AI가 작성한 전달 메시지
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  공고와 기본 정보를 바탕으로 작성되며, 생성 후 직접 수정할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={createMessage}
                disabled={!job || !hasProfile || generating}
                className="btn-primary"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {form.message ? "다시 작성" : "지원 메시지 자동 작성"}
              </button>
            </div>
            <div className="relative mt-3">
              <textarea
                id="message"
                value={form.message}
                onChange={(event) => update("message", event.target.value.slice(0, 1000))}
                maxLength={1000}
                rows={7}
                placeholder="공고를 확인하고 이름, 나이, 사는 지역을 입력하면 AI가 자동으로 작성합니다."
                className="w-full resize-y rounded-xl border border-slate-800 px-5 py-4 pb-9 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
              <span className="absolute bottom-3 right-4 text-xs">
                <b className={form.message.length ? "text-orange-500" : "text-slate-400"}>
                  {form.message.length}
                </b>
                <span className="text-slate-400">/1000</span>
              </span>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-400">
            입력 내용은 자동으로 이 브라우저에 임시 저장됩니다. 실제 지원은 공고 사이트에서 제출해
            주세요.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={saveApplication}
              disabled={!isComplete}
              className="btn-secondary"
            >
              내용 저장
            </button>
            <button
              type="button"
              onClick={copyApplication}
              disabled={!isComplete}
              className="btn-primary"
            >
              <Clipboard className="h-4 w-4" />
              지원 내용 복사
            </button>
          </div>
        </form>
      </div>
    </main>
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
