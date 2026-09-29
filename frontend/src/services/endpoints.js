import api, { cleanParams, unwrap } from './api';

/* Thin wrappers around the REST API, grouped by module. Each returns the unwrapped `data`. */

export const authService = {
  login: (credentials) => api.post('/auth/login', credentials).then(unwrap),
  register: (payload) => api.post('/auth/register', payload).then(unwrap),
  me: () => api.get('/auth/me').then(unwrap),
  logout: () => api.post('/auth/logout'),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  resendVerification: () => api.post('/auth/resend-verification'),
  changePassword: (payload) => api.put('/auth/change-password', payload),
};

export const userService = {
  setActive: (userId, active) => api.patch(`/users/${userId}/status`, { active }).then(unwrap),
  verify: (userId) => api.patch(`/users/${userId}/verify`).then(unwrap),
};

export const studentService = {
  me: () => api.get('/students/me').then(unwrap),
  updateMe: (payload) => api.put('/students/me', payload).then(unwrap),
  uploadResume: (file, onUploadProgress) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/students/me/resume', form, { onUploadProgress }).then(unwrap);
  },
  list: (params) => api.get('/students', { params: cleanParams(params) }).then(unwrap),
  get: (id) => api.get(`/students/${id}`).then(unwrap),
  create: (payload) => api.post('/students', payload).then(unwrap),
  update: (id, payload) => api.put(`/students/${id}`, payload).then(unwrap),
  deactivate: (id) => api.delete(`/students/${id}`),
};

export const facultyService = {
  me: () => api.get('/faculty/me').then(unwrap),
  updateMe: (payload) => api.put('/faculty/me', payload).then(unwrap),
  list: (params) => api.get('/faculty', { params: cleanParams(params) }).then(unwrap),
  options: () => api.get('/faculty/options').then(unwrap),
  create: (payload) => api.post('/faculty', payload).then(unwrap),
  update: (id, payload) => api.put(`/faculty/${id}`, payload).then(unwrap),
  deactivate: (id) => api.delete(`/faculty/${id}`),
};

export const companyService = {
  list: (params) => api.get('/companies', { params: cleanParams(params) }).then(unwrap),
  options: () => api.get('/companies/options').then(unwrap),
  get: (id) => api.get(`/companies/${id}`).then(unwrap),
  create: (payload) => api.post('/companies', payload).then(unwrap),
  update: (id, payload) => api.put(`/companies/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/companies/${id}`).then((r) => r.data),
  restore: (id) => api.patch(`/companies/${id}/restore`).then(unwrap),
};

export const internshipService = {
  list: (params) => api.get('/internships', { params: cleanParams(params) }).then(unwrap),
  filters: () => api.get('/internships/filters').then(unwrap),
  get: (id) => api.get(`/internships/${id}`).then(unwrap),
  create: (payload) => api.post('/internships', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/internships/${id}`, payload).then(unwrap),
  changeStatus: (id, status, remarks) => api.patch(`/internships/${id}/status`, { status, remarks }).then(unwrap),
  remove: (id) => api.delete(`/internships/${id}`).then((r) => r.data),
};

export const applicationService = {
  list: (params) => api.get('/applications', { params: cleanParams(params) }).then(unwrap),
  get: (id) => api.get(`/applications/${id}`).then(unwrap),
  apply: (payload) => api.post('/applications', payload).then(unwrap),
  update: (id, payload) => api.put(`/applications/${id}`, payload).then(unwrap),
  changeStatus: (id, status, comment) => api.patch(`/applications/${id}/status`, { status, comment }).then(unwrap),
  complete: (id) => api.post(`/applications/${id}/complete`).then(unwrap),
  withdraw: (id) => api.delete(`/applications/${id}`).then(unwrap),
};

export const interviewService = {
  list: (params) => api.get('/interviews', { params: cleanParams(params) }).then(unwrap),
  get: (id) => api.get(`/interviews/${id}`).then(unwrap),
  schedule: (payload) => api.post('/interviews', payload).then(unwrap),
  update: (id, payload) => api.put(`/interviews/${id}`, payload).then(unwrap),
  recordResult: (id, payload) => api.patch(`/interviews/${id}/result`, payload).then(unwrap),
  cancel: (id, reason) => api.delete(`/interviews/${id}`, { params: cleanParams({ reason }) }).then(unwrap),
};

export const evaluationService = {
  list: (params) => api.get('/evaluations', { params: cleanParams(params) }).then(unwrap),
  pending: () => api.get('/evaluations/pending').then(unwrap),
  create: (payload) => api.post('/evaluations', payload).then(unwrap),
  update: (id, payload) => api.put(`/evaluations/${id}`, payload).then(unwrap),
  archive: (id) => api.delete(`/evaluations/${id}`),
};

export const feedbackService = {
  studentList: (params) => api.get('/feedback/student', { params: cleanParams(params) }).then(unwrap),
  studentCreate: (payload) => api.post('/feedback/student', payload).then(unwrap),
  studentUpdate: (id, payload) => api.put(`/feedback/student/${id}`, payload).then(unwrap),
  companyList: (params) => api.get('/feedback/company', { params: cleanParams(params) }).then(unwrap),
  companyCreate: (payload) => api.post('/feedback/company', payload).then(unwrap),
  companyUpdate: (id, payload) => api.put(`/feedback/company/${id}`, payload).then(unwrap),
  facultyList: (params) => api.get('/feedback/faculty', { params: cleanParams(params) }).then(unwrap),
  facultyCreate: (payload) => api.post('/feedback/faculty', payload).then(unwrap),
  facultyUpdate: (id, payload) => api.put(`/feedback/faculty/${id}`, payload).then(unwrap),
  systemList: (params) => api.get('/feedback/system', { params: cleanParams(params) }).then(unwrap),
  systemCreate: (payload) => api.post('/feedback/system', payload).then(unwrap),
  systemUpdate: (id, payload) => api.put(`/feedback/system/${id}`, payload).then(unwrap),
  systemStatus: (id, payload) => api.patch(`/feedback/system/${id}/status`, payload).then(unwrap),
};

export const reportService = {
  admin: () => api.get('/reports/admin').then(unwrap),
  faculty: () => api.get('/reports/faculty').then(unwrap),
  student: () => api.get('/reports/student').then(unwrap),
};

export const dashboardService = {
  admin: () => api.get('/dashboard/admin').then(unwrap),
  faculty: () => api.get('/dashboard/faculty').then(unwrap),
  student: () => api.get('/dashboard/student').then(unwrap),
};

export const auditService = {
  list: (params) => api.get('/audit-logs', { params: cleanParams(params) }).then(unwrap),
};
