
import { GoogleGenAI, type FunctionDeclaration, Type, type Content, type FunctionCall, Modality, type Part } from "@google/genai";
import type { Mode, Brandscape, Message, ImageEditMode } from '../types';
import { CORE_SYSTEM_PROMPT, MODE_INSTRUCTIONS } from '../constants';
import * as vectorDB from './vectorDBService';
import { readGoogleDoc } from './googleDocsService';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const presentCreativeConceptTool: FunctionDeclaration = {
    name: 'presentCreativeConcept',
    description: 'Presents a single, high-level creative concept to the user for feedback. Used in CREATIVE_IDEATION mode.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            conceptName: { type: Type.STRING, description: 'A short, catchy name for the concept.' },
            description: { type: Type.STRING, description: 'A one or two-sentence description.' },
            palette: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of 3 to 5 hex color codes.' }
        },
        required: ['conceptName', 'description', 'palette']
    }
};

const readGoogleDocTool: FunctionDeclaration = {
    name: 'readGoogleDoc',
    description: 'Reads the text content of a publicly accessible Google Document from a given URL.',
    parameters: {
        type: Type.OBJECT,
        properties: { url: { type: Type.STRING, description: 'The public URL of the Google Document.' } },
        required: ['url']
    }
};


const mapHistoryToContents = (history: Message[]): Content[] => {
    const contents: Content[] = [];
    for (const msg of history) {
        if (msg.role === 'model' && msg.toolCall) {
            contents.push({ role: 'model', parts: [{ functionCall: msg.toolCall }] });
        } else if (msg.role === 'tool' && msg.toolResult) {
            contents.push({
                role: 'tool',
                parts: [{ functionResponse: { name: msg.toolResult.name, response: msg.toolResult.response } }]
            });
        } else {
            // FIX: Explicitly type `parts` as `Part[]` to allow it to hold both text and inlineData objects,
            // preventing a TypeScript error where the array type was too narrowly inferred.
            let parts: Part[] = [{ text: msg.content }];
            if (msg.role === 'user' && msg.uploadedImage) {
                parts = [
                    {
                        inlineData: {
                            mimeType: msg.uploadedImage.mimeType,
                            data: msg.uploadedImage.data,
                        },
                    },
                    ...parts,
                ];
            }
            contents.push({ role: msg.role === 'model' ? 'model' : 'user', parts });
        }
    }
    return contents;
};

const getSystemInstruction = (mode: Mode, useVectorDB: boolean, brandscape: Brandscape | null, prompt: string) => {
    const modeInstruction = MODE_INSTRUCTIONS[mode];
    const personaPrompt = brandscape ? `PERSONA CONTEXT:\n---\n- Five Words: ${brandscape.fiveWords}\n- Inspirations: ${brandscape.inspirations}\n- Voice Description: ${brandscape.voiceDescription}\n---\n` : '';
    // RAG context is now generated inside the function if needed
    return `${CORE_SYSTEM_PROMPT}\n\n${modeInstruction}\n\n${personaPrompt}`;
}

// Main chat function for text-based modes and image analysis
export async function* streamChatResponse(
    history: Message[],
    mode: Mode,
    useVectorDB: boolean,
    brandscape: Brandscape | null
): AsyncGenerator<{ text?: string; toolCall?: FunctionCall; isThinking?: boolean; groundingChunks?: any[] }> {

    const latestUserMessage = history[history.length - 1];
    let ragContext = '';
    if (useVectorDB && latestUserMessage?.role === 'user') {
        try {
            ragContext = await vectorDB.query(latestUserMessage.content);
        } catch (e) { console.error("Failed to query vector DB", e); }
    }
    const ragPrompt = ragContext ? `INTERNAL CONTEXT:\n---\n${ragContext}\n---\n` : '';
    const systemInstruction = `${getSystemInstruction(mode, useVectorDB, brandscape, latestUserMessage?.content || '')}\n\n${ragPrompt}`;

    const modelConfig = {
        'COPYWRITING': { model: 'gemini-2.5-flash', config: {} },
        'STRATEGY': { model: 'gemini-2.5-pro', config: { thinkingConfig: { thinkingBudget: 32768 } } },
        'VISUAL_QA': { model: 'gemini-2.5-flash', config: {} },
        'CREATIVE_IDEATION': { model: 'gemini-2.5-pro', config: {} },
        'RESEARCH': { model: 'gemini-2.5-flash', config: {} }
    };

    const { model, config } = modelConfig[mode];
    const contents = mapHistoryToContents(history);

    let tools: any[] | undefined = undefined;
    if (mode === 'RESEARCH') {
      tools = [{ googleSearch: {} }];
    } else {
      const functionDeclarations = [readGoogleDocTool];
      if (mode === 'CREATIVE_IDEATION') {
        functionDeclarations.push(presentCreativeConceptTool);
      }
      tools = [{ functionDeclarations }];
    }

    try {
        if (mode === 'STRATEGY') {
            yield { isThinking: true };
        }
        
        const result = await ai.models.generateContentStream({
            model: model,
            contents: contents,
            config: {
                ...config,
                tools: tools,
                systemInstruction: systemInstruction,
            },
        });

        if (mode === 'STRATEGY') {
            yield { isThinking: false };
        }

        let functionCallToProcess: FunctionCall | null = null;
        let allGroundingChunks: any[] = [];

        for await (const chunk of result) {
            if (chunk.text) yield { text: chunk.text };
            if (chunk.functionCalls?.length) functionCallToProcess = chunk.functionCalls[0];
            const grounding = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (grounding) {
                allGroundingChunks.push(...grounding);
            }
        }

        if (allGroundingChunks.length > 0) {
            const uniqueChunks = Array.from(new Map(allGroundingChunks.map(item => [item.web.uri, item])).values());
            yield { groundingChunks: uniqueChunks };
        }

        if (functionCallToProcess) {
            // Internal tool call for Google Docs
            if (functionCallToProcess.name === 'readGoogleDoc') {
                yield { text: '\n\n*Reading Google Document...*\n' };
                const url = functionCallToProcess.args.url as string;
                const docData = await readGoogleDoc(url);
                const newHistory = [...contents, { role: 'model', parts: [{ functionCall: functionCallToProcess }] }, { role: 'tool', parts: [{ functionResponse: { name: 'readGoogleDoc', response: docData } }] }];
                yield { text: `*Document analysis complete. Generating response...*\n\n` };
                const finalResult = await ai.models.generateContentStream({ model, contents: newHistory, config: { tools, systemInstruction } });
                for await (const finalChunk of finalResult) {
                    if (finalChunk.text) yield { text: finalChunk.text };
                }
            } else { // UI-facing tool call
                yield { toolCall: functionCallToProcess };
            }
        }

    } catch (error) {
        console.error("Gemini API error:", error);
        yield { text: "An error occurred while communicating with the AI model." };
    }
}

// New function for image generation
export const generateImage = async (prompt: string, aspectRatio: string): Promise<string[]> => {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: aspectRatio as any,
                outputMimeType: 'image/png'
            }
        });
        return response.generatedImages.map(img => img.image.imageBytes);
    } catch (error) {
        console.error("Image generation failed:", error);
        throw error;
    }
};

// New function for image editing
export const editImage = async (prompt: string, image: { data: string, mimeType: string }): Promise<string[]> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: image.data, mimeType: image.mimeType } },
                    { text: prompt }
                ]
            },
            config: {
                responseModalities: [Modality.IMAGE],
            }
        });
        
        const images: string[] = [];
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                images.push(part.inlineData.data);
            }
        }
        return images;

    } catch (error) {
        console.error("Image editing failed:", error);
        throw error;
    }
};