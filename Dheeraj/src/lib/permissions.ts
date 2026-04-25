export type ModuleKey =
  | "dashboard"
  | "bookings"
  | "inventory"
  | "income"
  | "expenses"
  | "staff"
  | "vendors"
  | "reports"
  | "orderLink"
  | "gallery"
  | "profile"
  | "settings";

export const ALL_MODULES: { key: ModuleKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "bookings", label: "Bookings" },
  { key: "inventory", label: "Inventory" },
  { key: "income", label: "Income" },
  { key: "expenses", label: "Expenses" },
  { key: "staff", label: "Staff" },
  { key: "vendors", label: "Vendors" },
  { key: "reports", label: "Reports" },
  { key: "orderLink", label: "Order Link" },
  { key: "gallery", label: "Gallery" },
  { key: "profile", label: "Profile" },
  { key: "settings", label: "Settings" },
];

// New admin login (shown to user) → mapped internally to a real email.
export const ADMIN_LOGIN_ID = "admin123";
export const ADMIN_PASSWORD = "admin123";
export const ADMIN_EMAIL = "admin@shamiyana.local";
