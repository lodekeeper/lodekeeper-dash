import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { useDataStore } from "./stores/dataStore";
import { Layout } from "./components/Layout";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { LoginPage } from "./pages/LoginPage";
import { SetupPage } from "./pages/SetupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TasksPage } from "./pages/TasksPage";
import { TrackingPage } from "./pages/TrackingPage";
import { AgentsPage } from "./pages/AgentsPage";
import { JobsPage } from "./pages/JobsPage";
import { StreamPage } from "./pages/StreamPage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const setupRequired = useAuthStore((s) => s.setupRequired);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (setupRequired) return <Navigate to="/setup" />;
  if (!user) return <Navigate to="/login" />;

  return <>{children}</>;
}

export function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const initWs = useDataStore((s) => s.initWs);
  const user = useAuthStore((s) => s.user);

  useKeyboardShortcuts();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (user) {
      initWs();
    }
  }, [user, initWs]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tracking" element={<TrackingPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/stream" element={<StreamPage />} />
      </Route>
    </Routes>
  );
}
