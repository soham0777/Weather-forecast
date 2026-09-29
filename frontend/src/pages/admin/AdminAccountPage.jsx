import PageHeader from '../../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import DescriptionList from '../../components/ui/DescriptionList';
import ChangePasswordCard from '../../components/domain/ChangePasswordCard';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/format';

export default function AdminAccountPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Account" description="Administrator account settings." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Signed in as" />
          <CardBody>
            <DescriptionList items={[
              { label: 'E-mail', value: user.email }, { label: 'Role', value: 'Administrator' },
              { label: 'Last login', value: formatDateTime(user.lastLoginAt) },
            ]} />
          </CardBody>
        </Card>
        <ChangePasswordCard />
      </div>
    </>
  );
}
