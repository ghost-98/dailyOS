"use client";

import type { Session, User } from "@supabase/supabase-js";
import { ArrowRight, Cake, Loader2, LockKeyhole, Mail, UserRound, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";
type DailyOSProfile = {
  birthDate?: string;
  email?: string;
  fullName: string;
  gender?: string;
};

type AuthContextValue = {
  displayName: string;
  profile: DailyOSProfile | null;
  refreshProfile: () => Promise<void>;
  session: Session;
  user: User;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DailyOSProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async () => {
    if (!supabase || !session?.user) return;
    const nextProfile = await fetchDailyOSProfile(session.user);
    setProfile(nextProfile);
  };

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const loadingFallback = window.setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 2500);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session);
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null);
      })
      .finally(() => {
        if (!isMounted) return;
        window.clearTimeout(loadingFallback);
        setIsLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      window.clearTimeout(loadingFallback);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }

    let isMounted = true;
    fetchDailyOSProfile(session.user)
      .then((nextProfile) => {
        if (isMounted) setProfile(nextProfile);
      })
      .catch(() => {
        if (isMounted) setProfile(getFallbackProfile(session.user));
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  if (!isSupabaseConfigured) {
    return (
      <AuthShell
        title="Supabase 설정이 필요합니다"
        description=".env.local에 Supabase URL과 publishable key를 넣어 주세요."
      />
    );
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

  return (
    <AuthContext.Provider
      value={{
        displayName: getDisplayName(profile, session.user),
        profile,
        refreshProfile,
        session,
        user: session.user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export async function signOutDailyOS() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function useDailyOSUser() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useDailyOSUser must be used inside AuthGate.");
  return context;
}

export function getDisplayName(profile: DailyOSProfile | null, user?: User | null) {
  const metadataName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  const displayName = profile?.fullName || metadataName || user?.email?.split("@")[0] || "사용자";
  return displayName.trim() || "사용자";
}

async function fetchDailyOSProfile(user: User): Promise<DailyOSProfile> {
  if (!supabase) return getFallbackProfile(user);
  const { data, error } = await supabase
    .from("profiles")
    .select("email,full_name,gender,birth_date")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return getFallbackProfile(user);

  return {
    birthDate: data.birth_date ?? undefined,
    email: data.email ?? user.email ?? undefined,
    fullName: data.full_name || getFallbackProfile(user).fullName,
    gender: data.gender ?? undefined,
  };
}

function getFallbackProfile(user: User): DailyOSProfile {
  return {
    birthDate: typeof user.user_metadata?.birth_date === "string" ? user.user_metadata.birth_date : undefined,
    email: user.email ?? undefined,
    fullName: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : user.email?.split("@")[0] ?? "사용자",
    gender: typeof user.user_metadata?.gender === "string" ? user.user_metadata.gender : undefined,
  };
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!supabase || isSubmitting) return;
    setMessage("");

    if (!email.trim() || password.length < 6) {
      setMessage("이메일과 6자 이상 비밀번호를 입력해 주세요.");
      return;
    }

    if (mode === "signup" && (!fullName.trim() || !gender || !birthDate)) {
      setMessage("이름, 성별, 생년월일을 모두 입력하세요.");
      return;
    }

    setIsSubmitting(true);
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                birth_date: birthDate,
                full_name: fullName.trim(),
                gender,
              },
            },
          });

    setIsSubmitting(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("가입 확인 메일을 보냈습니다. 메일 인증 후 로그인해 주세요.");
    }
  };

  const sendResetEmail = async () => {
    if (!supabase || !email.trim()) {
      setMessage("비밀번호를 재설정할 이메일을 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: typeof window === "undefined" ? undefined : window.location.origin,
    });
    setIsSubmitting(false);
    setMessage(error ? error.message : "비밀번호 재설정 메일을 보냈습니다.");
  };

  return (
    <main className="auth-page">
      <section className="auth-hero" aria-label="dailyOS 로그인 안내">
        <div className="auth-brand">
          <span className="auth-brand__mark">d</span>
          <div>
            <strong>dailyOS</strong>
            <span>일정, 할 일, 건강, 취업 관리</span>
          </div>
        </div>

        <div className="auth-copy">
          <span className="auth-kicker">개인 워크스페이스</span>
          <h1>오늘 할 일부터 기록까지</h1>
          <p>필요한 항목만 직접 등록하고, 오늘 화면에서 바로 확인합니다.</p>
        </div>

        <div className="auth-proof" aria-label="관리 항목">
          <span>일정</span>
          <span>할 일</span>
          <span>건강</span>
          <span>취업</span>
        </div>
      </section>

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-tabs" role="tablist">
          <button
            className={mode === "login" ? "auth-tab auth-tab--active" : "auth-tab"}
            onClick={() => setMode("login")}
            type="button"
          >
            로그인
          </button>
          <button
            className={mode === "signup" ? "auth-tab auth-tab--active" : "auth-tab"}
            onClick={() => setMode("signup")}
            type="button"
          >
            회원가입
          </button>
        </div>

        <div className="auth-card__header">
          <h2 id="auth-title">{mode === "login" ? "로그인" : "계정 만들기"}</h2>
          <p>{mode === "login" ? "이메일과 비밀번호를 입력해 주세요." : "새 워크스페이스를 시작합니다."}</p>
        </div>

        {mode === "signup" ? (
          <>
            <label className="auth-field">
              <span>이름</span>
              <div>
                <UserRound aria-hidden size={18} />
                <input autoComplete="name" placeholder="홍길동" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </div>
            </label>

            <div className="auth-profile-grid">
              <label className="auth-field">
                <span>성별</span>
                <div>
                  <UsersRound aria-hidden size={18} />
                  <select value={gender} onChange={(event) => setGender(event.target.value)}>
                    <option value="">선택</option>
                    <option value="male">남성</option>
                    <option value="female">여성</option>
                    <option value="other">기타</option>
                    <option value="prefer_not_to_say">응답 안 함</option>
                  </select>
                </div>
              </label>

              <label className="auth-field">
                <span>생년월일</span>
                <div>
                  <Cake aria-hidden size={18} />
                  <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
                </div>
              </label>
            </div>
          </>
        ) : null}

        <label className="auth-field">
          <span>이메일</span>
          <div>
            <Mail aria-hidden size={18} />
            <input
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </label>

        <label className="auth-field">
          <span>비밀번호</span>
          <div>
            <LockKeyhole aria-hidden size={18} />
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="6자 이상"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
            />
          </div>
        </label>

        {message ? <p className="auth-message">{message}</p> : null}

        <button className="auth-submit" disabled={isSubmitting} onClick={submit} type="button">
          {isSubmitting ? <Loader2 aria-hidden size={18} /> : <ArrowRight aria-hidden size={18} />}
          {mode === "login" ? "로그인" : "회원가입"}
        </button>
        {mode === "login" ? (
          <button className="auth-link-button" disabled={isSubmitting} onClick={sendResetEmail} type="button">
            비밀번호 재설정
          </button>
        ) : null}
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
