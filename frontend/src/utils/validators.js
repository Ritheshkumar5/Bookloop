import { CATEGORIES, CONDITIONS, MAX_IMAGE_MB } from "./constants";

export function validateBook(values, { isEdit = false } = {}) {
  const errors = {};
  if (!values.title?.trim() || values.title.trim().length < 3) {
    errors.title = "Enter a title with at least 3 characters.";
  } else if (values.title.trim().length > 200) errors.title = "Title must be 200 characters or fewer.";
  if (values.author?.length > 150) errors.author = "Author must be 150 characters or fewer.";
  if (!CATEGORIES.includes(values.category)) errors.category = "Choose a category.";
  if (!values.subject?.trim()) errors.subject = "Subject is required.";
  if (!values.department?.trim()) errors.department = "Department is required.";
  if (!values.college_name?.trim()) errors.college_name = "College is required.";
  if (!values.city?.trim()) errors.city = "City is required.";
  if ((values.description || "").trim().length < 10) errors.description = "Description must be at least 10 characters.";
  if (!CONDITIONS.includes(values.condition)) errors.condition = "Choose the item's condition.";
  if (!Number.isFinite(Number(values.price)) || Number(values.price) <= 0) errors.price = "Enter a price greater than zero.";
  else if (!/^\d{1,8}(\.\d{1,2})?$/.test(String(values.price))) errors.price = "Use up to 8 whole digits and 2 decimals.";
  if (!isEdit && !values.image) errors.image = "Choose an image for your listing.";
  if (values.image) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(values.image.type)) errors.image = "Use a JPG, PNG or WEBP image.";
    else if (values.image.size > MAX_IMAGE_MB * 1024 * 1024) errors.image = `Image must be ${MAX_IMAGE_MB} MB or smaller.`;
  }
  return errors;
}

export function validateRegistration(values) {
  const errors = {};
  if (!values.full_name?.trim() || values.full_name.trim().length < 2) errors.full_name = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email || "")) errors.email = "Enter a valid email address.";
  if ((values.password || "").length < 8) errors.password = "Password must be at least 8 characters.";
  if (values.password !== values.confirm_password) errors.confirm_password = "Passwords do not match.";
  if (values.phone && !/^[6-9]\d{9}$/.test(values.phone)) errors.phone = "Enter a valid 10-digit Indian mobile number.";
  ["city", "college_name", "department"].forEach((field) => {
    if (!values[field]?.trim()) errors[field] = "This field is required.";
  });
  if (!["buyer", "seller"].includes(values.role)) errors.role = "Choose an account type.";
  return errors;
}
