import { GoogleGenAI, Type } from '@google/genai';
import { Meditation, Message, CoherenceVector, ToolStates } from '../types.ts';

const SCRIPT_GENERATION_MODEL = 'gemini-2.5-flash';

// Define the schema for the meditation script
const meditationScriptSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Um título calmo e inspirador para a meditação.',
    },
    script: {
      type: Type.ARRAY,
      description: 'Uma série de frases para a meditação guiada.',
      items: {
        type: Type.OBJECT,
        properties: {
          text: {
            type: Type.STRING,
            description: 'O texto a ser falado para esta parte da meditação. Deve ser uma frase curta e relaxante.',
          },
          duration: {
            type: Type.NUMBER,
            description: 'A duração estimada em milissegundos que esta frase deve levar para ser dita, incluindo uma pequena pausa depois. Entre 5000 e 10000ms.',
          },
        },
        required: ['text', 'duration'],
      },
    },
  },
  required: ['title', 'script'],
};


const formatChatHistoryForPrompt = (chatHistory: Message[]): string => {
    if (!chatHistory || chatHistory.length === 0) return '';
    const recentHistory = chatHistory.slice(-6); // Get last 6 messages for context
    const formatted = recentHistory.map(msg => `${msg.sender === 'user' ? 'Usuário' : 'Mentor'}: ${msg.text}`).join('\n');
    return `\n\n--- Histórico da Conversa Recente para Contexto ---\n${formatted}\n--- Fim do Histórico ---`;
}

export const generateMeditationScript = async (prompt: string, durationMinutes: number, chatHistory?: Message[]): Promise<Meditation> => {
  try {
    // Instantiate client right before the call to use the latest key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const historyContext = chatHistory ? formatChatHistoryForPrompt(chatHistory) : '';

    const fullPrompt = `Você é um mestre em jornadas sensoriais, um poeta da consciência. Sua missão é criar um roteiro de meditação guiada com base no tema: "${prompt}".
A meditação deve ter aproximadamente ${durationMinutes} minutos de duração.
Inspire-se profundamente no estilo poético, sensorial e metafórico do texto "A Sinfonia do Despertar". Use imagens como "colchão de nuvens", "respiração como folhas em um riacho", "energia leve e paz profunda", e a sensação do "peso do corpo se render".
O roteiro deve ser uma série de frases curtas e relaxantes.
A resposta DEVE estar em formato JSON e seguir o schema fornecido.
O idioma deve ser Português do Brasil.
${historyContext}
`;

    const response = await ai.models.generateContent({
      model: SCRIPT_GENERATION_MODEL,
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: meditationScriptSchema,
      },
    });

    const jsonText = response.text.trim();
    const cleanJsonText = jsonText.startsWith('```json') ? jsonText.replace(/```json\n?/, '').replace(/```$/, '') : jsonText;
    
    const parsedResponse = JSON.parse(cleanJsonText);
    
    if (!parsedResponse.title || !Array.isArray(parsedResponse.script)) {
        throw new Error("Invalid script format received from API.");
    }

    return {
      id: `gemini-meditation-${Date.now()}`,
      ...parsedResponse,
    };

  } catch (error) {
    console.error('Error generating meditation script:', error);
    throw error;
  }
};

/**
 * Summarizes a chat history to create a concise meditation intention.
 * @param chatHistory The chat history to analyze.
 * @returns A promise that resolves to a concise sentence for the meditation prompt.
 */
export const summarizeChatForMeditation = async (chatHistory: Message[], coherenceVector: CoherenceVector, toolStates: ToolStates): Promise<string> => {
    if (!chatHistory || chatHistory.length === 0) {
        return '';
    }
    
    try {
        // Instantiate client right before the call to use the latest key
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const historyString = chatHistory.map(msg => `${msg.sender === 'user' ? 'Usuário' : 'Mentor'}: ${msg.text}`).join('\n');

        let toolContext = '';
        if (toolStates.dissonanceAnalysis?.result) {
            toolContext += `\n- **Análise de Dissonância Recente:** O padrão de '${toolStates.dissonanceAnalysis.result.padrao}' foi identificado, relacionado ao tema de '${toolStates.dissonanceAnalysis.result.tema}'.`;
        }
        if (toolStates.therapeuticJournal?.currentFeedback) {
            toolContext += `\n- **Feedback do Diário Recente:** O usuário está trabalhando na dissonância de '${toolStates.therapeuticJournal.currentFeedback.dissonancia}'.`;
        }


        const vectorContext = `\n\nContexto Adicional do Estado do Usuário (0-100, Coerência/Dissonância):
        - Propósito: ${coherenceVector.proposito.coerencia}/${coherenceVector.proposito.dissonancia}
        - Mental: ${coherenceVector.mental.coerencia}/${coherenceVector.mental.dissonancia}
        - Relacional: ${coherenceVector.relacional.coerencia}/${coherenceVector.relacional.dissonancia}
        - Emocional: ${coherenceVector.emocional.coerencia}/${coherenceVector.emocional.dissonancia} (Dissonância é o nível de caos interno)
        - Somático: ${coherenceVector.somatico.coerencia}/${coherenceVector.somatico.dissonancia}
        - Ético-Ação: ${coherenceVector.eticoAcao.coerencia}/${coherenceVector.eticoAcao.dissonancia}
        - Recursos: ${coherenceVector.recursos.coerencia}/${coherenceVector.recursos.dissonancia}
        ${toolContext ? `\n**Insights de Ferramentas:**${toolContext}` : ''}
        
        A intenção da meditação deve sutilmente abordar a área de menor pontuação (ou maior dissonância emocional) e os insights das ferramentas, se disponíveis.`;


        const prompt = `
            Analise o seguinte histórico de conversa e o estado de coerência do usuário.
            Extraia os temas centrais, as dores, os desejos e as palavras-chave mais importantes.
            Com base nessa análise completa, sintetize uma única frase concisa e inspiradora que sirva como uma "intenção" para uma meditação guiada.
            A frase deve capturar a essência da necessidade atual do usuário, considerando a conversa, seu estado de coerência e, crucialmente, os insights das outras ferramentas.
            ${vectorContext}

            Exemplos:
            - Se a conversa é sobre ansiedade e a Dissonância Emocional está alta, a intenção poderia ser: "Encontrar a paz no momento presente e confiar no fluxo da vida."
            - Se a Análise de Dissonância encontrou "Medo da Escassez", a intenção poderia ser: "Abrir-me para o fluxo da abundância e da confiança universal."

            Histórico da Conversa:
            ${historyString}

            Formato de Saída OBRIGATÓRIO:
            Responda APENAS com a frase da intenção, sem nenhum outro texto ou explicação.

            Intenção para Meditação:
        `;

        const response = await ai.models.generateContent({
            model: SCRIPT_GENERATION_MODEL,
            contents: prompt,
        });

        return response.text.trim();

    } catch (error) {
        console.error('Error summarizing chat for meditation:', error);
        throw error;
    }
};