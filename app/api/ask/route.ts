import OpenAI from "openai"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/auth"

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini"
const MAX_OUTPUT_TOKENS = 1800

type Language = "en" | "af"

type HistoryMessage = {
  role?: "user" | "assistant"
  content?: string
}

type ResponseOutputItem = {
  type?: string
  content?: Array<{
    type?: string
    text?: string | { value?: string | null } | null
    value?: string | null
  }>
  results?: Array<{
    filename?: string | null
  }> | null
}

function normaliseLanguage(value: unknown): Language {
  return value === "af" ? "af" : "en"
}

function normaliseHistory(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .slice(-4)
    .map((item) => {
      const message = item as HistoryMessage

      return {
        role: message.role === "assistant" ? "assistant" : "user",
        content: typeof message.content === "string" ? message.content.trim() : ""
      }
    })
    .filter((message) => message.content)
}

function buildConversationTranscript(history: ReturnType<typeof normaliseHistory>) {
  if (history.length === 0) {
    return ""
  }

  return history
    .map((message) => {
      const speaker = message.role === "assistant" ? "Assistant" : "Clinician"
      return `${speaker}: ${message.content}`
    })
    .join("\n")
}

function extractAnswerText(response: {
  output_text?: string | null
  output?: ResponseOutputItem[]
}) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return cleanAnswerText(response.output_text)
  }

  if (!Array.isArray(response.output)) {
    return ""
  }

  return response.output
    .flatMap((item) => (item.type === "message" && Array.isArray(item.content) ? item.content : []))
    .map((part) => {
      if (typeof part.text === "string") {
        return part.text
      }

      if (part.text && typeof part.text === "object" && typeof part.text.value === "string") {
        return part.text.value
      }

      if (typeof part.value === "string") {
        return part.value
      }

      return ""
    })
    .filter(Boolean)
    .join("\n\n")
    .trim()
}

function cleanAnswerText(text: string) {
  return text
    .replace(/filecite.*?(|$)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function extractSourceFiles(response: { output?: ResponseOutputItem[] }) {
  if (!Array.isArray(response.output)) {
    return []
  }

  const filenames = response.output
    .flatMap((item) => (item.type === "file_search_call" && Array.isArray(item.results) ? item.results : []))
    .map((result) => (typeof result.filename === "string" ? result.filename.trim() : ""))
    .filter(Boolean)

  return [...new Set(filenames)]
}

function formatAnswerWithSources(answer: string, files: string[], language: Language) {
  const cleanedAnswer = cleanAnswerText(answer)
  const heading = language === "af" ? "Bronlêers" : "Source files"
  const emptyLabel =
    language === "af" ? "- Geen ooreenstemmende lêers gevind nie" : "- No matching files found"
  const fileLines =
    files.length === 0 ? emptyLabel : files.map((file) => `- ${file}`).join("\n")
  return `${cleanedAnswer}\n\n${heading}:\n${fileLines}`
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { question, language, history } = await req.json()

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Missing question" },
        { status: 400 }
      )
    }

    const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in .env.local" },
        { status: 500 }
      )
    }

    if (!vectorStoreId) {
      return NextResponse.json(
        { error: "Missing OPENAI_VECTOR_STORE_ID in .env.local" },
        { status: 500 }
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    const selectedLanguage = normaliseLanguage(language)
    const conversationHistory = normaliseHistory(history)
    const responseLanguage =
      selectedLanguage === "af" ? "Afrikaans" : "English"
    const transcript = buildConversationTranscript(conversationHistory)

    const response = await openai.responses.create({
      model: DEFAULT_MODEL,
      instructions:
        `You are Mood AI, the secure clinician assistant for Mood & Mind Centre. Answer only using the uploaded clinic documents. Use ${responseLanguage}. Sound clear, natural, and helpful like ChatGPT. Start with the direct answer in plain language. Keep it short and useful, ideally under 120 words. Use short bullet points only when they make the answer easier to follow. If the user is asking for steps, give simple step-by-step guidance. Do not include citation markers, file identifiers, or annotation text in the visible answer. If the answer is not in the files, say clearly that you could not find it in the clinic materials.`,
      input: transcript
        ? `${transcript}\nClinician: ${question}`
        : `Clinician: ${question}`,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      include: ["file_search_call.results"],
      tools: [
        {
          type: "file_search",
          vector_store_ids: [vectorStoreId],
          max_num_results: 2
        }
      ]
    })

    const answer = extractAnswerText(response)
    const sourceFiles = extractSourceFiles(response)

    return NextResponse.json({
      answer:
        (answer
          ? formatAnswerWithSources(answer, sourceFiles, selectedLanguage)
          : "") ||
        "MoodAi could not complete a text reply for that question. Please try asking it again."
    })

  } catch (error: unknown) {
    console.error("Ask route error:", error)

    const message =
      error instanceof Error ? error.message : "Unknown server error"

    return NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    )
  }
}
