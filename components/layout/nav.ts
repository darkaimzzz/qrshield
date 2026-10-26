import { BookOpen, FlaskConical, History, LayoutDashboard, Radar, type LucideIcon } from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "Scan History", icon: History },
  { href: "/intelligence", label: "Threat Intelligence", icon: Radar },
  { href: "/demo", label: "Demo Lab", icon: FlaskConical },
  { href: "/methodology", label: "Methodology", icon: BookOpen },
]
