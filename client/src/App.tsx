import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import HostDashboard from "./pages/HostDashboard";
import DrawRoom from "./pages/DrawRoom";
import RoomHistory from "./pages/RoomHistory";
import ViewerPage from "./pages/ViewerPage";
import ClaimRecords from "./pages/ClaimRecords";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/host"} component={HostDashboard} />
      <Route path={"/host/room/:roomId"} component={DrawRoom} />
      <Route path={"/host/room/:roomId/claims"} component={ClaimRecords} />
      <Route path={"/host/history"} component={RoomHistory} />
      <Route path={"/view"} component={ViewerPage} />
      <Route path={"/view/:code"} component={ViewerPage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
