import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";
import { useAuth } from "./hooks/useAuth";
import { LoginPage } from "./pages/auth/Login";
import { RegisterPage } from "./pages/auth/Register";
import { OfficerDashboard } from "./pages/officer/Dashboard";
import { ProjectCreatePage } from "./pages/officer/ProjectCreate";
import { ProjectImportPage } from "./pages/officer/ProjectImport";
import { ContractorDashboard } from "./pages/contractor/Dashboard";
import { ProjectInvestigationPage } from "./pages/project/ProjectInvestigationPage";

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "OFFICER") return <Navigate to="/officer" replace />;
  return <Navigate to="/contractor" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<HomeRedirect />} />

        <Route
          path="/officer"
          element={
            <ProtectedRoute roles={["OFFICER"]}>
              <OfficerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/officer/projects/new"
          element={
            <ProtectedRoute roles={["OFFICER"]}>
              <ProjectCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/officer/projects/import"
          element={
            <ProtectedRoute roles={["OFFICER"]}>
              <ProjectImportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/officer/projects/:id"
          element={
            <ProtectedRoute roles={["OFFICER"]}>
              <ProjectInvestigationPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/contractor"
          element={
            <ProtectedRoute roles={["CONTRACTOR"]}>
              <ContractorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contractor/projects/:id"
          element={
            <ProtectedRoute roles={["CONTRACTOR"]}>
              <ProjectInvestigationPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
