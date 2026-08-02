import Link from "next/link";
import { SectionCard } from "@/components/ui/SectionCard";

const lifeDatabaseModel = [
  {
    description: "일정·할일·활동을 하루의 시간축에 올리고 사진, 기록, 지출, 건강을 같은 날짜에 겹쳐 봅니다.",
    href: "/life/calendar",
    label: "시간축",
    title: "언제 무엇을 했는가",
  },
  {
    description: "하루 리포트는 날짜 하나를 기준으로 계획, 실제 활동, 사진, 하루기록, 건강, 소비를 한 장으로 복원합니다.",
    href: "/life/report",
    label: "하루",
    title: "그날이 어떤 하루였는가",
  },
  {
    description: "월간 회고와 전체 검색, AI 질문은 쌓인 기록을 다시 꺼내 의미와 답으로 바꾸는 해석 계층입니다.",
    href: "/life/ask",
    label: "해석",
    title: "기록을 다시 쓰는 지식으로 바꾸기",
  },
];

const lifeEntryModel = [
  { description: "몇 시부터 어디서 무엇을 했는지 남기는 실제 행동 기록", href: "/life/activities", title: "활동 기록" },
  { description: "날짜나 일정·할일·활동에 연결되는 짧은 텍스트 기록", href: "/life/logs", title: "하루기록" },
  { description: "사진·영상과 메타데이터를 날짜나 맥락에 연결", href: "/life/photos", title: "사진" },
  { description: "러닝 거리·시간, 아침 몸무게를 날짜에 누적", href: "/life/health", title: "건강" },
];

export function LifeHomeView() {
  return (
    <div className="life-axis-view">
      <header className="life-db-hero">
        <p className="eyebrow">Life Database OS</p>
        <h1>내 삶의 원본 기록을 모으고, 연결하고, 다시 질문하는 시스템</h1>
        <p>
          dailyOS의 라이프 DB는 캘린더, 일기, 사진첩, 가계부를 따로 흩어두지 않습니다. 하루의 시간축 위에 실제 활동, 장소, 사람,
          소비, 사진, 건강 기록을 연결해 나중에 검색·회고·AI 질문의 근거로 쓰는 개인 데이터베이스입니다.
        </p>
      </header>

      <div className="life-db-flow">
        <SectionCard>
          <p className="eyebrow">01 Capture</p>
          <h2>하루의 원본을 남긴다</h2>
          <p>일정·할일은 계획이고, 활동 기록은 실제 행동입니다. 하루기록·사진·건강은 그날을 설명하는 증거 자료로 붙습니다.</p>
        </SectionCard>
        <SectionCard>
          <p className="eyebrow">02 Connect</p>
          <h2>맥락으로 묶는다</h2>
          <p>날짜, 시간, 장소, 함께한 사람, 지출, 사진, 메모가 같은 일정·할일·활동 아래에서 연결됩니다.</p>
        </SectionCard>
        <SectionCard>
          <p className="eyebrow">03 Retrieve</p>
          <h2>필요할 때 다시 꺼낸다</h2>
          <p>하루 리포트, 월간 회고, 전체 검색, AI 질문을 통해 내 생활 패턴과 기억을 다시 사용할 수 있습니다.</p>
        </SectionCard>
      </div>

      <section className="life-db-section">
        <LifeHomeSectionHeading title="조회와 해석" description="라이프 DB는 입력한 기록을 다시 읽고, 비교하고, 질문하기 위한 최종 조회 공간입니다." />
        <div className="life-db-card-grid">
          {lifeDatabaseModel.map((item) => (
            <Link className="life-db-card" href={item.href} key={item.title}>
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </Link>
          ))}
          <Link className="life-db-card life-db-card--accent" href="/life/search">
            <span>검색</span>
            <strong>흐릿한 기억을 찾아내기</strong>
            <p>사람, 장소, 날짜, 금액, 사진명, 메모를 한 번에 찾아서 원하는 하루나 맥락으로 바로 돌아갑니다.</p>
          </Link>
          <Link className="life-db-card life-db-card--accent" href="/life/ask">
            <span>AI 질문</span>
            <strong>기록을 읽고 답하게 하기</strong>
            <p>“3월에 자주 만난 사람과 그때의 소비·건강 흐름이 어땠어?” 같은 질문을 내 기록 기반으로 묻습니다.</p>
          </Link>
        </div>
      </section>

      <section className="life-db-section">
        <LifeHomeSectionHeading title="입력과 축적" description="매일 쓰는 입력은 빠르게, 나중에 보는 조회는 강하게 분리했습니다." />
        <div className="life-db-card-grid life-db-card-grid--compact">
          {lifeEntryModel.map((item) => (
            <Link className="life-db-card" href={item.href} key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </Link>
          ))}
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
