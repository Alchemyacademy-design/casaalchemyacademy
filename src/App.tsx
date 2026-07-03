import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/manus/components/ErrorBoundary";
import GlobalAccessController from "@/manus/components/GlobalAccessController";
import { ThemeProvider } from "@/manus/contexts/ThemeContext";
import { AuthProvider } from "@/manus/contexts/AuthContext";
import RouteFallback from "@/manus/components/RouteFallback";
import AdminGuard from "@/components/AdminGuard";
import { lazyWithRetry } from "@/manus/lib/lazyWithRetry";

// Eager: shell-critical landing & auth entry points so first paint stays sync.
import Home from "@/manus/pages/Home";
import Login from "@/manus/pages/Login";
import AuthCallback from "@/manus/pages/AuthCallback";
import PostAuthRedirect from "@/manus/pages/PostAuthRedirect";
import NotFound from "@/manus/pages/NotFound";

// Lazy: everything else, wrapped with a bounded one-shot reload on
// stale-chunk failures (typical after a fresh deploy).
const Modules = lazyWithRetry(() => import("@/manus/pages/Modules"), "Modules");
const ModuleDetail = lazyWithRetry(() => import("@/manus/pages/ModuleDetail"), "ModuleDetail");
const Community = lazyWithRetry(() => import("@/manus/pages/Community"), "Community");
const Suppliers = lazyWithRetry(() => import("@/manus/pages/Suppliers"), "Suppliers");
const Deals = lazyWithRetry(() => import("@/manus/pages/Deals"), "Deals");
const Dashboard = lazyWithRetry(() => import("@/manus/pages/Dashboard"), "Dashboard");
const Guides = lazyWithRetry(() => import("@/manus/pages/Guides"), "Guides");
const CourseDetail = lazyWithRetry(() => import("@/manus/pages/CourseDetail"), "CourseDetail");
const Events = lazyWithRetry(() => import("@/manus/pages/Events"), "Events");
const Magazine = lazyWithRetry(() => import("@/manus/pages/Magazine"), "Magazine");
const Profile = lazyWithRetry(() => import("@/manus/pages/Profile"), "Profile");
const LiveWorkshops = lazyWithRetry(() => import("@/manus/pages/LiveWorkshops"), "LiveWorkshops");
const Activate = lazyWithRetry(() => import("@/manus/pages/Activate"), "Activate");
const Signup = lazyWithRetry(() => import("@/manus/pages/Signup"), "Signup");
const ResetPassword = lazyWithRetry(() => import("@/manus/pages/ResetPassword"), "ResetPassword");
const UpdatePassword = lazyWithRetry(() => import("@/manus/pages/UpdatePassword"), "UpdatePassword");
const PaymentSuccess = lazyWithRetry(() => import("@/manus/pages/PaymentSuccess"), "PaymentSuccess");
const PaymentCancel = lazyWithRetry(() => import("@/manus/pages/PaymentCancel"), "PaymentCancel");
const Plans = lazyWithRetry(() => import("@/manus/pages/Plans"), "Plans");

