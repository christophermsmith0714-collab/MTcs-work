import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, Users, UserCircle, Bell, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Job } from "@shared/schema";
import { isPast } from "date-fns";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function TopNav() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: jobs } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => { logout(); queryClient.clear(); },
  });

  const overdueCount = jobs?.filter((j) => {
    if (!j.dueDate || ["Done","Sent to Client","Uploaded to Onehub"].includes(j.status)) return false;
    return isPast(new Date(j.dueDate));
  }).length ?? 0;

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/jobs", label: "Jobs", icon: Briefcase },
    { href: "/clients", label: "Clients", icon: Users },
    ...(user?.role === "admin" ? [{ href: "/team", label: "Team", icon: UserCircle }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex items-center h-14 px-5 gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-2">
          <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center icon-glow-teal">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" opacity="0.2" fill="currentColor"/>
              <path d="M12 22V12M12 12C12 7 17 4 17 4C17 4 17 9 12 12ZM12 12C12 7 7 4 7 4C7 4 7 9 12 12Z"/>
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-foreground">MTCS</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Job Tracker</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1 flex-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link key={href} href={href}>
                <a data-testid={`nav-${label.toLowerCase()}`} className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors relative",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}>
                  <Icon className="w-4 h-4" />
                  {label}
                  {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full -mb-[9px]" />}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Role badge */}
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide",
            user?.role === "admin"
              ? "bg-primary/15 text-primary border border-primary/25"
              : "bg-secondary text-muted-foreground border border-border"
          )}>
            {user?.role}
          </span>

          {/* Notification bell */}
          <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors" data-testid="button-notifications">
            <Bell className="w-4 h-4 text-muted-foreground" />
            {overdueCount > 0 && (
              <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center">
                {overdueCount}
              </span>
            )}
          </button>

          {/* User avatar + dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-background cursor-pointer hover:opacity-90 transition-opacity" style={{ background: user?.color ?? "#4F98A3" }} data-testid="button-user-menu">
                {user?.name?.[0]?.toUpperCase()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logoutMutation.mutate()} className="text-red-400 focus:text-red-400 cursor-pointer" data-testid="button-logout">
                <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
