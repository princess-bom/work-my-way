import { useState } from 'react';
import { BrandMark } from './components/BrandMark';
import { StudentExperience } from './components/StudentExperience';
import { TeacherConsole } from './components/TeacherConsole';
import {
  masteryDemo,
  type CanonicalChoiceId,
  type SupportRequest
} from './components/masteryDemo';

type View = 'student' | 'teacher';

export default function App() {
  const [view, setView] = useState<View>('student');
  const [supportRequest, setSupportRequest] = useState<SupportRequest | null>(null);
  const [selectedChoiceId, setSelectedChoiceId] = useState<CanonicalChoiceId | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function handleSupport(request: SupportRequest) {
    setSupportRequest(request);
    setConfirmed(false);
  }

  function handleChoice(choiceId: CanonicalChoiceId) {
    setSelectedChoiceId(choiceId);
    setConfirmed(false);
  }

  if (view === 'teacher') {
    return (
      <TeacherConsole
        demo={masteryDemo}
        supportRequest={supportRequest}
        selectedChoiceId={selectedChoiceId}
        confirmed={confirmed}
        onConfirm={() => setConfirmed(true)}
        onBack={() => setView('student')}
      />
    );
  }

  return (
    <div className="app-frame">
      <header className="app-header">
        <BrandMark />
        <div className="prototype-note" role="note">
          Synthetic demo · Adult evaluators only · No real learner data
        </div>
      </header>
      <StudentExperience
        demo={masteryDemo}
        supportRequest={supportRequest}
        selectedChoiceId={selectedChoiceId}
        onSupport={handleSupport}
        onSelectChoice={handleChoice}
        onOpenTeacher={() => setView('teacher')}
      />
    </div>
  );
}
