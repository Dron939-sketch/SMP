import { Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import SharedTest from "./pages/SharedTest";
import TestList from "./pages/TestList";
import TestRunner from "./pages/TestRunner";
import type { User } from "./types";

// В демо-режиме фронт не требует логина — бэкенд при отсутствии
// токена сам подставляет синтетического замполита.
const DEMO_USER: User = {
  id: "00000000-0000-0000-0000-00000000beef",
  email: "demo@smp.team",
  full_name: "Демо Замполит",
  role: "political_officer",
  department: null,
  site: null,
  position: "Замполит",
  consent_given: true,
};

function Layout({ children }: { children: React.ReactNode }) {
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
          <div className="text-sm text-slate-300">
            {DEMO_USER.full_name}{" "}
            <span className="text-slate-500">· {DEMO_USER.role}</span>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/t/:token" element={<SharedTest />} />
      <Route
        path="/"
        element={
          <Layout>
            <Dashboard user={DEMO_USER} />
          </Layout>
        }
      />
      <Route
        path="/tests"
        element={
          <Layout>
            <TestList user={DEMO_USER} />
          </Layout>
        }
      />
      <Route
        path="/tests/:id"
        element={
          <Layout>
            <TestRunner />
          </Layout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
