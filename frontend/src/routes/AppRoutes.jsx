import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute, { PublicOnlyRoute } from './ProtectedRoute';
import DashboardLayout from '../layouts/DashboardLayout';
import { PageLoader } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../utils/constants';

// Pages are code-split so each role downloads only what it uses.
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'));
const VerifyEmailPage = lazy(() => import('../pages/auth/VerifyEmailPage'));
const NotFoundPage = lazy(() => import('../pages/auth/NotFoundPage'));

const InternshipDetailPage = lazy(() => import('../pages/shared/InternshipDetailPage'));
const InternshipFormPage = lazy(() => import('../pages/shared/InternshipFormPage'));
const InternshipsManagePage = lazy(() => import('../pages/shared/InternshipsManagePage'));
const ApplicationsPage = lazy(() => import('../pages/shared/ApplicationsPage'));
const ApplicationDetailPage = lazy(() => import('../pages/shared/ApplicationDetailPage'));
const InterviewsPage = lazy(() => import('../pages/shared/InterviewsPage'));
const EvaluationsPage = lazy(() => import('../pages/shared/EvaluationsPage'));
const CompanyDetailPage = lazy(() => import('../pages/shared/CompanyDetailPage'));

const StudentDashboard = lazy(() => import('../pages/student/StudentDashboard'));
const StudentProfilePage = lazy(() => import('../pages/student/StudentProfilePage'));
const BrowseInternshipsPage = lazy(() => import('../pages/student/BrowseInternshipsPage'));
const ApplyPage = lazy(() => import('../pages/student/ApplyPage'));
const StudentFeedbackPage = lazy(() => import('../pages/student/StudentFeedbackPage'));
const StudentReportsPage = lazy(() => import('../pages/student/StudentReportsPage'));

const FacultyDashboard = lazy(() => import('../pages/faculty/FacultyDashboard'));
const FacultyProfilePage = lazy(() => import('../pages/faculty/FacultyProfilePage'));
const FacultyFeedbackPage = lazy(() => import('../pages/faculty/FacultyFeedbackPage'));
const FacultyReportsPage = lazy(() => import('../pages/faculty/FacultyReportsPage'));

const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminStudentsPage = lazy(() => import('../pages/admin/AdminStudentsPage'));
const AdminFacultyPage = lazy(() => import('../pages/admin/AdminFacultyPage'));
const AdminCompaniesPage = lazy(() => import('../pages/admin/AdminCompaniesPage'));
const AdminFeedbackPage = lazy(() => import('../pages/admin/AdminFeedbackPage'));
const AdminReportsPage = lazy(() => import('../pages/admin/AdminReportsPage'));
const AdminAccountPage = lazy(() => import('../pages/admin/AdminAccountPage'));
const AuditLogPage = lazy(() => import('../pages/admin/AuditLogPage'));

function HomeRedirect() {
  const { user, initializing } = useAuth();
  if (initializing) return <PageLoader />;
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route element={<ProtectedRoute roles={['STUDENT']} />}>
          <Route path="/student" element={<DashboardLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="profile" element={<StudentProfilePage />} />
            <Route path="internships" element={<BrowseInternshipsPage />} />
            <Route path="internships/:id" element={<InternshipDetailPage />} />
            <Route path="internships/:id/apply" element={<ApplyPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="applications/:id" element={<ApplicationDetailPage />} />
            <Route path="interviews" element={<InterviewsPage />} />
            <Route path="feedback" element={<StudentFeedbackPage />} />
            <Route path="reports" element={<StudentReportsPage />} />
            <Route path="companies/:id" element={<CompanyDetailPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['FACULTY']} />}>
          <Route path="/faculty" element={<DashboardLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<FacultyDashboard />} />
            <Route path="profile" element={<FacultyProfilePage />} />
            <Route path="internships" element={<InternshipsManagePage />} />
            <Route path="internships/new" element={<InternshipFormPage />} />
            <Route path="internships/:id" element={<InternshipDetailPage />} />
            <Route path="internships/:id/edit" element={<InternshipFormPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="applications/:id" element={<ApplicationDetailPage />} />
            <Route path="interviews" element={<InterviewsPage />} />
            <Route path="evaluations" element={<EvaluationsPage />} />
            <Route path="feedback" element={<FacultyFeedbackPage />} />
            <Route path="reports" element={<FacultyReportsPage />} />
            <Route path="companies/:id" element={<CompanyDetailPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="students" element={<AdminStudentsPage />} />
            <Route path="faculty" element={<AdminFacultyPage />} />
            <Route path="companies" element={<AdminCompaniesPage />} />
            <Route path="companies/:id" element={<CompanyDetailPage />} />
            <Route path="internships" element={<InternshipsManagePage />} />
            <Route path="internships/approvals" element={<InternshipsManagePage approvals key="approvals" />} />
            <Route path="internships/new" element={<InternshipFormPage />} />
            <Route path="internships/:id" element={<InternshipDetailPage />} />
            <Route path="internships/:id/edit" element={<InternshipFormPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="applications/:id" element={<ApplicationDetailPage />} />
            <Route path="interviews" element={<InterviewsPage />} />
            <Route path="evaluations" element={<EvaluationsPage />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="account" element={<AdminAccountPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
