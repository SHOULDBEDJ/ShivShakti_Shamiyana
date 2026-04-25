import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Bookings from "./pages/Bookings.tsx";
import Inventory from "./pages/Inventory.tsx";
import Expenses from "./pages/Expenses.tsx";
import Vendors from "./pages/Vendors.tsx";
import Reports from "./pages/Reports.tsx";
import OrderLink from "./pages/OrderLink.tsx";
import PublicOrder from "./pages/PublicOrder.tsx";
import Settings from "./pages/Settings.tsx";
import Profile from "./pages/Profile.tsx";
import Income from "./pages/Income.tsx";
import Staff from "./pages/Staff.tsx";
import Gallery from "./pages/Gallery.tsx";
import AlbumView from "./pages/AlbumView.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Customer order page (only public route) */}
            <Route path="/order/:sessionId" element={<PublicOrder />} />

            {/* Auth disabled — redirect any /auth visits to dashboard */}
            <Route path="/auth" element={<Navigate to="/dashboard" replace />} />

            {/* Root → dashboard (ProtectedRoute redirects to /auth if logged out) */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Admin app — all modules visible to the single admin */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/order-link" element={<OrderLink />} />
              <Route path="/income" element={<Income />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/gallery/album/:id" element={<AlbumView />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
