// Public configuration. Only publishable values live here; there is no service-role key anywhere.
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseKey() {
    return required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  },
  get tenantSlug() {
    return required("NEXT_PUBLIC_TENANT_SLUG", process.env.NEXT_PUBLIC_TENANT_SLUG);
  },
  get customerUrl() {
    return required("NEXT_PUBLIC_CUSTOMER_URL", process.env.NEXT_PUBLIC_CUSTOMER_URL).replace(/\/$/, "");
  },
};

export type AppName = "customer" | "driver" | "ops";
