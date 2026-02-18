import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Shield } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

export function SetupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setup = useAuthStore((s) => s.setup);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await setup(username, password);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0">
      <div className="w-full max-w-sm p-6 bg-surface-1 rounded-xl border border-surface-3">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Star className="w-6 h-6 text-accent" />
          <h1 className="text-xl font-semibold">Lodekeeper Setup</h1>
        </div>
        <p className="text-center text-sm text-gray-400 mb-6 flex items-center justify-center gap-1">
          <Shield className="w-3.5 h-3.5" />
          Create your admin account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm focus:outline-none focus:border-accent"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
