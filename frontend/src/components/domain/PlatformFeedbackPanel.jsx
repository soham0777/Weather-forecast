import { useState } from 'react';
import { Card, CardBody, CardHeader } from '../ui/Card';
import SystemFeedbackForm from './SystemFeedbackForm';
import SystemFeedbackList from './SystemFeedbackList';

/** Platform (system) feedback: submit form + own submissions, or the admin management list. */
export default function PlatformFeedbackPanel({ manage = false }) {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6">
      {!manage && (
        <Card>
          <CardHeader title="Send feedback about CIMS" description="Suggest a feature, report a bug or propose an improvement." />
          <CardBody><SystemFeedbackForm onSubmitted={() => setRefreshKey((k) => k + 1)} /></CardBody>
        </Card>
      )}
      <Card>
        <CardHeader title={manage ? 'Platform feedback' : 'My submissions'}
                    description={manage ? 'Review suggestions and bug reports and record the action taken.' : undefined} />
        <SystemFeedbackList manage={manage} refreshKey={refreshKey} />
      </Card>
    </div>
  );
}
