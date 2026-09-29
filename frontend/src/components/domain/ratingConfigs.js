/* Field definitions for the rating forms (labels match the requirement document). */

export const PERFORMANCE_RATINGS = [
  { key: 'technicalSkills', label: 'Technical skills' },
  { key: 'softSkills', label: 'Soft skills' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'responsibility', label: 'Responsibility' },
  { key: 'teamwork', label: 'Teamwork' },
  { key: 'learningAbility', label: 'Learning ability' },
];

export const EVALUATION_RATINGS = [...PERFORMANCE_RATINGS, { key: 'overallRating', label: 'Overall rating' }];
export const EVALUATION_TEXTS = [{ key: 'comments', label: 'Evaluator comments', max: 2000, rows: 4 }];

export const COMPANY_FEEDBACK_RATINGS = [
  ...PERFORMANCE_RATINGS,
  { key: 'hireLikelihood', label: 'Likelihood to hire full-time', description: '1 = very unlikely, 5 = very likely' },
];
export const COMPANY_FEEDBACK_TEXTS = [
  { key: 'companyRepresentative', label: 'Company representative (who gave this feedback)', max: 100, input: true },
  { key: 'strengths', label: 'Strengths', max: 1000 },
  { key: 'areasForImprovement', label: 'Areas for improvement', max: 1000 },
  { key: 'comments', label: 'Open comments', max: 2000 },
];

export const STUDENT_FEEDBACK_RATINGS = [
  { key: 'companyCulture', label: 'Company culture' },
  { key: 'mentorshipQuality', label: 'Mentorship quality' },
  { key: 'technicalLearning', label: 'Technical learning opportunities' },
  { key: 'workEnvironment', label: 'Work environment' },
  { key: 'overallExperience', label: 'Overall experience' },
];
export const STUDENT_FEEDBACK_TEXTS = [
  { key: 'comments', label: 'Detailed comments', max: 2000, rows: 4 },
  { key: 'suggestions', label: 'Suggestions', max: 2000 },
];

export const FACULTY_FEEDBACK_RATINGS = [
  { key: 'courseSuitability', label: 'Suitability for course objectives' },
  { key: 'learningOutcomes', label: 'Student learning outcomes achieved' },
  { key: 'internshipQuality', label: 'Internship quality' },
];
export const FACULTY_FEEDBACK_TEXTS = [
  { key: 'learningOutcomesNotes', label: 'Learning outcome notes', max: 2000 },
  { key: 'suggestions', label: 'Suggestions for improvement', max: 2000 },
];
