import { ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input, Label } from "../../components/ui/Input";
import { useAuth } from "../../hooks/useAuth";

const HOME_BY_ROLE: Record<string, string> = {
  OFFICER: "/officer",
  CONTRACTOR: "/contractor",
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("officer@mplad.local");
  const [password, setPassword] = useState("Demo@123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(HOME_BY_ROLE[user.role] ?? "/");
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-primary px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-50 p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-surface-50 shadow-md">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-primary-900">MPLAD SENTINEL</h1>
          <p className="text-sm text-primary-500">Intelligent Vigilance for Every Project</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-5 rounded-lg bg-primary-50 p-3 text-xs text-primary-600">
          <p className="mb-1 font-semibold">Demo credentials (password: Demo@123):</p>
          <p>Officer: officer@mplad.local</p>
          <p>Contractor: contractor@mplad.local</p>
        </div>

        <p className="mt-4 text-center text-sm text-primary-500">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-medium text-primary-700 underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
