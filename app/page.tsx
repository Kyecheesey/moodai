"use client"

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react"
import { signIn, signOut, useSession } from "next-auth/react"

type Language = "en" | "af"

type Message = {
  role: "user" | "assistant"
  content: string
}

type CopySet = {
  weatherFallback: string
  appTitle: string
  appSubtitle: string
  signInTitle: string
  signInText: string
  signInButton: string
  checkingSession: string
  welcomeUser: string
  signOut: string
  chatIntroTitle: string
  chatIntro: string
  composerPlaceholder: string
  sendButton: string
  sendingButton: string
  quickQuestions: string[]
  loadingReply: string
  errorFallback: string
  newChat: string
  tips: string
  youLabel: string
  emptyTitle: string
  emptyBody: string
}

const copy: Record<Language, CopySet> = {
  en: {
    weatherFallback: "Gold Coast weather",
    appTitle: "Mood AI",
    appSubtitle: "Mood & Mind Centre Clinician Portal",
    signInTitle: "Secure clinician access",
    signInText:
      "Sign in with your clinic Google account to open the secure Mood AI portal.",
    signInButton: "Continue with Google",
    checkingSession: "Checking your clinician session...",
    welcomeUser: "Welcome",
    signOut: "Sign out",
    chatIntroTitle: "Clinician workspace",
    chatIntro:
      "Ask about policies, onboarding, billing, room processes, forms, and clinic procedures.",
    composerPlaceholder: "Ask Mood AI about a clinic process, policy, or form...",
    sendButton: "Send",
    sendingButton: "Thinking...",
    quickQuestions: [
      "What onboarding forms are required?",
      "How do I onboard a WorkCover client?",
      "What do I do before a first session?",
      "Where can I find cancellation policy guidance?"
    ],
    loadingReply: "Mood AI is checking the clinic knowledge base...",
    errorFallback: "Something went wrong. Please try again.",
    newChat: "New chat",
    tips: "Enter to send, Shift + Enter for a new line",
    youLabel: "You",
    emptyTitle: "How can I help today?",
    emptyBody:
      "Search internal clinic knowledge, onboarding guidance, billing processes, and operational procedures."
  },
  af: {
    weatherFallback: "Gold Coast weer",
    appTitle: "Mood AI",
    appSubtitle: "Mood & Mind Centre Kliniese Portaal",
    signInTitle: "Veilige kliniese toegang",
    signInText:
      "Meld aan met jou kliniek Google rekening om die veilige Mood AI portaal oop te maak.",
    signInButton: "Gaan voort met Google",
    checkingSession: "Besig om jou kliniese sessie na te gaan...",
    welcomeUser: "Welkom",
    signOut: "Meld af",
    chatIntroTitle: "Kliniese werkruimte",
    chatIntro:
      "Vra oor beleide, onboarding, fakturering, kamerporsesse, vorms, en kliniek prosedures.",
    composerPlaceholder: "Vra vir Mood AI oor 'n kliniek proses, beleid, of vorm...",
    sendButton: "Stuur",
    sendingButton: "Dink...",
    quickQuestions: [
      "Watter onboarding vorms is nodig?",
      "Hoe onboard ek 'n WorkCover kliënt?",
      "Wat doen ek voor 'n eerste sessie?",
      "Waar vind ek die kansellasiebeleid?"
    ],
    loadingReply: "Mood AI gaan deur die kliniek kennisbasis...",
    errorFallback: "Iets het verkeerd geloop. Probeer asseblief weer.",
    newChat: "Nuwe klets",
    tips: "Enter om te stuur, Shift + Enter vir 'n nuwe lyn",
    youLabel: "Jy",
    emptyTitle: "Hoe kan ek vandag help?",
    emptyBody:
      "Soek interne kliniek kennis, onboarding leiding, fakturering prosesse, en operasionele prosedures."
  }
}

