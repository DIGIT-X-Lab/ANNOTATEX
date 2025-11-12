export type AssistMode = "heuristic" | "ollama";

export interface AssistConfig {
  mode: AssistMode;
  maxSuggestions: number;
  timeoutMs: number;
  ollamaHost: string;
  ollamaModel: string;
  temperature: number;
}

export const defaultAssistConfig: AssistConfig = {
  mode: "heuristic",
  maxSuggestions: 200,
  timeoutMs: 10000,
  ollamaHost: "http://localhost:11434",
  ollamaModel: "llama3.2:3b",
  temperature: 0,
};
