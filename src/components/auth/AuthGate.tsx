"use client";

import type { Session, User } from "@supabase/supabase-js";
import { ArrowRight, Cake, Loader2, LockKeyhole, Mail, UserRound, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";
const EMAIL_VERIFICATION_CODE_LENGTH = 8;
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

function getDisplayName(profile: DailyOSProfile | null, user?: User | null) {
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
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [now, setNow] = useState(Date.now());
  const verificationSecondsLeft = verificationExpiresAt ? Math.max(0, Math.ceil((verificationExpiresAt - now) / 1000)) : 0;
  const verificationTimeLabel = `${Math.floor(verificationSecondsLeft / 60)}:${String(verificationSecondsLeft % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!verificationExpiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [verificationExpiresAt]);

  const submit = async () => {
    if (!supabase || isSubmitting) return;
    setMessage("");

    if (!email.trim() || password.length < 6) {
      setMessage("이메일과 6자 이상 비밀번호를 입력해 주세요.");
      return;
    }

    if (mode === "signup") {
      await sendSignupVerificationCode();
      return;
    }

    const normalizedEmail = email.trim();
    setIsSubmitting(true);
    const result = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

    setIsSubmitting(false);

    if (result.error) {
      setMessage(result.error.message);
    }
  };

  const sendSignupVerificationCode = async () => {
    if (!supabase || isSubmitting) return;
    setMessage("");

    if (!fullName.trim() || !gender || !birthDate) {
      setMessage("이름, 성별, 생년월일을 모두 입력하세요.");
      return;
    }

    if (!email.trim() || password.length < 6) {
      setMessage("이메일과 6자 이상 비밀번호를 입력해 주세요.");
      return;
    }

    const normalizedEmail = email.trim();
    setIsSubmitting(true);
    const result = await supabase.auth.signUp({
      email: normalizedEmail,
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

    startEmailVerification(normalizedEmail);
    setMessage(`인증 코드를 보냈습니다. 메일함에서 ${EMAIL_VERIFICATION_CODE_LENGTH}자리 코드를 확인해 주세요.`);
  };

  const startEmailVerification = (targetEmail: string) => {
    setVerificationEmail(targetEmail);
    setVerificationCode("");
    setVerificationExpiresAt(Date.now() + 180000);
    setNow(Date.now());
  };

  const resendVerificationCode = async () => {
    if (!supabase || !verificationEmail || isSubmitting) return;
    setMessage("");
    setIsSubmitting(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: verificationEmail });
    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    startEmailVerification(verificationEmail);
    setMessage("인증 코드를 다시 보냈습니다.");
  };

  const verifyEmailCode = async () => {
    if (!supabase || !verificationEmail || isVerifying) return;
    const token = verificationCode.trim();
    if (token.length !== EMAIL_VERIFICATION_CODE_LENGTH) {
      setMessage(`${EMAIL_VERIFICATION_CODE_LENGTH}자리 인증 코드를 입력해 주세요.`);
      return;
    }

    setMessage("");
    setIsVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email: verificationEmail,
      token,
      type: "signup",
    });
    setIsVerifying(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setVerificationEmail("");
    setVerificationExpiresAt(null);
    setVerificationCode("");
    setMessage("이메일 인증이 완료되었습니다.");
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
            <span>이벤트, 할 일, 건강, 취업 관리</span>
          </div>
        </div>

        <div className="auth-copy">
          <span className="auth-kicker">개인 워크스페이스</span>
          <h1>기록부터 관리까지 한곳에서</h1>
          <p>활동, 할 일, 건강, 문서를 필요한 흐름대로 직접 쌓아가는 개인 워크스페이스입니다.</p>
        </div>

        <div className="auth-proof" aria-label="관리 항목">
          <span>이벤트</span>
          <span>할 일</span>
          <span>건강</span>
          <span>취업</span>
        </div>
      </section>

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-tabs" role="tablist">
          <button
            className={mode === "login" ? "auth-tab auth-tab--active" : "auth-tab"}
            onClick={() => {
              setMode("login");
              setVerificationEmail("");
              setVerificationCode("");
              setVerificationExpiresAt(null);
              setMessage("");
            }}
            type="button"
          >
            로그인
          </button>
          <button
            className={mode === "signup" ? "auth-tab auth-tab--active" : "auth-tab"}
            onClick={() => {
              setMode("signup");
              setMessage("");
            }}
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
              <div className="auth-field">
                <span>성별</span>
                <div className="auth-gender-toggle">
                  <UsersRound aria-hidden size={18} />
                  <button className={gender === "male" ? "auth-gender-toggle__item auth-gender-toggle__item--active" : "auth-gender-toggle__item"} onClick={() => setGender("male")} type="button">
                    남
                  </button>
                  <button className={gender === "female" ? "auth-gender-toggle__item auth-gender-toggle__item--active" : "auth-gender-toggle__item"} onClick={() => setGender("female")} type="button">
                    여
                  </button>
                </div>
              </div>

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

        {mode === "signup" ? (
          <label className="auth-field">
            <span>비밀번호</span>
            <div>
              <LockKeyhole aria-hidden size={18} />
              <input
                autoComplete="new-password"
                placeholder="6자 이상"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </label>
        ) : null}

        <label className="auth-field">
          <span>이메일</span>
          <div className={mode === "signup" ? "auth-field__control auth-field__control--with-action" : "auth-field__control"}>
            <Mail aria-hidden size={18} />
            <input
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {mode === "signup" ? (
              <button
                disabled={isSubmitting || isVerifying}
                onClick={() => {
                  if (verificationEmail && verificationEmail === email.trim()) {
                    void resendVerificationCode();
                    return;
                  }
                  void sendSignupVerificationCode();
                }}
                type="button"
              >
                {verificationEmail ? "다시 발송" : "코드 발송"}
              </button>
            ) : null}
          </div>
        </label>

        {verificationEmail ? (
          <div className="auth-verification-panel">
            <div>
              <strong>이메일 인증</strong>
              <span>{verificationEmail}</span>
            </div>
            <p>메일로 받은 {EMAIL_VERIFICATION_CODE_LENGTH}자리 코드를 3분 안에 입력해 주세요. 인증이 완료되면 회원가입이 승인됩니다.</p>
            <label className="auth-field">
              <span>인증 코드</span>
              <div>
                <Mail aria-hidden size={18} />
                <input
                  inputMode="numeric"
                  maxLength={EMAIL_VERIFICATION_CODE_LENGTH}
                  placeholder={"0".repeat(EMAIL_VERIFICATION_CODE_LENGTH)}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, EMAIL_VERIFICATION_CODE_LENGTH))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void verifyEmailCode();
                  }}
                />
              </div>
            </label>
            <div className="auth-verification-panel__footer">
              <span className={verificationSecondsLeft === 0 ? "auth-verification-panel__timer auth-verification-panel__timer--expired" : "auth-verification-panel__timer"}>
                {verificationSecondsLeft > 0 ? verificationTimeLabel : "만료됨"}
              </span>
              <button disabled={isSubmitting} onClick={resendVerificationCode} type="button">
                코드 다시 보내기
              </button>
              <button disabled={isVerifying || verificationSecondsLeft === 0} onClick={verifyEmailCode} type="button">
                {isVerifying ? "확인 중" : "인증하기"}
              </button>
            </div>
          </div>
        ) : null}

        {mode === "login" ? (
          <label className="auth-field">
            <span>비밀번호</span>
            <div>
              <LockKeyhole aria-hidden size={18} />
              <input
                autoComplete="current-password"
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
        ) : null}

        {message ? <p className="auth-message">{message}</p> : null}

        {mode === "login" ? (
          <button className="auth-submit" disabled={isSubmitting} onClick={submit} type="button">
            {isSubmitting ? <Loader2 aria-hidden size={18} /> : <ArrowRight aria-hidden size={18} />}
            로그인
          </button>
        ) : (
          <p className="auth-signup-note">기본 정보와 비밀번호를 입력한 뒤 이메일 옆의 코드 발송을 눌러 인증을 완료하세요.</p>
        )}
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
