import Link from "next/link";
import { LoginForm } from "@/components/forms/LoginForm";
import RegisterForm from "@/components/forms/RegisterForm";
import { Card } from "@/components/ui/card";
import { ToastProvider } from "@/components/ui/toast";
import { resolveRedirectPath } from "@/lib/utils/redirect";

type AuthPageProps = {
  searchParams?: {
    next?: string;
    mode?: string;
  };
};

const buildAuthHref = (mode: "login" | "signup", nextPath: string) => {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (nextPath !== "/dashboard") {
    params.set("next", nextPath);
  }
  return `/auth?${params.toString()}`;
};

export default function AuthPage({ searchParams }: AuthPageProps) {
  const mode = searchParams?.mode === "signup" ? "signup" : "login";
  const redirectPath = resolveRedirectPath(searchParams?.next, "/dashboard");
  const loginHref = buildAuthHref("login", redirectPath);
  const signupHref = buildAuthHref("signup", redirectPath);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-neutral-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-12 px-6 py-16 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">SiroundChat</p>
            <h1 className="text-4xl font-semibold">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-white/70">
              {mode === "signup"
                ? "Set up your workspace and start building."
                : "Sign in to continue where you left off."}
            </p>
            <div className="flex items-center gap-4 text-sm">
              <Link
                href={loginHref}
                className={mode === "login" ? "font-semibold text-white" : "text-white/60 hover:text-white"}
              >
                Login
              </Link>
              <Link
                href={signupHref}
                className={mode === "signup" ? "font-semibold text-white" : "text-white/60 hover:text-white"}
              >
                Sign up
              </Link>
            </div>
          </div>

          <Card className="flex-1 border-white/10 bg-white/5 p-6">
            {mode === "signup" ? <RegisterForm redirect={redirectPath} /> : <LoginForm redirect={redirectPath} />}
          </Card>
        </div>
      </div>
    </ToastProvider>
  );
}
