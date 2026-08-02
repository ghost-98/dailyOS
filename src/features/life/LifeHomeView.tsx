import Link from "next/link";
import { Activity, CalendarDays, Camera, HeartPulse, MapPin, Search, Sparkles, UserRound } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";

const primaryFlow = [
  {
    description: "몇 시부터 몇 시까지 어디서 무엇을 했는지 남기는 실제 삶의 기본 단위입니다.",
    href: "/life/activities",
    label: "Core",
    title: "활동 기록",
  },
  {
    description: "일정·할 일·이벤트는 미래 계획과 중요한 마커로 두고, 실제 결과는 활동으로 회수합니다.",
    href: "/life/calendar",
    label: "Plan",
    title: "계획 캘린더",
  },
  {
    description: "사진, 하루기록, 건강 데이터는 활동과 날짜에 붙는 증거와 해석입니다.",
    href: "/life/report",
    label: "Context",
    title: "리포트",
  },
];

const captureModel = [
  { description: "시간·장소·사람·음식·지출을 한 번에 남기는 메인 입력", href: "/life/activities", icon: Activity, title: "활동 기록" },
  { description: "오늘의 감상과 의미를 날짜나 활동에 연결", href: "/life/logs", icon: Sparkles, title: "하루기록" },
  { description: "사진/영상과 메타데이터를 날짜·활동·이벤트에 연결", href: "/life/photos", icon: Camera, title: "사진·영상" },
  { description: "러닝 시간/거리와 아침 몸무게를 하루 상태로 저장", href: "/life/health", icon: HeartPulse, title: "건강" },
];

const retrievalModel = [
  { description: "하루와 주간을 실제 타임라인으로 복원", href: "/life/report", icon: CalendarDays, title: "리포트" },
  { description: "한 달의 소비, 사람, 장소, 활동 패턴 확인", href: "/life/monthly", icon: Search, title: "월간 회고" },
  { description: "기억나는 단서로 전체 인생 기록 검색", href: "/life/search", icon: Search, title: "전체 검색" },
  { description: "사람별 만남, 지출, 장소 맥락 보기", href: "/life/people", icon: UserRound, title: "사람" },
  { description: "장소별로 묶인 활동과 이동 흐름 보기", href: "/life/places-flow", icon: MapPin, title: "장소 흐름" },
  { description: "기록을 바탕으로 자연어 질문하기", href: "/life/ask", icon: Sparkles, title: "AI 질문" },
];

export function LifeHomeView() {
  return (
    <div className="life-axis-view">
      <header className="life-db-hero">
        <p className="eyebrow">Activity-first Life Database</p>
        <h1>활동을 중심으로 삶을 기록하고, 나중에 다시 꺼내 쓰는 개인 OS</h1>
        <p>
          dailyOS의 중심 단위는 이제 활동입니다. 일정과 할 일은 계획, 하루기록과 사진과 건강은 맥락, 장소·사람·지출은 활동에서 파생되는 축으로 정리합니다.
          이렇게 쌓인 기록은 리포트, 월간 회고, 검색, AI 질문의 근거가 됩니다.
        </p>
      </header>

      <div className="life-db-flow">
        {primaryFlow.map((item) => (
          <SectionCard key={item.title}>
            <p className="eyebrow">{item.label}</p>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <Link className="empty-dashboard-link" href={item.href}>
              열기
            </Link>
          </SectionCard>
        ))}
      </div>

      <section className="life-db-section">
        <LifeHomeSectionHeading
          title="입력 구조"
          description="실제 삶은 활동으로 저장하고, 다른 데이터는 활동이나 날짜에 연결합니다. 그래서 입력도 활동을 가장 먼저 두었습니다."
        />
        <div className="life-db-card-grid life-db-card-grid--compact">
          {captureModel.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="life-db-card" href={item.href} key={item.title}>
                <span>
                  <Icon aria-hidden size={16} />
                  입력
                </span>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="life-db-section">
        <LifeHomeSectionHeading
          title="조회와 활용"
          description="기록을 많이 쌓는 것보다 더 중요한 건 다시 읽히는 구조입니다. 날짜, 사람, 장소, 질문으로 되찾을 수 있게 분리했습니다."
        />
        <div className="life-db-card-grid">
          {retrievalModel.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="life-db-card" href={item.href} key={item.title}>
                <span>
                  <Icon aria-hidden size={16} />
                  활용
                </span>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function LifeHomeSectionHeading({ description, title }: { description: string; title: string }) {
  return (
    <div className="life-tab-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}
