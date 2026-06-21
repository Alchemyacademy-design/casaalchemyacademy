import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RouteGuard } from "@/components/RouteGuard";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Plans from "./pages/Plans";
import MyCourses from "./pages/MyCourses";
import Course from "./pages/Course";
import Lesson from "./pages/Lesson";
import Community from "./pages/Community";
import Events from "./pages/Events";
import Magazine from "./pages/Magazine";
import Suppliers from "./pages/Suppliers";
import Profile from "./pages/Profile";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route path="/plans" element={<RouteGuard requireAuth><Plans /></RouteGuard>} />
            <Route path="/dashboard" element={<RouteGuard requireAuth requireMembership><Dashboard /></RouteGuard>} />
            <Route path="/mycourses" element={<RouteGuard requireAuth requireEntitlement><MyCourses /></RouteGuard>} />
            <Route path="/course/:id" element={<RouteGuard requireAuth requireEntitlement><Course /></RouteGuard>} />
            <Route path="/course/:id/lesson/:lessonId" element={<RouteGuard requireAuth requireEntitlement><Lesson /></RouteGuard>} />
            <Route path="/community" element={<RouteGuard requireAuth><Community /></RouteGuard>} />
            <Route path="/events" element={<RouteGuard requireAuth><Events /></RouteGuard>} />
            <Route path="/magazine" element={<RouteGuard requireAuth><Magazine /></RouteGuard>} />
            <Route path="/suppliers" element={<RouteGuard requireAuth><Suppliers /></RouteGuard>} />
            <Route path="/profile" element={<RouteGuard requireAuth><Profile /></RouteGuard>} />

            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
