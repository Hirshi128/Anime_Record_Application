export function registrationTitle(value: unknown) {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== "string") return "";
  const title = first.trim();
  return title.length <= 200 && !/[\u0000-\u001f\u007f]/.test(title) ? title : "";
}

export function animeRegistrationHref(title: string) {
  const initialTitle = registrationTitle(title);
  return initialTitle ? `/anime/new?${new URLSearchParams({ title: initialTitle })}` : "/anime/new";
}
