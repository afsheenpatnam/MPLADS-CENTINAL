import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input, Label, Select } from "../../components/ui/Input";
import { useAuth } from "../../hooks/useAuth";

const HOME_BY_ROLE: Record<string, string> = {
  OFFICER: "/officer",
  CONTRACTOR: "/contractor",
};

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "OFFICER", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await register(form);
      navigate(HOME_BY_ROLE[user.role] ?? "/");
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-primary px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-surface-50 p-8 shadow-2xl">
        <h1 className="mb-1 text-xl font-bold text-primary-900">Create an account</h1>
        <p className="mb-6 text-sm text-primary-500">Register as an officer or contractor.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select id="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="OFFICER">Officer</option>
              <option value="CONTRACTOR">Contractor</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-primary-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary-700 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
