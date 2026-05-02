
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { PromptInput } from './components/PromptInput';
import { MessageBox } from './components/MessageBox';
import { Tabs } from './components/Tabs';
import { SamplePrompts } from './components/SamplePrompts';
import { Onboarding } from './components/Onboarding';
import { FooterActions } from './components/ActionButtons';
import { SettingsModal } from './components/SettingsModal';
import { AddLinkModal } from './components/AddLinkModal';
import type { Message, Mode, OnboardingState, ImageEditMode, AttachedFile } from './types';
import { streamChatResponse, generateImage, editImage } from './services/geminiService';
import * as workspaceAdapter from './services/workspaceAdapter';
import type { FunctionCall } from '@google/genai';

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const App: React.FC = () => {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(() => {
    try {
      const savedState = localStorage.getItem('revrebel-onboarding');
      if (savedState) {
        return JSON.parse(savedState);
      }
    } catch (e) {
      console.error("Failed to parse onboarding state from localStorage", e);
    }
    return { isComplete: false, storageProvider: null, vectorDBConnected: false, brandscape: null };
  });
  
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
        const savedMessages = localStorage.getItem('revrebel-messages');
        if (savedMessages) {
            return JSON.parse(savedMessages);
        }
    } catch (e) {
        console.error("Failed to parse messages from localStorage", e);
    }
    return [{
      id: `model-${Date.now()}`, role: 'model', content: 'REVREBEL/AI initialized. System ready. How can I assist?', mode: 'COPYWRITING'
    }];
  });

  const [prompt, setPrompt] = useState('');
  const [activeMode, setActiveMode] = useState<Mode>('COPYWRITING');
  const [isLoading, setIsLoading] = useState(false);
  const [exportStates, setExportStates] = useState<Record<string, { inProgress: boolean; status: 'idle' | 'success' | 'error'; message?: string }>>({});
  
  const [uploadedImage, setUploadedImage] = useState<{ data: string; mimeType: string, url: string } | null>(null);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageEditMode, setImageEditMode] = useState<ImageEditMode>('analyze');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);
  const [attachedGDocLink, setAttachedGDocLink] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
        localStorage.setItem('revrebel-onboarding', JSON.stringify(onboardingState));
    } catch (e) {
        console.error("Failed to save onboarding state to localStorage", e);
    }
  }, [onboardingState]);

  useEffect(() => {
    try {
        localStorage.setItem('revrebel-messages', JSON.stringify(messages));
    } catch (e) {
        console.error("Failed to save messages to localStorage", e);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

   const handlePromptSubmit = useCallback(async () => {
    if (isLoading) return;
    
    let combinedPrompt = prompt;
    if (attachedFile) {
        combinedPrompt = `FILE CONTEXT:\n---\n${attachedFile.content}\n---\n\n${combinedPrompt}`;
    }
    if (attachedGDocLink) {
        combinedPrompt = `[Attached Google Doc: ${attachedGDocLink}]\n\n${combinedPrompt}`;
    }
    
    const currentUploadedImage = uploadedImage;
    if (!combinedPrompt.trim() && !currentUploadedImage) return;

    setIsLoading(true);
    setPrompt('');
    setUploadedImage(null);
    setAttachedGDocLink(null);
    setAttachedFile(null);

    const userMessageId = `user-${Date.now()}`;
    const userMessage: Message = {
        id: userMessageId,
        role: 'user',
        content: combinedPrompt,
        mode: activeMode,
        uploadedImage: currentUploadedImage ? { data: currentUploadedImage.data, mimeType: currentUploadedImage.mimeType } : undefined
    };
    setMessages(prev => [...prev, userMessage]);

    const modelMessageId = `model-${Date.now() + 1}`;
    
    try {
      if (activeMode === 'CREATIVE_IDEATION' && !currentUploadedImage && !attachedGDocLink && !attachedFile) {
          const newModelMessage: Message = { id: modelMessageId, role: 'model', content: '', mode: activeMode, isThinking: true };
          setMessages(prev => [...prev, newModelMessage]);
          const images = await generateImage(combinedPrompt, aspectRatio);
          setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, isThinking: false, content: `Generated image for: "${prompt}"`, generatedImages: images } : m));
      } else if (activeMode === 'VISUAL_QA' && currentUploadedImage && imageEditMode === 'edit') {
          const newModelMessage: Message = { id: modelMessageId, role: 'model', content: '', mode: activeMode, isThinking: true };
          setMessages(prev => [...prev, newModelMessage]);
          const images = await editImage(combinedPrompt, currentUploadedImage);
          setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, isThinking: false, content: `Edited image based on: "${prompt}"`, generatedImages: images } : m));
      } else {
        const newModelMessage: Message = { id: modelMessageId, role: 'model', content: '', mode: activeMode };
        setMessages(prev => [...prev, newModelMessage]);

        const history = [...messages, userMessage];
        const stream = streamChatResponse(history, activeMode, onboardingState.vectorDBConnected, onboardingState.brandscape);

        for await (const chunk of stream) {
            setMessages(prev => prev.map(m => {
                if (m.id === modelMessageId) {
                    return {
                        ...m,
                        content: m.content + (chunk.text || ''),
                        toolCall: chunk.toolCall || m.toolCall,
                        isFeedbackPending: !!chunk.toolCall,
                        isThinking: chunk.isThinking !== undefined ? chunk.isThinking : m.isThinking,
                        groundingChunks: chunk.groundingChunks || m.groundingChunks,
                    };
                }
                return m;
            }));
        }
      }
    } catch (error) {
        console.error(error);
        const errorMsg: Message = { id: modelMessageId, role: 'model', content: 'An error occurred. Please check the console for details.', mode: activeMode, isError: true };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
        setIsLoading(false);
    }
  }, [prompt, isLoading, activeMode, messages, onboardingState, uploadedImage, aspectRatio, imageEditMode, attachedGDocLink, attachedFile]);
  
  const handleConceptFeedback = useCallback(async (messageId: string, approved: boolean) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isFeedbackPending: false } : m));

    const conversationHistory = messages.map(m => m.id === messageId ? {
      ...m,
      isFeedbackPending: false,
      content: approved ? 'User approved the concept.' : 'User rejected the concept. Please provide a new concept.'
    } : m);
    
    const toolCallMessage = messages.find(m => m.id === messageId);
    if (!toolCallMessage?.toolCall) return;

    const toolResult = {
        name: toolCallMessage.toolCall.name,
        response: { approved }
    };

    const toolMessage: Message = {
      id: `tool-${Date.now()}`,
      role: 'tool',
      content: '',
      mode: activeMode,
      toolResult,
    };
    const newHistory = [...conversationHistory, toolMessage];
    setMessages(newHistory);

    const modelMessageId = `model-${Date.now() + 1}`;
    const newModelMessage: Message = { id: modelMessageId, role: 'model', content: '', mode: activeMode };
    setMessages(prev => [...prev, newModelMessage]);

    setIsLoading(true);
    try {
        const stream = streamChatResponse(newHistory, activeMode, onboardingState.vectorDBConnected, onboardingState.brandscape);
        for await (const chunk of stream) {
             setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, content: m.content + (chunk.text || '') } : m));
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  }, [messages, activeMode, onboardingState]);

  const handleExport = useCallback(async (messageId: string, content: string) => {
    if (!onboardingState.storageProvider) return;
    setExportStates(prev => ({ ...prev, [messageId]: { inProgress: true, status: 'idle' } }));
    try {
        const title = content.substring(0, 30).split('\n')[0] || `REVREBEL AI Export`;
        // Basic check for markdown table to suggest saving as a Sheet
        const isStructured = content.includes('|') && content.includes('---');
        const result = await workspaceAdapter.exportContent({
            provider: onboardingState.storageProvider,
            title,
            content,
            isStructured
        });
        if (result.success) {
            setExportStates(prev => ({ ...prev, [messageId]: { inProgress: false, status: 'success', message: `Saved to ${result.url}` } }));
        } else {
             throw new Error('Export failed');
        }
    } catch (error) {
        console.error("Export failed", error);
        setExportStates(prev => ({ ...prev, [messageId]: { inProgress: false, status: 'error', message: 'Failed to save.' } }));
    }
  }, [onboardingState.storageProvider]);

  const handleFileAttached = (file: File) => {
    if (activeMode === 'VISUAL_QA') {
        const url = URL.createObjectURL(file);
        blobToBase64(file).then(data => {
            setUploadedImage({ data, mimeType: file.type, url });
        });
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setAttachedFile({ name: file.name, content });
            promptInputRef.current?.focus();
        };
        reader.readAsText(file);
    }
  };

  const handleAddGDocLinkSubmit = (link: string) => {
    setAttachedGDocLink(link);
    setIsAddLinkModalOpen(false);
    promptInputRef.current?.focus();
  };

  const handleOnboardingComplete = (state: OnboardingState) => {
    setOnboardingState(state);
  };
  
  const handleExportConfig = () => {
    const config = JSON.stringify(onboardingState, null, 2);
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'revrebel-ai-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const config = JSON.parse(e.target?.result as string);
            setOnboardingState(config);
        } catch (err) {
            alert("Error: Invalid configuration file.");
        }
    };
    reader.readAsText(file);
  };
  
  const updateOnboardingState = (newState: Partial<OnboardingState>) => {
    setOnboardingState(prev => ({...prev, ...newState}));
  };

  if (!onboardingState.isComplete) {
    return <Onboarding onComplete={handleOnboardingComplete} onImportConfig={handleImportConfig} />;
  }
  
  return (
    <div className="min-h-screen flex flex-col items-center p-4 text-[#EFF5F6]">
      <div className="w-full max-w-4xl flex-grow flex flex-col">
        <Header onOpenSettings={() => setIsSettingsOpen(true)} />
        <Tabs activeMode={activeMode} setActiveMode={setActiveMode} />
        
        <main className="flex-grow overflow-y-auto mb-4 space-y-6 pr-2">
            {messages.map((msg, index) => (
                <MessageBox 
                  key={msg.id} 
                  message={msg} 
                  onFeedback={handleConceptFeedback}
                  isLoading={isLoading && index === messages.length -1}
                  onExport={handleExport}
                  exportState={exportStates[msg.id]}
                  storageProvider={onboardingState.storageProvider}
                />
            ))}
            <div ref={messagesEndRef} />
        </main>

        <footer className="w-full max-w-4xl mx-auto mt-auto">
            {uploadedImage && activeMode === 'VISUAL_QA' && (
              <div className="mb-2 p-2 border-2 border-dashed border-[#575757] flex items-start gap-4">
                  <img src={uploadedImage.url} alt="upload preview" className="w-24 h-24 object-cover" />
                  <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-2">
                          <button onClick={() => setImageEditMode('analyze')} className={`px-2 py-1 text-xs ${imageEditMode === 'analyze' ? 'bg-[#FACA78] text-black' : 'bg-[#2E2E2E] text-white'}`}>Analyze</button>
                          <button onClick={() => setImageEditMode('edit')} className={`px-2 py-1 text-xs ${imageEditMode === 'edit' ? 'bg-[#FACA78] text-black' : 'bg-[#2E2E2E] text-white'}`}>Edit</button>
                      </div>
                      <p className="text-xs text-[#B2D3DE]">
                          {imageEditMode === 'analyze' ? 'Ask a question about this image.' : 'Describe the edits you want to make.'}
                      </p>
                  </div>
                   <button onClick={() => setUploadedImage(null)} className="text-red-500 font-bold text-xl">&times;</button>
              </div>
            )}
            
            {activeMode === 'CREATIVE_IDEATION' && !uploadedImage && (
                <div className="flex items-center gap-4 mb-2">
                    <label className="text-xs font-bold">Aspect Ratio:</label>
                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="bg-[#2E2E2E] border border-[#575757] text-white text-xs px-2 py-1">
                        <option value="1:1">1:1 (Square)</option>
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="4:3">4:3</option>
                        <option value="3:4">3:4</option>
                    </select>
                </div>
            )}

            <SamplePrompts onPromptClick={(p, m) => { setPrompt(p); setActiveMode(m); }} currentMode={activeMode} />
            <PromptInput 
                ref={promptInputRef} 
                prompt={prompt} 
                setPrompt={setPrompt} 
                onSubmit={handlePromptSubmit} 
                isLoading={isLoading}
                attachedGDocLink={attachedGDocLink}
                onRemoveGDocLink={() => setAttachedGDocLink(null)}
                attachedFile={attachedFile}
                onRemoveFile={() => setAttachedFile(null)}
             />
            <FooterActions
              onFileAttached={handleFileAttached}
              onAddGoogleDocLink={() => setIsAddLinkModalOpen(true)}
              isLoading={isLoading}
              activeMode={activeMode}
            />
        </footer>
      </div>
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onboardingState={onboardingState}
        updateOnboardingState={updateOnboardingState}
        onExportConfig={handleExportConfig}
        onImportConfig={handleImportConfig}
      />
      <AddLinkModal
        isOpen={isAddLinkModalOpen}
        onClose={() => setIsAddLinkModalOpen(false)}
        onAddLink={handleAddGDocLinkSubmit}
      />
    </div>
  );
};