const initialMessages: Record<Language, Message[]> = {
  en: [
    {
      role: "assistant",
      content:
        "Hi, I’m Mood AI. I can help with clinic procedures, onboarding, billing, forms, and internal guidance."
    }
  ],
  af: [
    {
      role: "assistant",
      content:
        "Hallo, ek is Mood AI. Ek kan help met kliniek prosedures, onboarding, fakturering, vorms, en interne leiding."
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

        if (!response.ok) throw new Error("Weather request failed")

        const data: { temperatureC?: number } = await response.json()

        if (active && typeof data.temperatureC === "number") {
          setGoldCoastTemperature(data.temperatureC)
        }
      } catch {
        if (active) setGoldCoastTemperature(null)
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

  const weatherLabel = useMemo(() => {
    if (goldCoastTemperature === null) return ui.weatherFallback
    return `Gold Coast ${Math.round(goldCoastTemperature)}°C`
  }, [goldCoastTemperature, ui.weatherFallback])

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage)
    setInput("")
    setMessages(initialMessages[nextLanguage])
  }

  function startNewChat() {
    setInput("")
    setMessages(initialMessages[language])
  }

  async function ask(questionText?: string) {
    const finalQuestion = (questionText ?? input).trim()

    if (!finalQuestion || loading) return

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
      const message = error instanceof Error ? error.message : ui.errorFallback

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
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-2xl bg-white/10" />
          <p className="text-sm text-white/70">{ui.checkingSession}</p>
        </div>
      </main>
    )
  }

  if (!session?.user) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-6">
        <section className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#111111] p-8 shadow-2xl">
          <div className="mb-6 flex items-center justify-between">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              {weatherLabel}
            </span>

            <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
              <button
                className={`rounded-full px-3 py-1.5 text-sm ${
                  language === "en" ? "bg-white text-black" : "text-white/70"
                }`}
                onClick={() => changeLanguage("en")}
                type="button"
              >
                English
              </button>
              <button
                className={`rounded-full px-3 py-1.5 text-sm ${
                  language === "af" ? "bg-white text-black" : "text-white/70"
                }`}
                onClick={() => changeLanguage("af")}
                type="button"
              >
                Afrikaans
              </button>
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black text-lg font-semibold">
              M
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">{ui.appTitle}</h1>
            <p className="mt-2 text-sm text-white/50">{ui.appSubtitle}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-lg font-medium">{ui.signInTitle}</p>
            <p className="mt-2 text-sm leading-6 text-white/70">{ui.signInText}</p>

            <button
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90"
              onClick={() => signIn("google")}
              type="button"
            >
              {ui.signInButton}
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-white/10 bg-[#0f0f10] p-5 lg:flex lg:flex-col">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-black">
                M
              </div>
              <div>
                <h1 className="text-lg font-semibold">{ui.appTitle}</h1>
                <p className="text-xs text-white/45">{ui.appSubtitle}</p>
              </div>
            </div>

            <button
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm transition hover:bg-white/10"
              onClick={startNewChat}
              type="button"
            >
              {ui.newChat}
            </button>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/40">{ui.chatIntroTitle}</p>
              <p className="mt-2 text-sm leading-6 text-white/70">{ui.chatIntro}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/40">Live</p>
              <p className="mt-2 text-sm text-white/70">{weatherLabel}</p>
            </div>
          </div>

          <div className="mt-auto">
            <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/40">{ui.welcomeUser}</p>
              <p className="mt-2 font-medium">{displayName(session.user.name, session.user.email)}</p>
              <p className="mt-1 text-xs text-white/45">{session.user.email}</p>
            </div>

            <button
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition hover:bg-white/10"
              onClick={() => signOut()}
              type="button"
            >
              {ui.signOut}
            </button>
          </div>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0a0a]/90 px-4 py-4 backdrop-blur md:px-6">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{ui.appTitle}</h2>
                <p className="text-xs text-white/45">{ui.appSubtitle}</p>
              </div>

              <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
                <button
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    language === "en" ? "bg-white text-black" : "text-white/70"
                  }`}
                  onClick={() => changeLanguage("en")}
                  type="button"
                >
                  English
                </button>
                <button
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    language === "af" ? "bg-white text-black" : "text-white/70"
                  }`}
                  onClick={() => changeLanguage("af")}
                  type="button"
                >
                  Afrikaans
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 md:px-6">
            <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
              {messages.length <= 1 ? (
                <div className="mb-6 rounded-[28px] border border-white/10 bg-white/5 p-8">
                  <h3 className="text-3xl font-semibold tracking-tight">{ui.emptyTitle}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">{ui.emptyBody}</p>

                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {ui.quickQuestions.map((item) => (
                      <button
                        key={item}
                        onClick={() => ask(item)}
                        type="button"
                        disabled={loading}
                        className="rounded-2xl border border-white/10 bg-[#111111] px-4 py-4 text-left text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-60"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex-1 space-y-6 overflow-y-auto pb-6">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-3xl ${message.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                      <div className="mb-2 px-1 text-xs uppercase tracking-wide text-white/35">
                        {message.role === "assistant" ? ui.appTitle : ui.youLabel}
                      </div>
                      <div
                        className={`rounded-[24px] px-5 py-4 text-sm leading-7 shadow-lg ${
                          message.role === "user"
                            ? "bg-white text-black"
                            : "border border-white/10 bg-[#111111] text-white"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-3xl">
                      <div className="mb-2 px-1 text-xs uppercase tracking-wide text-white/35">
                        {ui.appTitle}
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-[#111111] px-5 py-4 text-sm text-white/70">
                        {ui.loadingReply}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="sticky bottom-0 mt-4">
                <div className="rounded-[28px] border border-white/10 bg-[#111111] p-3 shadow-2xl">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={ui.composerPlaceholder}
                    rows={3}
                    className="w-full resize-none bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-white/30"
                  />

                  <div className="flex items-center justify-between gap-4 border-t border-white/10 px-2 pt-3">
                    <span className="text-xs text-white/35">{ui.tips}</span>

                    <button
                      className="rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
                      type="submit"
                      disabled={loading || !input.trim()}
                    >
                      {loading ? ui.sendingButton : ui.sendButton}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}