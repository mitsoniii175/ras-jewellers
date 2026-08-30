// Validation rules shared by the account forms and the API routes.
// The client uses these for instant feedback; the server re-runs every one of
// them, because client-side validation is a convenience, not a control.

export type FieldError = { field: string; message: string };

const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export const STATES = INDIAN_STATES;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateName(value: string): string | null {
  const name = value.trim();
  if (name.length < 2) return "Please enter your full name.";
  if (name.length > 60) return "Name is too long.";
  if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(name))
    return "Name can only contain letters, spaces, apostrophes and hyphens.";
  return null;
}

export function validatePhone(value: string): string | null {
  const digits = digitsOnly(value);
  if (digits.length !== 10) return "Enter a 10-digit mobile number.";
  if (!/^[6-9]/.test(digits)) return "Indian mobile numbers start with 6, 7, 8 or 9.";
  return null;
}

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Please enter your email address.";
  if (email.length > 254) return "Email address is too long.";
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (value.length > 128) return "Password is too long.";
  if (!/[a-zA-Z]/.test(value)) return "Include at least one letter.";
  if (!/\d/.test(value)) return "Include at least one number.";
  return null;
}

export function passwordStrength(value: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!value) return { score: 0, label: "" };
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)) score++;
  if (/[^a-zA-Z0-9]/.test(value)) score++;
  const clamped = Math.min(3, score) as 0 | 1 | 2 | 3;
  return { score: clamped, label: ["Too short", "Fair", "Good", "Strong"][clamped] };
}

export function validatePincode(value: string): string | null {
  const digits = digitsOnly(value);
  if (digits.length !== 6) return "Enter a 6-digit PIN code.";
  if (digits.startsWith("0")) return "PIN codes don't start with 0.";
  return null;
}

export type AddressInput = {
  fullName: string;
  phone: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
};

export function validateAddress(input: AddressInput): FieldError[] {
  const errors: FieldError[] = [];
  const push = (field: string, message: string | null) => {
    if (message) errors.push({ field, message });
  };

  push("fullName", validateName(input.fullName));
  push("phone", validatePhone(input.phone));
  push("street", input.street.trim().length < 4 ? "Enter your house / flat / street." : null);
  push("area", input.area.trim().length < 2 ? "Enter your area or locality." : null);
  push("city", input.city.trim().length < 2 ? "Enter your city." : null);
  push("state", input.state.trim().length < 2 ? "Select your state." : null);
  push("pincode", validatePincode(input.pincode));

  return errors;
}
