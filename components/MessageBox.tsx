
import React from 'react';
import type { Message, StorageProvider } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CreativeConceptBox } from './CreativeConceptBox';

interface MessageBoxProps {
  message: Message;
  onFeedback: (messageId: string, approved: boolean) => void;
  isLoading: boolean;
  onExport: (messageId: string, content: string) => void;
  exportState?: { inProgress: boolean; status: 'idle' | 'success' | 'error'; message?: string };
  storageProvider: StorageProvider | null;
}

const UserIcon: React.FC = () => (
    <div className="w-8 h-8 flex-shrink-0 border-2 border-[#575757] bg-[#2E2E2E] flex items-center justify-center text-[#B2D3DE] font-bold text-sm">
      &gt;_
    </div>
);

const ModelIcon: React.FC = () => (
    <div className="w-8 h-8 flex-shrink-0 border-2 border-[#71C9C5] bg-[#71C9C5]/10 flex items-center justify-center text-[#71C9C5] font-bold text-sm font-headline">
      AI
    </div>
);

const stripMarkdown = (markdown: string): string => {
  let output = markdown;
  output = output.replace(/^#{1,6}\s+/gm, '');
  output = output.replace(/(\*\*|__)(.*?)\1/g, '$2');
  output = output.replace(/(\*|_)(.*?)\1/g, '$2');
  output = output.replace(/~~(.*?)~~/g, '$1');
  output = output.replace(/`([^`]+)`/g, '$1');
  output = output.replace(/!\[.*?\]\(.*?\)/g, '');
  output = output.replace(/\[(.*?)\]\(.*?\)/g, '$1');
  output = output.replace(/^\s*>\s?/gm, '');
  output = output.replace(/^\s*[-*_]{3,}\s*$/gm, '');
  output = output.replace(/^\s*[\d\.\-+*]\s+/gm, '');
  output = output.replace(/\n{2,}/g, '\n\n');
  return output.trim();
};

const MessageActions: React.FC<Omit<MessageBoxProps, 'onFeedback' | 'isLoading'>> = ({ message, onExport, exportState, storageProvider }) => {
  const [copyText, setCopyText] = React.useState('Copy');
  
  if (!message || !message.content || message.isFeedbackPending || message.role === 'user') return null;

  const { id, content } = message;

  const downloadFile = (filename: string, text: string, mimeType: string) => {
    const element = document.createElement('a');
    const file = new Blob([text], { type: mimeType });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
  };

  const handleDownloadTxt = () => downloadFile('revrebel-ai-output.txt', stripMarkdown(content), 'text/plain;charset=utf-8');
  const handleDownloadMd = () => downloadFile('revrebel-ai-output.md', content, 'text/markdown;charset=utf-8');

  const handleCopy = () => {
    navigator.clipboard.writeText(stripMarkdown(content)).then(() => {
      setCopyText('Copied!');
      setTimeout(() => setCopyText('Copy'), 2000);
    });
  };
  
  const handleExportClick = () => onExport(id, content);

  const getExportButtonClass = () => {
    let base = "px-2 py-1 text-xs border transition-colors disabled:cursor-not-allowed";
    if (exportState?.status === 'success') return `${base} bg-green-500/20 border-green-500 text-green-300`;
    if (exportState?.status === 'error') return `${base} bg-red-500/20 border-red-500 text-red-300`;
    return `${base} bg-[#2E2E2E] text-[#B2D3DE] border-[#575757] hover:bg-[#575757] hover:text-[#FAFAFA]`;
  };
  
  const getExportButtonText = () => {
    if (exportState?.inProgress) return 'Saving...';
    if (exportState?.status === 'success') return 'Saved!';
    if (exportState?.status === 'error') return 'Error';
    return `Save to ${storageProvider?.charAt(0).toUpperCase()}${storageProvider?.slice(1)}`;
  };

  return (
    <div className="mt-4 flex items-center justify-start gap-2 flex-wrap">
      <button onClick={handleCopy} className="px-2 py-1 text-xs bg-[#2E2E2E] text-[#B2D3DE] border border-[#575757] hover:bg-[#575757] hover:text-[#FAFAFA] transition-colors">{copyText}</button>
      <button onClick={handleDownloadTxt} className="px-2 py-1 text-xs bg-[#2E2E2E] text-[#B2D3DE] border border-[#575757] hover:bg-[#575757] hover:text-[#FAFAFA] transition-colors">Download .txt</button>
      <button onClick={handleDownloadMd} className="px-2 py-1 text-xs bg-[#2E2E2E] text-[#B2D3DE] border border-[#575757] hover:bg-[#575757] hover:text-[#FAFAFA] transition-colors">Download .md</button>
      {storageProvider && <button onClick={handleExportClick} className={getExportButtonClass()} disabled={exportState?.inProgress}>{getExportButtonText()}</button>}
    </div>
  );
};


