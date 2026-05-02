
import React, { useEffect, forwardRef } from 'react';
import type { AttachedFile } from '../types';

interface PromptInputProps {
  prompt: string;
  setPrompt: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  attachedGDocLink: string | null;
  onRemoveGDocLink: () => void;
  attachedFile: AttachedFile | null;
  onRemoveFile: () => void;
}

const SendIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 2-7 20-4-9-9-4Z"/>
        <path d="M22 2 11 13"/>
    </svg>
);

const GDocIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#4285F4" strokeWidth="0">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"></path>
    </svg>
);

const FileIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#B2D3DE]">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
);


export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(({ prompt, setPrompt, onSubmit, isLoading, attachedGDocLink, onRemoveGDocLink, attachedFile, onRemoveFile }, ref) => {
  
  useEffect(() => {
    const textarea = (ref as React.RefObject<HTMLTextAreaElement>)?.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [prompt, ref]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() || attachedGDocLink || attachedFile) {
      onSubmit();
    }
  };
  
  const isDisabled = isLoading || (!prompt.trim() && !attachedGDocLink && !attachedFile);

  return (
    <form onSubmit={handleSubmit} className="flex items-start space-x-2 p-2 border-2 border-[#FACA78]/50 bg-[#2E2E2E]/50">
      <div className="flex-grow flex flex-col">
        <div className="flex flex-col gap-2 mb-2">
            {attachedGDocLink && (
                <div className="flex items-center bg-[#163666] border border-[#575757] px-2 py-1 max-w-full">
                    <GDocIcon />
                    <span className="text-xs text-[#B2D3DE] ml-2 truncate flex-shrink min-w-0">{attachedGDocLink}</span>
                    <button 
                        type="button" 
                        onClick={onRemoveGDocLink} 
                        className="ml-auto text-red-500 font-bold text-lg flex-shrink-0"
                        disabled={isLoading}
                    >
                        &times;
                    </button>
                </div>
            )}
             {attachedFile && (
                <div className="flex items-center bg-[#163666] border border-[#575757] px-2 py-1 max-w-full">
                    <FileIcon />
                    <span className="text-xs text-[#B2D3DE] ml-2 truncate flex-shrink min-w-0">{attachedFile.name}</span>
                    <button 
                        type="button" 
                        onClick={onRemoveFile} 
                        className="ml-auto text-red-500 font-bold text-lg flex-shrink-0"
                        disabled={isLoading}
                    >
                        &times;
                    </button>
                </div>
            )}
        </div>
        <textarea
          ref={ref}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Enter your request..."
          className="w-full bg-transparent text-[#EFF5F6] placeholder-[#B2D3DE]/60 focus:outline-none resize-none max-h-48 overflow-y-auto"
          rows={1}
          disabled={isLoading}
        />
      </div>
      <button
        type="submit"
        disabled={isDisabled}
        className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-[#FACA78] text-[#163666] font-bold transition-all duration-200 enabled:hover:bg-[#FAFAFA] enabled:hover:shadow-[0_0_15px_#FACA78] disabled:bg-[#575757] disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-[#163666] border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <SendIcon />
        )}
      </button>
    </form>
  );
});
