import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/manus/components/ErrorBoundary";
import GlobalAccessController from "@/manus/components/GlobalAccessController";
import { ThemeProvider } from "@/manus/contexts/ThemeContext";
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
import PaymentSuccess from "@/manus/pages/PaymentSuccess";
import PaymentCancel from "@/manus/pages/PaymentCancel";
import Plans from "@/manus/pages/Plans";
import PostAuthRedirect from "@/manus/pages/PostAuthRedirect";
import NotFound from "@/manus/pages/NotFound";

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
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
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
