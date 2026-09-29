import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardBody } from '../../components/ui/Card';
import { Alert, ErrorState, PageLoader } from '../../components/ui/States';
import InternshipForm from '../../components/domain/InternshipForm';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useRoleBase } from '../../hooks/useRoleBase';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import { companyService, facultyService, internshipService } from '../../services/endpoints';

/** Create (no :id) or edit an internship — faculty and admin. */
export default function InternshipFormPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const base = useRoleBase();
  const navigate = useNavigate();
  const toast = useToast();
  const isAdmin = user.role === 'ADMIN';
  const { data, loading, error, reload } = useApi(async () => {
    const [companies, faculty, internship] = await Promise.all([
      companyService.options(),
      isAdmin ? facultyService.options() : Promise.resolve([]),
      id ? internshipService.get(id) : Promise.resolve(null),
    ]);
    return { companies, faculty, internship };
  }, [id, isAdmin]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [serverErrors, setServerErrors] = useState({});

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const submit = async (payload) => {
    setSubmitting(true);
    setServerError(null);
    setServerErrors({});
    try {
      if (id) {
        await internshipService.update(id, payload);
        toast.success('Internship updated.');
        navigate(`${base}/internships/${id}`);
      } else {
        const result = await internshipService.create(payload);
        toast.success(result.message);
        navigate(`${base}/internships/${result.data.id}`);
      }
    } catch (err) {
      setServerError(getErrorMessage(err));
      setServerErrors(getFieldErrors(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const internship = data.internship;
  return (
    <>
      <PageHeader title={id ? 'Edit internship' : 'Post a new internship'}
                  backTo={id ? `${base}/internships/${id}` : `${base}/internships`}
                  description={id ? internship?.title : isAdmin
                    ? 'Internships created by an administrator are approved immediately.'
                    : 'New internships are sent to the administrator for approval before students can see them.'} />
      {internship?.status === 'REJECTED' && user.role === 'FACULTY' && (
        <div className="mb-6"><Alert tone="warning" title="This internship was rejected">
          {internship.reviewRemarks} Saving your changes resubmits it for approval.</Alert></div>
      )}
      {data.companies.length === 0 && (
        <div className="mb-6"><Alert tone="warning">No active companies are available. An administrator must add the company first.</Alert></div>
      )}
      <Card>
        <CardBody className="py-6">
          <InternshipForm initial={internship} companies={data.companies} facultyOptions={data.faculty} isAdmin={isAdmin}
                          submitting={submitting} serverError={serverError} serverErrors={serverErrors} onSubmit={submit}
                          submitLabel={id ? 'Save changes' : isAdmin ? 'Create internship' : 'Submit for approval'} />
        </CardBody>
      </Card>
    </>
  );
}
