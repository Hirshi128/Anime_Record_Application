export function usesCredentialAuth() {
  if (process.env.VERCEL === "1") return true;
  if (process.env.AUTH_MODE === "credentials") return true;
  if (process.env.AUTH_MODE === "demo") return false;
  return process.env.NODE_ENV === "production";
}

export function requireDemoMode() {
  if (usesCredentialAuth()) throw new Error("メールアドレスとパスワードでログインしてください。");
}
