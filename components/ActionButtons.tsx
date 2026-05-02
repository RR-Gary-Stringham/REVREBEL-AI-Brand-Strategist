
import React, { useRef } from 'react';
import type { Mode } from '../types';

interface ReceivingActionsProps {
  onFileAttached: (file: File) => void;
  onAddGoogleDocLink: () => void;
  isLoading: boolean;
  activeMode: Mode;
}

export const FooterActions: React.FC<ReceivingActionsProps> = ({ onFileAttached, onAddGoogleDocLink, isLoading, activeMode }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onFileAttached(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
    const baseButtonClass = "px-2 py-1 text-xs bg-[#2E2E2E] text-[#B2D3DE] border border-[#575757] hover:bg-[#575757] hover:text-[#FAFAFA] transition-colors disabled:cursor-not-allowed disabled:text-[#575757]";
    const isImageMode = activeMode === 'VISUAL_QA';

    return (
        <div className="mt-2 flex items-center justify-center gap-2 flex-wrap pb-1">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept={isImageMode ? "image/*" : ".txt,.md"}
                disabled={isLoading}
            />
            <button onClick={() => fileInputRef.current?.click()} className={baseButtonClass} disabled={isLoading}>
                {isImageMode ? 'Upload Image' : 'Upload File (.txt, .md)'}
            </button>
            {!isImageMode && (
              <button onClick={onAddGoogleDocLink} className={baseButtonClass} disabled={isLoading}>
                  Add Google Doc Link
              </button>
            )}
        </div>
    );
};
