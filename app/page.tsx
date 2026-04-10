"use client"

import { FormEvent, KeyboardEvent, useEffect, useState } from "react"
import { signIn, signOut, useSession } from "next-auth/react"

type Language = "en" | "af"

type Message = {
  role: "user" | "assistant"
  content: string
}

type CopySet = {
  weatherFallback: string
  appTitle: string
  signInTitle: string
  signInText: string
  signInButton: string
  checkingSession: string
  welcomeUser: string
  signOut: string
  chatIntro: string
  composerPlaceholder: string
  sendButton: string
  sendingButton: string
  quickQuestions: string[]
  loadingReply: string
  errorFallback: string
}

const copy: Record<Language, CopySet> = {
  en: {
    weatherFallback: "Gold Coast weather",
    appTitle: "MoodAi",
    signInTitle: "Mood & Mind Centre",
    signInText:
      "Sign in with your clinic Google account to open the secure MoodAi clinician portal.",
    signInButton: "Continue with Google",
    checkingSession: "Checking your clinician session...",
    welcomeUser: "Welcome",
    signOut: "Sign out",
    chatIntro:
      "Ask about forms, onboarding, billing, or internal procedures. MoodAi will answer from the clinic knowledge base.",
    composerPlaceholder:
      "Ask MoodAi something...",
    sendButton: "Send",
    sendingButton: "Thinking...",
    quickQuestions: [
      "What onboarding forms are required?",
      "How do I onboard a WorkCover client?",
      "What do I do before a first session?"
    ],
    loadingReply: "MoodAi is checking the clinic files and preparing a reply...",
    errorFallback: "Something went wrong. Please try again."
  },
  af: {
    weatherFallback: "Gold Coast weer",
    appTitle: "MoodAi",
    signInTitle: "Mood & Mind Centre",
    signInText:
      "Meld aan met jou kliniek se Google-rekening om die veilige MoodAi kliniese portaal oop te maak.",
    signInButton: "Gaan voort met Google",
    checkingSession: "Besig om jou kliniese sessie na te gaan...",
    welcomeUser: "Welkom",
    signOut: "Meld af",
    chatIntro:
      "Vra oor vorms, onboarding, fakturering of interne prosedures. MoodAi antwoord uit die kliniek se kennisbasis.",
    composerPlaceholder: "Vra vir MoodAi iets...",
    sendButton: "Stuur",
    sendingButton: "Dink...",
    quickQuestions: [
      "Watter onboarding-vorms is nodig?",
      "Hoe onboard ek 'n WorkCover-kliënt?",
      "Wat doen ek voor 'n eerste sessie?"
    ],
    loadingReply: "MoodAi gaan deur die kliniek lêers en berei 'n antwoord voor...",
    errorFallback: "Iets het verkeerd geloop. Probeer asseblief weer."
  }
}

const initialMessages: Record<Language, Message[]> = {
  en: [
    {
      role: "assistant",
      content:
        "Hi, I’m MoodAi. Ask me about procedures, billing, onboarding, or clinic admin."
    }
  ],
  af: [
    {
      role: "assistant",
      content:
        "Hallo, ek is MoodAi. Vra my oor prosedures, fakturering, onboarding of kliniekadministrasie."
    }
  ]
}

function displayName(name?: string | null, email?: string | null) {
  return name || email || "Clinician"
}

