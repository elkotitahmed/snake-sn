import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface BotDecision {
  botId: string;
  targetAngle: number;
  isBoosting: boolean;
}

export const getBotDecisions = async (
  playerPos: { x: number; y: number },
  bots: { id: string; x: number; y: number; angle: number; score: number }[],
  foods: { x: number; y: number; value: number }[],
  worldSize: number
): Promise<Record<string, { angle: number; boost: boolean }>> => {
  // إذا لم يوجد مفتاح API، أرجع قرارات عشوائية (حتى لا تتعطل اللعبة)
  if (!ai) {
    console.warn("Gemini API key missing. Returning random decisions.");
    const randomDecisions: Record<string, { angle: number; boost: boolean }> = {};
    bots.forEach(bot => {
      randomDecisions[bot.id] = {
        angle: Math.random() * Math.PI * 2,
        boost: false,
      };
    });
    return randomDecisions;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // استخدم نموذجاً مستقراً بدلاً من gemini-3-flash-preview
      contents: `
        You are controlling multiple bot snakes in a slither.io style game.
        World Size: ${worldSize}x${worldSize}
        Player Position: x=${Math.round(playerPos.x)}, y=${Math.round(playerPos.y)}
        
        Bots:
        ${bots.map(b => `ID: ${b.id}, Pos: (${Math.round(b.x)}, ${Math.round(b.y)}), Angle: ${b.angle.toFixed(2)}, Score: ${Math.round(b.score)}`).join('\n')}
        
        Nearby Food:
        ${foods.slice(0, 10).map(f => `Pos: (${Math.round(f.x)}, ${Math.round(f.y)}), Value: ${f.value}`).join('\n')}
        
        Task: For each bot, provide an optimal target angle (0 to 2*PI) to either collect food, avoid the player, or trap the player. 
        Also decide if the bot should boost (only if score > 20).
        Return ONLY a JSON object where keys are bot IDs and values are { "angle": number, "boost": boolean }.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: bots.reduce((acc, bot) => ({
            ...acc,
            [bot.id]: {
              type: Type.OBJECT,
              properties: {
                angle: { type: Type.NUMBER },
                boost: { type: Type.BOOLEAN }
              },
              required: ["angle", "boost"]
            }
          }), {})
        }
      }
    });

    const text = response.text;
    if (!text) return {};
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini AI Bot Decision Error:", error);
    return {};
  }
};