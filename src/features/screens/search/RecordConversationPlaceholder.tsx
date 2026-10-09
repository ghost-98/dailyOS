import { Brain, Send } from "lucide-react";

export function RecordConversationPlaceholder() {
  return (
    <div className="life-ask-layout">
      <section className="life-ask-chat" aria-label="기록 대화">
        <div className="life-ask-thread">
          <div className="life-map-empty life-map-empty--compact">
            <Brain aria-hidden size={28} />
            <strong>기록 대화</strong>
            <p>현재 사용할 수 없습니다.</p>
          </div>
        </div>
        <div className="life-ask-composer">
          <textarea aria-label="기록 대화 질문" disabled placeholder="기록에 대해 물어보세요" />
          <button className="life-ask-submit" aria-label="질문 보내기" disabled type="button">
            <Send aria-hidden size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
