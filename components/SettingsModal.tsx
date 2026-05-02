
import React, { useRef, useState } from 'react';
import type { OnboardingState, StorageProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportConfig: () => void;
  onImportConfig: (file: File) => void;
  onboardingState: OnboardingState;
  updateOnboardingState: (newState: Partial<OnboardingState>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onExportConfig,
  onImportConfig,
  onboardingState,
  updateOnboardingState
}) => {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [currentStorageProvider, setCurrentStorageProvider] = useState(onboardingState.storageProvider);

  if (!isOpen) return null;

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportConfig(file);
    }
  };

  const handleSave = () => {
    updateOnboardingState({ storageProvider: currentStorageProvider });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 fade-in" onClick={onClose}>
      <div className="bg-[#2E2E2E] border-2 border-[#71C9C5]/50 w-full max-w-lg p-6 text-[#EFF5F6] relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-2xl text-[#B2D3DE] hover:text-white">&times;</button>
        <h2 className="font-headline text-2xl text-[#71C9C5] text-glow mb-6">Settings</h2>

        {/* Configuration Management */}
        <div className="mb-8">
          <h3 className="font-bold text-sm uppercase tracking-wider text-[#B2D3DE]/80 mb-3">Configuration</h3>
          <div className="flex gap-4">
             <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleFileImport} />
            <button onClick={() => importInputRef.current?.click()} className="flex-1 bg-[#047C97] text-white font-bold py-2 px-4 font-headline tracking-wider hover:bg-[#00A6B6] transition-all duration-200">
                Import
            </button>
            <button onClick={onExportConfig} className="flex-1 bg-[#575757] text-white font-bold py-2 px-4 font-headline tracking-wider hover:bg-[#ABABAB] transition-all duration-200">
                Export
            </button>
          </div>
           <p className="text-xs text-center mt-2 text-[#B2D3DE]/70">// Save or load your settings from a file.</p>
        </div>
        
        {/* Workflow Settings */}
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wider text-[#B2D3DE]/80 mb-3">Workflow Destination</h3>
           <div className="space-y-3">
              {(['google', 'notion', 'sharepoint'] as StorageProvider[]).map(provider => (
                  <button key={provider} onClick={() => setCurrentStorageProvider(provider)} className={`w-full text-left p-3 border-2 transition-colors ${currentStorageProvider === provider ? 'border-[#FACA78] bg-[#FACA78]/10' : 'border-[#575757] bg-[#163666] hover:border-[#71C9C5]'}`}>
                      <span className="font-bold font-headline tracking-wide text-lg capitalize text-white">{provider === 'google' ? 'Google Workspace' : provider}</span>
                  </button>
              ))}
          </div>
        </div>

        <div className="mt-8 text-right">
            <button onClick={handleSave} className="bg-[#FACA78] text-[#163666] font-bold py-2 px-6 font-headline tracking-wider hover:bg-[#FAFAFA] transition-all duration-200">
                Save & Close
            </button>
        </div>

      </div>
    </div>
  );
};
