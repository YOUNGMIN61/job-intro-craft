import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Coffee,
  Store,
  Utensils,
  ShoppingBag,
  Monitor,
  Package,
  Smile,
  Sun,
  List,
  Sparkles,
  Copy,
  RefreshCw,
  Bookmark,
  FileText,
  Pencil,
  User,
  ChevronDown,
  Check,
  Lightbulb,
} from "lucide-react";
import { generateIntro } from "@/lib/generate-intro.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "알바 자기소개서 문구 생성기" },
      { name: "description", content: "지원 분야를 선택하면 맞춤 자기소개 문구를 자동으로 만들어드려요." },
    ],
  }),
  component: Index,
});

const FIELDS = [
  { id: "cafe", label: "카페 / 바리스타", icon: Coffee },
  { id: "convenience", label: "편의점", icon: Store },
  { id: "restaurant", label: "음식점 / 서빙", icon: Utensils },
  { id: "sales", label: "판매 / 매장관리", icon: ShoppingBag },
  { id: "office", label: "사무보조", icon: Monitor },
  { id: "logistics", label: "물류 / 포장", icon: Package },
];

const TONES = [
  { id: "polite", label: "정중하게", icon: Smile },
  { id: "bright", label: "밝고 적극적으로", icon: Sun },
  { id: "concise", label: "간단하게", icon: List },
] as const;

type ToneId = (typeof TONES)[number]["id"];

function Index() {
  const generate = useServerFn(generateIntro);
  const [fieldId, setFieldId] = useState("cafe");
  const [open, setOpen] = useState(false);
  const [strengths, setStrengths] = useState("");
  const [tone, setTone] = useState<ToneId>("polite");
  const [extra, setExtra] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const field = FIELDS.find((f) => f.id === fieldId)!;
  const FieldIcon = field.icon;
  const step = result ? 3 : loading ? 2 : 1;

  const run = async () => {
    setLoading(true);
    try {
      const { text } = await generate({ data: { field: field.label, strengths, tone, extra } });
      setResult(text);
    } catch (e) {
      setResult("생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white p-6 md:p-10 shadow-sm">
        {/* Header */}
        <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">알바 자기소개서 문구 생성기</h1>
              <p className="mt-1 text-sm text-slate-500">
                지원 분야를 선택하면 맞춤 자기소개 문구를 자동으로 만들어드려요.
              </p>
            </div>
          </div>
          <Stepper step={step} />
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Input panel */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Pencil className="h-4 w-4 text-blue-600" /> 지원 정보 입력
            </h2>

            {/* Field select */}
            <div className="mt-5">
              <Label>지원 분야</Label>
              <div className="relative mt-2">
                <button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 transition hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="flex items-center gap-2">
                    <FieldIcon className="h-4 w-4 text-blue-600" />
                    {field.label}
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")}
                  />
                </button>
                {open && (
                  <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {FIELDS.map((f) => {
                      const Icon = f.icon;
                      const active = f.id === fieldId;
                      return (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setFieldId(f.id);
                              setOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between px-4 py-2.5 text-sm transition",
                              active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50",
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {f.label}
                            </span>
                            {active && <Check className="h-4 w-4" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Strengths */}
            <div className="mt-5">
              <Label>경험 및 강점</Label>
              <div className="relative mt-2">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value.slice(0, 100))}
                  placeholder="친절한 응대, 성실함, 빠른 적응력"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-16 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  {strengths.length}/100
                </span>
              </div>
            </div>

            {/* Tone chips */}
            <div className="mt-5">
              <Label>원하는 분위기</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {TONES.map((t) => {
                  const Icon = t.icon;
                  const active = tone === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                        active
                          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Extra */}
            <div className="mt-5">
              <Label icon={<Pencil className="h-3.5 w-3.5" />}>추가 요청</Label>
              <div className="relative mt-2">
                <textarea
                  value={extra}
                  onChange={(e) => setExtra(e.target.value.slice(0, 100))}
                  placeholder="고객 응대 경험을 강조해 주세요."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute bottom-2 right-3 text-xs text-slate-400">
                  {extra.length}/100
                </span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              disabled={loading}
              onClick={run}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> 생성 중...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> 자기소개 문구 생성
                </>
              )}
            </button>
          </section>

          {/* Result panel */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <FileText className="h-4 w-4 text-blue-600" /> 생성 결과
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                <Sparkles className="h-3 w-3" /> {field.label} 맞춤 문구
              </span>
            </div>

            <div className="mt-4 min-h-[320px] rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
              {result ? (
                result
              ) : loading ? (
                <div className="flex h-full min-h-[280px] items-center justify-center text-slate-400">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> 문구를 만들고 있어요...
                </div>
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center text-center text-slate-400">
                  왼쪽에서 정보를 입력하고<br />&apos;자기소개 문구 생성&apos; 버튼을 눌러주세요.
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <ActionBtn onClick={copy} disabled={!result} icon={copied ? Check : Copy}>
                {copied ? "복사됨" : "복사하기"}
              </ActionBtn>
              <ActionBtn onClick={run} disabled={loading} icon={RefreshCw}>
                다시 생성
              </ActionBtn>
              <ActionBtn onClick={() => {}} disabled={!result} icon={Bookmark}>
                저장
              </ActionBtn>
            </div>

            <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <Lightbulb className="h-3.5 w-3.5" /> 생성된 문구는 자유롭게 수정하여 사용하실 수 있습니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Label({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
      {icon}
      {children}
      <span className="text-blue-500">•</span>
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm text-slate-700 transition hover:border-blue-400 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = [
    { n: 1, label: "정보 입력" },
    { n: 2, label: "문구 생성" },
    { n: 3, label: "완료" },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition",
                step >= s.n
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-400",
              )}
            >
              {s.n}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                step >= s.n ? "text-blue-700" : "text-slate-400",
              )}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="mb-5 h-px w-8 border-t border-dashed border-slate-300 md:w-12" />
          )}
        </div>
      ))}
    </div>
  );
}