const AdminPanel = lazyWithRetry(() => import("@/manus/pages/AdminPanel"), "AdminPanel");
const AdminAnalytics = lazyWithRetry(() => import("@/manus/pages/AdminAnalytics"), "AdminAnalytics");
const AdminUserDetail = lazyWithRetry(() => import("@/manus/pages/AdminUserDetail"), "AdminUserDetail");
const AdminCoursesList = lazyWithRetry(() => import("@/manus/pages/admin/AdminCoursesList"), "AdminCoursesList");
const AdminCourseDetail = lazyWithRetry(() => import("@/manus/pages/admin/AdminCourseDetail"), "AdminCourseDetail");
const AdminLessonsBulk = lazyWithRetry(() => import("@/manus/pages/admin/AdminLessonsBulk"), "AdminLessonsBulk");
const AdminStudents = lazyWithRetry(() => import("@/manus/pages/admin/AdminStudents"), "AdminStudents");
const AdminDiagnostics = lazyWithRetry(() => import("@/manus/pages/admin/AdminDiagnostics"), "AdminDiagnostics");
const AdminMagazine = lazyWithRetry(() => import("@/manus/pages/admin/AdminMagazine"), "AdminMagazine");
const SuppliersHub = lazyWithRetry(() => import("@/manus/pages/admin/SuppliersHub"), "SuppliersHub");
const AdminDeals = lazyWithRetry(() => import("@/manus/pages/admin/AdminDeals"), "AdminDeals");
const EventsHub = lazyWithRetry(() => import("@/manus/pages/admin/EventsHub"), "EventsHub");
const PeopleHub = lazyWithRetry(() => import("@/manus/pages/admin/PeopleHub"), "PeopleHub");
const CourseManagement = lazyWithRetry(() => import("@/manus/pages/admin/CourseManagement"), "CourseManagement");
const CourseBuilder = lazyWithRetry(() => import("@/manus/pages/admin/CourseBuilder"), "CourseBuilder");
const AdminLinkScanner = lazyWithRetry(() => import("@/manus/pages/admin/AdminLinkScanner"), "AdminLinkScanner");
const NotificationsInbox = lazyWithRetry(() => import("@/manus/pages/NotificationsInbox"), "NotificationsInbox");
const PublicCertificate = lazyWithRetry(() => import("@/manus/pages/PublicCertificate"), "PublicCertificate");


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
            <Route path="/c/:slug" element={<PublicCertificate />} />
            <Route path="/auth/continue" element={<PostAuthRedirect />} />
            <Route path="/mycourses" element={<Modules />} />
            <Route path="/mycourses/:id" element={<ModuleDetail />} />
            <Route path="/modules" element={<Navigate to="/mycourses" replace />} />
            <Route path="/modules/:id" element={<ModuleDetail />} />
            <Route path="/courses" element={<Guides />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/community" element={<Community />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/events" element={<Events />} />
            <Route path="/magazine" element={<Magazine />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<NotificationsInbox />} />
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
            <Route path="/admin/courses/new" element={<Navigate to="/admin/course-management?new=1" replace />} />
            <Route path="/admin/courses/:id" element={<AdminGuard><AdminCourseDetail /></AdminGuard>} />
            <Route path="/admin/content-import" element={<Navigate to="/admin/courses" replace />} />
            <Route path="/admin/import" element={<Navigate to="/admin/courses" replace />} />
            <Route path="/admin/lessons" element={<Navigate to="/admin/course-management?tab=bulk" replace />} />
            <Route path="/admin/students" element={<AdminGuard><PeopleHub /></AdminGuard>} />
            <Route path="/admin/plans" element={<Navigate to="/admin/students?tab=plans" replace />} />
            <Route path="/admin/diagnostics" element={<AdminGuard><AdminDiagnostics /></AdminGuard>} />
            <Route path="/admin/events" element={<AdminGuard><EventsHub /></AdminGuard>} />
            <Route path="/admin/workshops" element={<Navigate to="/admin/events?tab=workshops" replace />} />
            <Route path="/admin/magazine" element={<AdminGuard><AdminMagazine /></AdminGuard>} />
            <Route path="/admin/suppliers" element={<AdminGuard><SuppliersHub /></AdminGuard>} />
            <Route path="/admin/supplier-categories" element={<Navigate to="/admin/suppliers?tab=categories" replace />} />
            <Route path="/admin/deals" element={<AdminGuard><AdminDeals /></AdminGuard>} />
            <Route path="/admin/certificates" element={<Navigate to="/admin/course-management?tab=certificates" replace />} />
            <Route path="/admin/quizzes" element={<Navigate to="/admin/course-management?tab=quizzes" replace />} />
            <Route path="/admin/course-management" element={<AdminGuard><CourseManagement /></AdminGuard>} />
            <Route path="/admin/course-management/:id" element={<AdminGuard><CourseBuilder /></AdminGuard>} />
            <Route path="/admin/tools/link-scanner" element={<AdminGuard><AdminLinkScanner /></AdminGuard>} />
            <Route path="/admin/phase-2-preview" element={<Navigate to="/admin/courses" replace />} />

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
