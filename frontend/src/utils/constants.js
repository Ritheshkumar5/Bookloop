export const CATEGORIES = [
  "Textbook",
  "Handwritten Notes",
  "Solved Question Papers",
  "Lab Manual",
  "Reference Book",
  "Other",
];

export const CONDITIONS = ["New", "Like New", "Good", "Acceptable"];
export const DELIVERY_METHODS = [
  { value: "meet", label: "Meet in person" },
  { value: "courier", label: "Courier" },
];
export const SORT_OPTIONS = [
  { value: "-created_at", label: "Newest first" },
  { value: "price", label: "Price: Low to High" },
  { value: "-price", label: "Price: High to Low" },
];
export const PAGE_SIZE = 12;
export const MAX_IMAGE_MB = 2;
export const TOKEN_KEY = "bookloop_access";
export const REFRESH_KEY = "bookloop_refresh";
export const USER_KEY = "bookloop_user";
export const ADMIN_TOKEN_KEY = "bookloop_admin_access";
