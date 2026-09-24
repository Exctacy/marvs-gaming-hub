"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Monitor, Shield } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Login failed");
        return;
      }
      toast.success("Welcome back!");
      if (data.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-800 to-blue-600">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur">
                <Gamepad2 className="h-8 w-8" />
              </div>
              <span className="text-2xl font-bold tracking-tight">MARVS Gaming Hub</span>
            </div>
            <p className="text-blue-200 text-sm mt-1">Staff Operations Portal</p>
          </div>
          <div className="space-y-8">
            <h1 className="text-4xl font-bold leading-tight">
              Manage every shift.<br />
              Track every PC.<br />
              <span className="text-blue-300">Keep the hub running.</span>
            </h1>
            <div className="grid grid-cols-1 gap-4 max-w-md">
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4 backdrop-blur border border-white/10">
                <Monitor className="h-5 w-5 text-blue-300 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Shift Reporting</p>
                  <p className="text-sm text-blue-200/80">Opening, Mid & Night checklists with signatures</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4 backdrop-blur border border-white/10">
                <Shield className="h-5 w-5 text-blue-300 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Multi-Branch Oversight</p>
                  <p className="text-sm text-blue-200/80">Role-based access with full audit trail</p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-blue-300/60 text-sm">© {new Date().getFullYear()} MARVS Gaming Hub. Operations only.</p>
        </div>
      </div>

      {/* Right login card */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 bg-slate-50">
        <Card className="w-full max-w-md border-0 shadow-xl shadow-navy-900/5">
          <CardHeader className="space-y-1 pb-6">
            <div className="lg:hidden flex items-center gap-2 mb-4">
              <Gamepad2 className="h-7 w-7 text-navy-700" />
              <span className="text-xl font-bold text-navy-900">MARVS Gaming Hub</span>
            </div>
            <CardTitle className="text-2xl font-bold text-navy-900">Staff Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the operations portal</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="your.username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  autoFocus
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>
              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              First login requires password change. Contact your admin if locked out.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
