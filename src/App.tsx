import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/manus/components/ErrorBoundary";
import GlobalAccessController from "@/manus/components/GlobalAccessController";
import { ThemeProvider } from "@/manus/contexts/ThemeContext";
import { AuthProvider } from "@/manus/contexts/AuthContext";
import Home from "@/manus/pages/Home";
import Modules from "@/manus/pages/Modules";
import ModuleDetail from "@/manus/pages/ModuleDetail";
import Community from "@/manus/pages/Community";
import Suppliers from "@/manus/pages/Suppliers";
import Dashboard from "@/manus/pages/Dashboard";
import Guides from "@/manus/pages/Guides";
import CourseDetail from "@/manus/pages/CourseDetail";
import Events from "@/manus/pages/Events";
import Magazine from "@/manus/pages/Magazine";
import Profile from "@/manus/pages/Profile";
import LiveWorkshops from "@/manus/pages/LiveWorkshops";
import Activate from "@/manus/pages/Activate";
import Login from "@/manus/pages/Login";
import Signup from "@/manus/pages/Signup";
import ResetPassword from "@/manus/pages/ResetPassword";
import AuthCallback from "@/manus/pages/AuthCallback";
import UpdatePassword from "@/manus/pages/UpdatePassword";
import AdminPanel from "@/manus/pages/AdminPanel";
import AdminAnalytics from "@/manus/pages/AdminAnalytics";
import AdminUserDetail from "@/manus/pages/AdminUserDetail";
import PaymentSuccess from "@/manus/pages/PaymentSuccess";
import PaymentCancel from "@/manus/pages/PaymentCancel";
import Plans from "@/manus/pages/Plans";
import PostAuthRedirect from "@/manus/pages/PostAuthRedirect";
import NotFound from "@/manus/pages/NotFound";
import AdminGuard from "@/components/AdminGuard";
import AdminCoursesList from "@/manus/pages/admin/AdminCoursesList";
import AdminCourseDetail from "@/manus/pages/admin/AdminCourseDetail";

import AdminLessonsBulk from "@/manus/pages/admin/AdminLessonsBulk";
import AdminStudents from "@/manus/pages/admin/AdminStudents";
import AdminDiagnostics from "@/manus/pages/admin/AdminDiagnostics";
import AdminEvents from "@/manus/pages/admin/AdminEvents";
import AdminWorkshops from "@/manus/pages/admin/AdminWorkshops";
import AdminMagazine from "@/manus/pages/admin/AdminMagazine";
import AdminSuppliers from "@/manus/pages/admin/AdminSuppliers";
import AdminSupplierCategories from "@/manus/pages/admin/AdminSupplierCategories";
import AdminDeals from "@/manus/pages/admin/AdminDeals";
import AdminPlans from "@/manus/pages/admin/AdminPlans";
import AdminCertificates from "@/manus/pages/admin/AdminCertificates";


export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <GlobalAccessController />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/auth/continue" element={<PostAuthRedirect />} />
            <Route path="/mycourses" element={<Modules />} />
            <Route path="/mycourses/:id" element={<ModuleDetail />} />
            <Route path="/modules" element={<Navigate to="/mycourses" replace />} />
            <Route path="/modules/:id" element={<ModuleDetail />} />
            <Route path="/courses" element={<Guides />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/community" element={<Community />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/events" element={<Events />} />
            <Route path="/magazine" element={<Magazine />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/live-workshops" element={<LiveWorkshops />} />
            <Route path="/activate" element={<Activate />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/forgot-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/update-password" element={<UpdatePassword />} />
            <Route path="/admin" element={<AdminGuard><AdminPanel /></AdminGuard>} />
            <Route path="/admin/users/:id" element={<AdminGuard><AdminUserDetail /></AdminGuard>} />
            <Route path="/admin/analytics" element={<AdminGuard><AdminAnalytics /></AdminGuard>} />
            <Route path="/admin/courses" element={<AdminGuard><AdminCoursesList /></AdminGuard>} />
            <Route path="/admin/courses/new" element={<AdminGuard><AdminCourseDetail /></AdminGuard>} />
            <Route path="/admin/courses/:id" element={<AdminGuard><AdminCourseDetail /></AdminGuard>} />
            <Route path="/admin/content-import" element={<Navigate to="/admin/courses" replace />} />
            <Route path="/admin/import" element={<Navigate to="/admin/courses" replace />} />
            <Route path="/admin/lessons" element={<AdminGuard><AdminLessonsBulk /></AdminGuard>} />
            <Route path="/admin/students" element={<AdminGuard><AdminStudents /></AdminGuard>} />
            <Route path="/admin/diagnostics" element={<AdminGuard><AdminDiagnostics /></AdminGuard>} />
            <Route path="/admin/events" element={<AdminGuard><AdminEvents /></AdminGuard>} />
            <Route path="/admin/workshops" element={<AdminGuard><AdminWorkshops /></AdminGuard>} />
            <Route path="/admin/magazine" element={<AdminGuard><AdminMagazine /></AdminGuard>} />
            <Route path="/admin/suppliers" element={<AdminGuard><AdminSuppliers /></AdminGuard>} />
            <Route path="/admin/supplier-categories" element={<AdminGuard><AdminSupplierCategories /></AdminGuard>} />
            <Route path="/admin/deals" element={<AdminGuard><AdminDeals /></AdminGuard>} />
            <Route path="/admin/plans" element={<AdminGuard><AdminPlans /></AdminGuard>} />
            <Route path="/admin/certificates" element={<AdminGuard><AdminCertificates /></AdminGuard>} />

            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
