
import type { FunctionCall } from '@google/genai';

export type Mode = 'COPYWRITING' | 'VISUAL_QA' | 'STRATEGY' | 'CREATIVE_IDEATION' | 'RESEARCH';
export type ImageEditMode = 'analyze' | 'edit';

export interface Message {
  id: string;
  role: 'user' | 'model' | 'tool';
  content: string;
  mode: Mode;
  isError?: boolean;
  toolCall?: FunctionCall;
  toolResult?: any;
  isFeedbackPending?: boolean;
  uploadedImage?: { data: string; mimeType: string };
  generatedImages?: string[];
  isThinking?: boolean;
  groundingChunks?: { web: { uri: string; title: string; } }[];
}

export type StorageProvider = 'google' | 'notion' | 'sharepoint';

export interface Brandscape {
    fiveWords: string;
    inspirations: string;
    voiceDescription: string;
}

export interface AttachedFile {
    name: string;
    content: string;
}

export interface OnboardingState {
    isComplete: boolean;
    storageProvider: StorageProvider | null;
    vectorDBConnected: boolean;
    brandscape: Brandscape | null;
}
