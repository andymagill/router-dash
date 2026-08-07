export interface PromptPreset {
  id: string
  label: string
  description: string
  system: string
  prompt: string
}

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "code-refactor",
    label: "Code Refactor",
    description: "Improve a messy function",
    system:
      "You are a senior software engineer. Refactor code for readability, performance, and correctness. Explain the key changes briefly, then return the improved code in a single fenced code block.",
    prompt:
      "Refactor this JavaScript function and explain your changes:\n\n```js\nfunction f(a){var r=[];for(var i=0;i<a.length;i++){if(a[i]%2==0){r.push(a[i]*a[i])}}return r}\n```",
  },
  {
    id: "json-extraction",
    label: "JSON Extraction",
    description: "Structured data from text",
    system:
      "You are a precise data-extraction engine. Respond with ONLY valid minified JSON matching the requested schema. No prose, no markdown fences.",
    prompt:
      'Extract the fields {name, role, company, email} from this text as JSON:\n\n"Hi, I\'m Dana Whitfield, the VP of Engineering over at Northwind Labs. You can reach me at dana.w@northwind.io anytime."',
  },
  {
    id: "edge-case",
    label: "Edge Case Testing",
    description: "Probe reasoning limits",
    system:
      "You are a meticulous reasoning assistant. Think step by step and clearly state any assumptions before giving a final answer.",
    prompt:
      "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost? Show your reasoning.",
  },
  {
    id: "creative",
    label: "Creative Brief",
    description: "Tone & style comparison",
    system:
      "You are a witty senior copywriter with a knack for punchy, memorable lines.",
    prompt:
      "Write a 2-sentence product tagline and a short launch tweet for a developer tool that benchmarks LLMs side by side.",
  },
]
