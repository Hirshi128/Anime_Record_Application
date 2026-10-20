export function parseCredentials(form: FormData, signingUp = false) {
  const emailValue = form.get("email");
  const password = form.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "有効なメールアドレスを入力してください。" } as const;
  }
  if (typeof password !== "string" || password.length > 128 || password.length < (signingUp ? 12 : 1)) {
    return { error: signingUp ? "パスワードは12〜128文字で入力してください。" : "メールアドレスまたはパスワードが違います。" } as const;
  }
  if (signingUp && form.get("passwordConfirmation") !== password) {
    return { error: "確認用パスワードが一致しません。" } as const;
  }
  return { data: { email, password } } as const;
}

export function parsePasswordChange(form: FormData) {
  const currentPassword = form.get("currentPassword");
  const password = form.get("password");
  if (typeof currentPassword !== "string" || currentPassword.length < 1 || currentPassword.length > 128) {
    return { error: "現在のパスワードを入力してください。" } as const;
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return { error: "新しいパスワードは12〜128文字で入力してください。" } as const;
  }
  if (form.get("passwordConfirmation") !== password) return { error: "確認用パスワードが一致しません。" } as const;
  if (password === currentPassword) return { error: "現在と異なるパスワードを入力してください。" } as const;
  return { data: { currentPassword, password } } as const;
}
