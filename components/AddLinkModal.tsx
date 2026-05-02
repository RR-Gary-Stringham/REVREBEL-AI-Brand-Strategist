
import React, { useState } from 'react';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLink: (link: string) => void;
}

export const AddLinkModal: React.FC<AddLinkModalProps> = ({ isOpen, onClose, onAddLink }) => {
  const [link, setLink] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (link.trim()) {
      onAddLink(link);
      setLink('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 fade-in" onClick={onClose}>
      <div className="bg-[#2E2E2E] border-2 border-[#71C9C5]/50 w-full max-w-lg p-6 text-[#EFF5F6] relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-2xl text-[#B2D3DE] hover:text-white">&times;</button>
        <h2 className="font-headline text-2xl text-[#71C9C5] text-glow mb-6">Add Google Doc Link</h2>
        <form onSubmit={handleSubmit}>
          <p className="text-sm text-[#B2D3DE] mb-4">Paste the public URL to a Google Document below. The AI will read its content to use as context for your prompt.</p>
          <input
            type="url"
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder="https://docs.google.com/document/d/..."
            className="w-full bg-[#163666] border-2 border-[#575757] p-2 text-[#EFF5F6] placeholder-[#B2D3DE]/60 focus:outline-none focus:border-[#FACA78] transition-colors"
            autoFocus
          />
          <div className="mt-6 text-right">
            <button type="submit" disabled={!link.trim()} className="bg-[#FACA78] text-[#163666] font-bold py-2 px-6 font-headline tracking-wider hover:bg-[#FAFAFA] transition-all duration-200 disabled:bg-[#575757] disabled:cursor-not-allowed">
                Add Link
            </button>
        </div>
        </form>
      </div>
    </div>
  );
};
