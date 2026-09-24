"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function ForcedChangePasswordPage() {
  const router = useRouter();
  const [mustChange, setMustChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) router.push("/login");
        return r.json();
      })
      .then((d) => {
        setMustChange(!!d.mustChangePassword);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: mustChange ? undefined : currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed");
        return;
      }
      toast.success(mustChange ? "Password set successfully." : "Password updated successfully.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-800 to-blue-600 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle>{mustChange ? "Set Your Password" : "Change Password"}</CardTitle>
          <CardDescription>
            {mustChange
              ? "You must set a new password before continuing."
              : "Update your account password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!mustChange && (
              <div className="space-y-2">
                <Label htmlFor="current">Current Password</Label>
                <Input
                  id="current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new">New Password</Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm New Password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating…" : mustChange ? "Set Password & Continue" : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
