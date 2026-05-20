import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { auth, clearTokens } from "./api/client";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import SharedTest from "./pages/SharedTest";
import TestList from "./pages/TestList";
import TestRunner from "./pages/TestRunner";
import type { User } from "./types";

function Layout({ user, children }: { user: User; children: React.ReactNode }) {
  const nav = useNavigate();
  const onLogout = () => {
    clearTokens();
    nav("/login");
  };
  return (
    <div className="min-h-full">
      <header className="border-b border-white/5 bg-smp-panel/70 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-smp-accent grid place-items-center text-slate-900 font-bold">
              BP
            </div>
            <div>
              <div className="font-semibold leading-tight">BuildPulse</div>
              <div className="text-xs text-slate-400">СпецМонтажПроект</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-300">
              {user.full_name || user.email}{" "}
              <span className="text-slate-500">· {user.role}</span>
            </span>
            <button className="btn-ghost text-xs" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-screen grid place-items-center text-slate-400">
        Загрузка…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/t/:token" element={<SharedTest />} />
      <Route
        path="/login"
        element={
          user ? <Navigate to="/" replace /> : <Login onLogin={setUser} />
        }
      />
      <Route
        path="/"
        element={
          user ? (
            <Layout user={user}>
              <Dashboard user={user} />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/tests"
        element={
          user ? (
            <Layout user={user}>
              <TestList user={user} />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/tests/:id"
        element={
          user ? (
            <Layout user={user}>
              <TestRunner user={user} onUserUpdate={setUser} />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
