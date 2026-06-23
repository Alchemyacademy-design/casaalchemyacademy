import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/manus/components/ErrorBoundary";
import GlobalAccessController from "@/manus/components/GlobalAccessController";
import { ThemeProvider } from "@/manus/contexts/ThemeContext";
import { AuthProvider } from "@/manus/contexts/AuthContext";
import RouteFallback from "@/manus/components/RouteFallback";
import AdminGuard from "@/components/AdminGuard";

// Eager: shell-critical landing & auth entry points so first paint stays sync.
import Home from "@/manus/pages/Home";
import Login from "@/manus/pages/Login";
import AuthCallback from "@/manus/pages/AuthCallback";
import PostAuthRedirect from "@/manus/pages/PostAuthRedirect";
import NotFound from "@/manus/pages/NotFound";

// Lazy: everything else (admin, learning, community, supplier, events, billing).
const Modules = lazy(() => import("@/manus/pages/Modules"));
const ModuleDetail = lazy(() => import("@/manus/pages/ModuleDetail"));
const Community = lazy(() => import("@/manus/pages/Community"));
const Suppliers = lazy(() => import("@/manus/pages/Suppliers"));
const Dashboard = lazy(() => import("@/manus/pages/Dashboard"));
const Guides = lazy(() => import("@/manus/pages/Guides"));
const CourseDetail = lazy(() => import("@/manus/pages/CourseDetail"));
const Events = lazy(() => import("@/manus/pages/Events"));
const Magazine = lazy(() => import("@/manus/pages/Magazine"));
const Profile = lazy(() => import("@/manus/pages/Profile"));
const LiveWorkshops = lazy(() => import("@/manus/pages/LiveWorkshops"));
const Activate = lazy(() => import("@/manus/pages/Activate"));
const Signup = lazy(() => import("@/manus/pages/Signup"));
const ResetPassword = lazy(() => import("@/manus/pages/ResetPassword"));
const UpdatePassword = lazy(() => import("@/manus/pages/UpdatePassword"));
const PaymentSuccess = lazy(() => import("@/manus/pages/PaymentSuccess"));
const PaymentCancel = lazy(() => import("@/manus/pages/PaymentCancel"));
const Plans = lazy(() => import("@/manus/pages/Plans"));

const AdminPanel = lazy(() => import("@/manus/pages/AdminPanel"));
const AdminAnalytics = lazy(() => import("@/manus/pages/AdminAnalytics"));
const AdminUserDetail = lazy(() => import("@/manus/pages/AdminUserDetail"));
const AdminCoursesList = lazy(() => import("@/manus/pages/admin/AdminCoursesList"));
const AdminCourseDetail = lazy(() => import("@/manus/pages/admin/AdminCourseDetail"));
const AdminLessonsBulk = lazy(() => import("@/manus/pages/admin/AdminLessonsBulk"));
const AdminStudents = lazy(() => import("@/manus/pages/admin/AdminStudents"));
const AdminDiagnostics = lazy(() => import("@/manus/pages/admin/AdminDiagnostics"));
const AdminEvents = lazy(() => import("@/manus/pages/admin/AdminEvents"));
const AdminWorkshops = lazy(() => import("@/manus/pages/admin/AdminWorkshops"));
const AdminMagazine = lazy(() => import("@/manus/pages/admin/AdminMagazine"));
const AdminSuppliers = lazy(() => import("@/manus/pages/admin/AdminSuppliers"));
const AdminSupplierCategories = lazy(() => import("@/manus/pages/admin/AdminSupplierCategories"));
const AdminDeals = lazy(() => import("@/manus/pages/admin/AdminDeals"));
const AdminPlans = lazy(() => import("@/manus/pages/admin/AdminPlans"));
const AdminCertificates = lazy(() => import("@/manus/pages/admin/AdminCertificates"));

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <GlobalAccessController />
          <Suspense fallback={<RouteFallback />}>
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
          </Suspense>
        </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
