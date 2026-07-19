import { useState } from 'react';
import { requestSupportPacket } from './api';
import { BrandMark } from './components/BrandMark';
import { StudentExperience } from './components/StudentExperience';
import { TeacherConsole } from './components/TeacherConsole';
import { libraryScene } from './data/demo';
import type { SupportAction, SupportPacketResponse } from '../shared/support-schema';

type View = 'student' | 'teacher';

export default function App() {
  const [view, setView] = useState<View>('student');
  const [packet, setPacket] = useState<SupportPacketResponse | null>(null);
  const [loadingAction, setLoadingAction] = useState<SupportAction | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSupport(action: SupportAction) {
    setLoadingAction(action);
    setConfirmed(false);
    const nextPacket = await requestSupportPacket({ action, scene: libraryScene });
    setPacket(nextPacket);
    setLoadingAction(null);
  }

  if (view === 'teacher') {
    return (
      <TeacherConsole
        packet={packet}
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
        <div className="prototype-note">
          Build Week prototype · Synthetic data only
        </div>
      </header>
      <StudentExperience
        packet={packet}
        loadingAction={loadingAction}
        onSupport={handleSupport}
        onOpenTeacher={() => setView('teacher')}
      />
    </div>
  );
}
