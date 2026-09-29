import {
  BarChart3, Briefcase, Building2, CalendarClock, ClipboardCheck, ClipboardList, FileText, GraduationCap,
  LayoutDashboard, MessageSquare, ScrollText, ShieldCheck, Star, User, Users,
} from 'lucide-react';

/** Sidebar entries per role. */
export const NAVIGATION = {
  STUDENT: [
    { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/student/internships', label: 'Internships', icon: Briefcase },
    { to: '/student/applications', label: 'My Applications', icon: FileText },
    { to: '/student/interviews', label: 'Interviews', icon: CalendarClock },
    { to: '/student/feedback', label: 'Feedback', icon: MessageSquare },
    { to: '/student/reports', label: 'Reports', icon: BarChart3 },
    { to: '/student/profile', label: 'Profile & Resume', icon: User },
  ],
  FACULTY: [
    { to: '/faculty/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/faculty/internships', label: 'My Internships', icon: Briefcase },
    { to: '/faculty/applications', label: 'Applications', icon: FileText },
    { to: '/faculty/interviews', label: 'Interviews', icon: CalendarClock },
    { to: '/faculty/evaluations', label: 'Evaluations', icon: Star },
    { to: '/faculty/feedback', label: 'Feedback', icon: MessageSquare },
    { to: '/faculty/reports', label: 'Reports', icon: BarChart3 },
    { to: '/faculty/profile', label: 'Profile', icon: User },
  ],
  ADMIN: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/internships/approvals', label: 'Approvals', icon: ClipboardCheck },
    { to: '/admin/students', label: 'Students', icon: GraduationCap },
    { to: '/admin/faculty', label: 'Faculty', icon: Users },
    { to: '/admin/companies', label: 'Companies', icon: Building2 },
    { to: '/admin/internships', label: 'Internships', icon: Briefcase, end: true },
    { to: '/admin/applications', label: 'Applications', icon: FileText },
    { to: '/admin/interviews', label: 'Interviews', icon: CalendarClock },
    { to: '/admin/evaluations', label: 'Evaluations', icon: Star },
    { to: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
    { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
    { to: '/admin/audit-log', label: 'Audit Log', icon: ScrollText },
    { to: '/admin/account', label: 'Account', icon: ShieldCheck },
  ],
};

export const BRAND_ICON = ClipboardList;
