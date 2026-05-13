"use client";

import type { Session } from "@supabase/supabase-js";
import { ArrowRight, CheckCircle2, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return <AuthShell title="Supabase 설정이 필요합니다" description=".env.local에 Supabase URL과 publishable key를 넣어야 dailyOS를 시작할 수 있습니다." />;
  }

  if (isLoading) {
    return (
      <AuthShell title="dailyOS를 준비하고 있습니다" description="로그인 상태를 확인하는 중입니다.">
        <Loader2 className="auth-loader" aria-hidden size={24} />
      </AuthShell>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <>{children}</>;
}

export async function signOutDailyOS() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!supabase || isSubmitting) return;
    setMessage("");

    if (!email.trim() || password.length < 6) {
      setMessage("이메일과 6자 이상 비밀번호를 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });

    setIsSubmitting(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("가입 확인 메일을 보냈습니다. 메일 인증 후 로그인해 주세요.");
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-hero" aria-label="dailyOS 소개">
        <div className="auth-brand">
          <span className="auth-brand__mark">d</span>
          <div>
            <strong>dailyOS</strong>
            <span>일정, 할 일, 건강, 취업을 한 곳에서 관리합니다.</span>
          </div>
        </div>

        <div className="auth-copy">
          <span className="auth-kicker">Personal OS</span>
          <h1>오늘 운영에 필요한 데이터만 깔끔하게.</h1>
          <p>로그인하면 빈 워크스페이스에서 시작합니다. 샘플 데이터 없이 사용자가 직접 만든 기록만 저장됩니다.</p>
        </div>

        <div className="auth-proof">
          <span><CheckCircle2 aria-hidden size={17} /> PWA 설치 대응</span>
          <span><ShieldCheck aria-hidden size={17} /> Supabase RLS 기준</span>
          <span><LockKeyhole aria-hidden size={17} /> 개인 데이터 분리</span>
        </div>
      </section>

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-tabs" role="tablist">
          <button className={mode === "login" ? "auth-tab auth-tab--active" : "auth-tab"} onClick={() => setMode("login")} type="button">로그인</button>
          <button className={mode === "signup" ? "auth-tab auth-tab--active" : "auth-tab"} onClick={() => setMode("signup")} type="button">회원가입</button>
        </div>

        <div className="auth-card__header">
          <h2 id="auth-title">{mode === "login" ? "다시 시작하기" : "워크스페이스 만들기"}</h2>
          <p>{mode === "login" ? "이메일과 비밀번호로 dailyOS에 들어갑니다." : "새 계정을 만들고 본인 데이터만 저장합니다."}</p>
        </div>

        <label className="auth-field">
          <span>이메일</span>
          <div>
            <Mail aria-hidden size={18} />
            <input autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
        </label>

        <label className="auth-field">
          <span>비밀번호</span>
          <div>
            <LockKeyhole aria-hidden size={18} />
            <input autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="6자 이상" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }} />
          </div>
        </label>

        {message ? <p className="auth-message">{message}</p> : null}

        <button className="auth-submit" disabled={isSubmitting} onClick={submit} type="button">
          {isSubmitting ? <Loader2 aria-hidden size={18} /> : <ArrowRight aria-hidden size={18} />}
          {mode === "login" ? "로그인" : "회원가입"}
        </button>
      </section>
    </main>
  );
}

function AuthShell({ children, description, title }: { children?: ReactNode; description: string; title: string }) {
  return (
    <main className="auth-page auth-page--center">
      <section className="auth-card auth-card--notice">
        <div className="auth-brand auth-brand--compact">
          <span className="auth-brand__mark">d</span>
          <strong>dailyOS</strong>
        </div>
        {children}
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
    </main>
  );
}
