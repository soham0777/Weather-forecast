/* Labels and badge colours for every controlled status value used by the API. */

export const ROLES = { ADMIN: 'ADMIN', FACULTY: 'FACULTY', STUDENT: 'STUDENT' };

export const ROLE_HOME = {
  ADMIN: '/admin/dashboard',
  FACULTY: '/faculty/dashboard',
  STUDENT: '/student/dashboard',
};

export const ROLE_LABEL = { ADMIN: 'Administrator', FACULTY: 'Faculty', STUDENT: 'Student' };

/** tone → Tailwind classes for badges */
export const TONES = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-600/15',
  blue: 'bg-blue-50 text-blue-800 ring-blue-700/20',
  indigo: 'bg-indigo-50 text-indigo-800 ring-indigo-700/20',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-700/20',
  amber: 'bg-amber-50 text-amber-900 ring-amber-700/25',
  red: 'bg-rose-50 text-rose-800 ring-rose-700/20',
  violet: 'bg-violet-50 text-violet-800 ring-violet-700/20',
};

export const STATUS_META = {
  // internships
  PENDING: { label: 'Pending', tone: 'amber' },
  APPROVED: { label: 'Approved', tone: 'blue' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  OPEN: { label: 'Open', tone: 'green' },
  CLOSED: { label: 'Closed', tone: 'gray' },
  ARCHIVED: { label: 'Archived', tone: 'gray' },
  // applications
  SHORTLISTED: { label: 'Shortlisted', tone: 'indigo' },
  ACCEPTED: { label: 'Accepted', tone: 'green' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'gray' },
  // interviews
  SCHEDULED: { label: 'Scheduled', tone: 'blue' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'gray' },
  SELECTED: { label: 'Selected', tone: 'green' },
  NOT_SELECTED: { label: 'Not selected', tone: 'red' },
  ON_HOLD: { label: 'On hold', tone: 'amber' },
  // companies
  ACTIVE: { label: 'Active', tone: 'green' },
  // system feedback
  UNDER_REVIEW: { label: 'Under review', tone: 'blue' },
  IN_PROGRESS: { label: 'In progress', tone: 'indigo' },
  RESOLVED: { label: 'Resolved', tone: 'green' },
  // placement
  PLACED: { label: 'Placed', tone: 'green' },
  NOT_PLACED: { label: 'Not placed yet', tone: 'gray' },
};

export const INTERNSHIP_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'OPEN', 'CLOSED', 'ARCHIVED'];
export const APPLICATION_STATUSES = ['PENDING', 'SHORTLISTED', 'REJECTED', 'ACCEPTED', 'WITHDRAWN'];
export const INTERVIEW_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];
export const INTERVIEW_RESULTS = ['SELECTED', 'NOT_SELECTED', 'ON_HOLD'];
export const SYSTEM_FEEDBACK_TYPES = {
  FEATURE_SUGGESTION: 'Feature suggestion',
  BUG_REPORT: 'Bug report',
  PLATFORM_IMPROVEMENT: 'Platform improvement',
};
export const SYSTEM_FEEDBACK_STATUSES = ['OPEN', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

/** Suggestions only — departments are free text in the database. */
export const DEPARTMENT_SUGGESTIONS = [
  'Computer Engineering',
  'Information Technology',
  'Artificial Intelligence and Data Science',
  'Electronics and Telecommunication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'MBA',
  'MCA',
];

export const DOMAIN_SUGGESTIONS = [
  'Web Development',
  'Mobile Development',
  'Data Science',
  'Artificial Intelligence',
  'Cloud Computing',
  'Cyber Security',
  'Embedded Systems',
  'Mechanical Design',
  'Civil Engineering',
  'Healthcare IT',
  'Marketing',
];

export const PAGE_SIZE = 10;
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
