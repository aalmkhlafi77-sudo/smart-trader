import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import LegacyUiLocalizer from "./components/LegacyUiLocalizer";
import AccessGate from "./components/AccessGate";
import FloatingCalculator from "./components/FloatingCalculator";
import { AccessProvider } from "./contexts/AccessContext";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { LoginBackgroundProvider } from "./contexts/LoginBackgroundContext";
import { WorkspacePreferencesProvider } from "./contexts/WorkspacePreferencesContext";
import { ActivityThemeProvider } from "./contexts/ActivityThemeContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Entities from "./pages/Entities";
import Items from "./pages/Items";
import Prices from "./pages/Prices";
import Pricing from "./pages/Pricing";
import ExportLists from "./pages/ExportLists";
import Backup from "./pages/Backup";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import FollowUp from "./pages/FollowUp";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/entities" component={Entities} />
      <Route path="/items" component={Items} />
      <Route path="/prices" component={Prices} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/reports" component={Reports} />
      <Route path="/follow-up" component={FollowUp} />
      <Route path="/export" component={ExportLists} />
      <Route path="/backup" component={Backup} />
      <Route path="/settings" component={Settings} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function LocalizedRoutes() {
  const { language } = useLanguage();
  return (
    <>
      <LegacyUiLocalizer key={language} />
      <Router />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <LanguageProvider>
          <ActivityThemeProvider>
            <WorkspacePreferencesProvider>
              <LoginBackgroundProvider>
                <AccessProvider>
                  <TooltipProvider>
                    <Toaster />
                    <AccessGate>
                      <LocalizedRoutes />
                      <FloatingCalculator />
                    </AccessGate>
                  </TooltipProvider>
                </AccessProvider>
              </LoginBackgroundProvider>
            </WorkspacePreferencesProvider>
          </ActivityThemeProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
