import { Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Portraits from "./pages/Portraits";
import Reports from "./pages/Reports";
import SharedTest from "./pages/SharedTest";
import TestList from "./pages/TestList";
import TestRunner from "./pages/TestRunner";
import Usage from "./pages/Usage";
import type { User } from "./types";

// Боевой режим без формы логина: бэкенд при отсутствии токена
// сам подставляет учётку замполита (Зорин Илья).
const CURRENT_USER: User = {
  id: "00000000-0000-0000-0000-00000000beef",
  email: "zorin@smp.team",
  full_name: "Зорин Илья",
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
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center">
          <div className="font-semibold leading-tight text-lg sm:text-xl">
            СпецМонтажПроект
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
            <Dashboard user={CURRENT_USER} />
          </Layout>
        }
      />
      <Route
        path="/tests"
        element={
          <Layout>
            <TestList user={CURRENT_USER} />
          </Layout>
        }
      />
      <Route
        path="/portraits"
        element={
          <Layout>
            <Portraits />
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
      <Route
        path="/reports"
        element={
          <Layout>
            <Reports />
          </Layout>
        }
      />
      <Route
        path="/usage"
        element={
          <Layout>
            <Usage />
          </Layout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