export const MessageBox: React.FC<MessageBoxProps> = (props) => {
  const { message, onFeedback, isLoading } = props;
  const { id, role, content, isError, isFeedbackPending, toolCall, uploadedImage, generatedImages, isThinking, groundingChunks } = message;
  const isUser = role === 'user';
  
  const handleFeedbackClick = (approved: boolean) => {
    onFeedback(id, approved);
  }

  const baseClasses = 'flex items-start space-x-4 w-full';
  
  const contentClasses = isError 
    ? "prose prose-invert max-w-none text-[#E05047]" 
    : "prose prose-invert max-w-none text-[#EFF5F6]";

  const ImageGrid: React.FC<{ images: string[] }> = ({ images }) => (
    <div className="grid grid-cols-1 gap-2 mt-2">
      {images.map((imgData, index) => (
        <img key={index} src={`data:image/png;base64,${imgData}`} alt={`Generated image ${index + 1}`} className="max-w-full h-auto rounded-md border-2 border-[#575757]" />
      ))}
    </div>
  );

  return (
    <div className={baseClasses}>
      <div className="flex-shrink-0 pt-1">
        {isUser ? <UserIcon /> : <ModelIcon />}
      </div>
      <div className="flex-grow">
        <div className={contentClasses}>
           {uploadedImage && (
             <img src={`data:image/${uploadedImage.mimeType};base64,${uploadedImage.data}`} alt="User upload" className="max-w-xs h-auto rounded-md mb-2 border-2 border-[#575757]" />
           )}
           {isUser ? <p>{content}</p> : (
            isFeedbackPending && toolCall ? (
              <CreativeConceptBox toolCall={toolCall} onFeedback={handleFeedbackClick} />
            ) : (
            <>
              {generatedImages && <ImageGrid images={generatedImages} />}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => <h1 className="font-headline text-2xl font-bold mt-8 mb-4 text-[#71C9C5]" {...props} />,
                  h2: ({node, ...props}) => <h2 className="font-headline text-xl font-bold mt-6 mb-3 text-[#71C9C5]" {...props} />,
                  h3: ({node, ...props}) => <h3 className="font-headline text-lg font-bold mt-4 mb-2 text-[#71C9C5]" {...props} />,
                  strong: ({node, ...props}) => <strong className="text-[#FAFAFA]" {...props} />,
                  code: ({node, inline, ...props}: any) => inline ?
                    <code className="bg-[#2E2E2E] text-[#F37D59] px-1 py-0.5 rounded-sm text-sm" {...props} /> :
                    <pre className="bg-[#2E2E2E]/50 p-2 rounded-md"><code className="text-[#EFF5F6]" {...props} /></pre>,
                  a: ({node, ...props}) => <a className="text-[#71C9C5] hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                }}
              >
                {content}
              </ReactMarkdown>
            </>
            )
           )}
          {!isUser && isLoading && content === '' && !toolCall && <span className="blinking-cursor text-[#FACA78]">▋</span>}
          {isThinking && <div className="text-sm text-[#FACA78] text-glow mt-2">Thinking...</div>}

          {groundingChunks && groundingChunks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#57575y]/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#B2D3DE]/80 mb-2">Sources:</h4>
              <ul className="list-none space-y-1 pl-0">
                {groundingChunks.map((chunk, index) => (
                  <li key={chunk.web.uri} className="text-xs leading-tight">
                    <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-[#71C9C5] hover:underline flex items-start gap-2">
                      <span className="flex-shrink-0 mt-0.5">[{index + 1}]</span>
                      <span className="flex-grow break-all">{chunk.web.title || chunk.web.uri}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <MessageActions {...props} />
      </div>
    </div>
  );
};
