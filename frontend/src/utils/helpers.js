export function getErrorMessage(error, fallback = "Something went wrong.") {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const first = Object.values(data).flat().find((item) => typeof item === "string");
    if (first) return first;
  }
  return error?.message || fallback;
}

export function getFieldErrors(error) {
  const data = error?.response?.data;
  if (!data || typeof data !== "object") return {};
  return Object.fromEntries(
    Object.entries(data).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages.join(" ") : String(messages),
    ])
  );
}

export function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );
}

export function formatPrice(price) {
  return `₹${Number(price || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