export default function Home() {
  const { data: session, status } = useSession()
  const [language, setLanguage] = useState<Language>("en")
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>(initialMessages.en)
  const [goldCoastTemperature, setGoldCoastTemperature] = useState<number | null>(null)
  const ui = copy[language]

  useEffect(() => {
    let active = true

    async function loadWeather() {
      try {
        const response = await fetch("/api/gold-coast-weather", {
          cache: "no-store"
        })

        if (!response.ok) {
          throw new Error("Weather request failed")
        }

        const data: { temperatureC?: number } = await response.json()

        if (active && typeof data.temperatureC === "number") {
          setGoldCoastTemperature(data.temperatureC)
        }
      } catch {
        if (active) {
          setGoldCoastTemperature(null)
        }
      }
    }

    void loadWeather()
    const timer = window.setInterval(() => {
      void loadWeather()
    }, 10 * 60 * 1000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const weatherLabel =
    goldCoastTemperature === null
      ? ui.weatherFallback
      : `Gold Coast ${Math.round(goldCoastTemperature)}°C`

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage)
    setInput("")
    setMessages(initialMessages[nextLanguage])
  }

  async function ask(questionText?: string) {
    const finalQuestion = (questionText ?? input).trim()

    if (!finalQuestion || loading) {
      return
    }

    const userMessage: Message = {
      role: "user",
      content: finalQuestion
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: finalQuestion,
          language,
          history: nextMessages.slice(-4)
        })
      })

      const text = await res.text()

      let data: { answer?: string; error?: string } = {}
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(text || ui.errorFallback)
      }

      if (!res.ok) {
        throw new Error(data.error || ui.errorFallback)
      }

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: data.answer || ui.errorFallback
        }
      ])
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : ui.errorFallback

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: message
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void ask()
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void ask()
    }
  }

  if (status === "loading") {
    return (
      <main className="workspace-shell workspace-center">
        <div className="workspace-auth-card">{ui.checkingSession}</div>
      </main>
    )
  }

  if (!session?.user) {
    return (
      <main className="workspace-shell workspace-center">
        <section className="workspace-auth-card">
          <div className="workspace-auth-top">
            <span className="workspace-clinic-pill">{weatherLabel}</span>
            <div className="workspace-language-switch">
              <button
                className={language === "en" ? "active" : ""}
                onClick={() => changeLanguage("en")}
                type="button"
              >
                English
              </button>
              <button
                className={language === "af" ? "active" : ""}
                onClick={() => changeLanguage("af")}
                type="button"
              >
                Afrikaans
              </button>
            </div>
          </div>
          <h1>{ui.appTitle}</h1>
          <p className="workspace-auth-subtitle">{ui.signInTitle}</p>
          <p className="workspace-auth-copy">{ui.signInText}</p>
          <button
            className="workspace-primary-button"
            onClick={() => signIn("google")}
            type="button"
          >
            {ui.signInButton}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="workspace-shell">
      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <div className="workspace-sidebar-top">
            <span className="workspace-clinic-pill">{weatherLabel}</span>
          </div>

          <div className="workspace-sidebar-footer">
            <div className="workspace-user-card">
              <span>{ui.welcomeUser}</span>
              <strong>{displayName(session.user.name, session.user.email)}</strong>
            </div>
            <button className="workspace-secondary-button" onClick={() => signOut()} type="button">
              {ui.signOut}
            </button>
          </div>
        </aside>

        <section className="workspace-main">
          <header className="workspace-header">
            <div className="workspace-header-leading" />
            <div className="workspace-header-brand">
              <span className="workspace-header-brand-dot" />
              <h1>{ui.appTitle}</h1>
            </div>
            <div className="workspace-language-switch workspace-language-switch-right">
              <button
                className={language === "en" ? "active" : ""}
                onClick={() => changeLanguage("en")}
                type="button"
              >
                English
              </button>
              <button
                className={language === "af" ? "active" : ""}
                onClick={() => changeLanguage("af")}
                type="button"
              >
                Afrikaans
              </button>
            </div>
          </header>

          <div className="workspace-chat-card">
            <div className="workspace-chat-intro">
              <p>{ui.chatIntro}</p>
            </div>

            <div className="workspace-suggestions">
              {ui.quickQuestions.map((item) => (
                <button key={item} onClick={() => ask(item)} type="button" disabled={loading}>
                  {item}
                </button>
              ))}
            </div>

            <div className="workspace-messages">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`workspace-message ${message.role === "user" ? "user" : "assistant"}`}
                >
                  <div className="workspace-message-label">
                    {message.role === "assistant" ? ui.appTitle : "You"}
                  </div>
                  <div className="workspace-message-bubble">{message.content}</div>
                </div>
              ))}

              {loading && (
                <div className="workspace-message assistant">
                  <div className="workspace-message-label">{ui.appTitle}</div>
                  <div className="workspace-message-bubble workspace-message-loading">
                    {ui.loadingReply}
                  </div>
                </div>
              )}
            </div>

            <form className="workspace-composer" onSubmit={handleSubmit}>
              <div className="workspace-composer-main">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={ui.composerPlaceholder}
                  rows={2}
                />
                <button
                  className="workspace-primary-button workspace-send-button"
                  type="submit"
                  disabled={loading || !input.trim()}
                >
                  {loading ? ui.sendingButton : ui.sendButton}
                </button>
              </div>
              <div className="workspace-composer-actions">
                <span>Enter to send, Shift+Enter for a new line</span>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
