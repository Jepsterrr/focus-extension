import { useState, useEffect } from 'react';
import './App.css'; 

const SensitivitySelector = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
    const options = [
        { id: 'flexible', label: 'Flexibel' },
        { id: 'balanced', label: 'Balanserad' },
        { id: 'strict', label: 'Strikt' }
    ];

    return (
        <div className="sensitivity-selector">
            <p>AI-känslighet:</p>
            <div className="sensitivity-options">
                {options.map(opt => (
                    <button
                        key={opt.id}
                        className={value === opt.id ? 'active' : ''}
                        onClick={() => onChange(opt.id)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

function App() {
  const [taskInput, setTaskInput] = useState('');
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [focusStartTime, setFocusStartTime] = useState<number | null>(null); // Tid då fokus startade
  const [elapsedTime, setElapsedTime] = useState(0); // Tid i sekunder sedan fokus startade
  const [sensitivity, setSensitivity] = useState('balanced'); // Standardinställning för känslighet

  // Läs in aktiv uppgift och starttid när popupen öppnas
  useEffect(() => {
    chrome.storage.local.get(['activeTask', 'focusStartTime', 'sensitivity'], (result) => {
      if (result.activeTask) {
        setActiveTask(result.activeTask);
        if (result.focusStartTime) {
          setFocusStartTime(result.focusStartTime);
        }
        if (result.sensitivity) {
          setSensitivity(result.sensitivity);
        }
      }
    });
  }, []);

  // Timer-logik
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTask && focusStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - focusStartTime) / 1000));
      }, 1000);
    } else {
      setElapsedTime(0);
    }

    return () => clearInterval(interval);
  }, [activeTask, focusStartTime]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const handleSensitivityChange = (newSensitivity: string) => {
      setSensitivity(newSensitivity);
      chrome.storage.local.set({ sensitivity: newSensitivity });
  };

  const handleStartFocus = () => {
    if (taskInput.trim() === '') return;

    const startTime = Date.now();
    chrome.storage.local.set({ activeTask: taskInput, focusStartTime: startTime });
    chrome.runtime.sendMessage({ type: "START_FOCUS", task: taskInput });
    
    setActiveTask(taskInput);
    setFocusStartTime(startTime);
    setTaskInput('');
  };

  const handleStopFocus = () => {
    chrome.storage.local.remove(['activeTask', 'focusStartTime', 'whitelist', 'snoozeUntil']);
    chrome.runtime.sendMessage({ type: "STOP_FOCUS" });
    
    setActiveTask(null);
    setFocusStartTime(null);
    setElapsedTime(0);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Fokusflöde</h1>
        {activeTask ? (
          // AKTIVT LÄGE
          <div className="active-focus-view">
            <p>Fokuserar på:</p>
            <strong>{activeTask}</strong>
            <p className="timer">{formatTime(elapsedTime)}</p>
            <button onClick={handleStopFocus}>Avsluta Fokus</button>
          </div>
        ) : (
          <div>
            <p>Vad är din uppgift?</p>
            <input
              type="text"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="t.ex. Skriva rapport..."
            />
            <button onClick={handleStartFocus}>Starta Fokus</button>

            <hr className="divider" />

            <SensitivitySelector value={sensitivity} onChange={handleSensitivityChange} />
          </div>
        )}
      </header>
    </div>
  );
}

export default App;