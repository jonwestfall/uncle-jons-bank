import { useEffect, useState } from 'react'
import { useToast } from '../components/ToastProvider'

interface Props {
  token: string
  apiUrl: string
}

interface QuizQuestion {
  id: number
  prompt: string
  options: string[]
}

interface Module {
  id: number
  title: string
  content: string
  questions: QuizQuestion[]
  badge_earned: boolean
}

export default function ChildBank101({ token, apiUrl }: Props) {
  const [modules, setModules] = useState<Module[]>([])
  const [answers, setAnswers] = useState<Record<number, number[]>>({})
  const [results, setResults] = useState<Record<number, { score: number; passed: boolean }>>({})
  const { showToast } = useToast()

  useEffect(() => {
    const fetchModules = async () => {
      const resp = await fetch(`${apiUrl}/education/modules`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (resp.ok) setModules(await resp.json())
    }
    fetchModules()
  }, [apiUrl, token])

  const setAnswer = (moduleId: number, qIndex: number, option: number) => {
    setAnswers(prev => {
      const moduleAnswers = prev[moduleId] ? [...prev[moduleId]] : []
      moduleAnswers[qIndex] = option
      return { ...prev, [moduleId]: moduleAnswers }
    })
  }

  const submitQuiz = async (module: Module) => {
    const resp = await fetch(`${apiUrl}/education/modules/${module.id}/quiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ answers: answers[module.id] || [] }),
    })
    if (resp.ok) {
      const data = await resp.json()
      setResults(r => ({ ...r, [module.id]: { score: data.score, passed: data.passed } }))
      if (data.badge_awarded) {
        setModules(ms => ms.map(m => (m.id === module.id ? { ...m, badge_earned: true } : m)))
        showToast('Badge earned!')
      } else if (data.passed) {
        showToast('Quiz passed')
      } else {
        showToast('Try again', 'error')
      }
    }
  }

  return (
    <div className="container">
      <h2>Bank 101</h2>
      {modules.map(m => (
        <div key={m.id} className="module">
          <h3>
            {m.title} {m.badge_earned && <span title="Badge earned">🏅</span>}
          </h3>
          <p className="help-text">{m.content}</p>
          {m.questions.map((q, qi) => (
            <div key={q.id} className="question">
              <p>
                {qi + 1}. {q.prompt}
              </p>
              {q.options.map((opt, oi) => (
                <label key={oi} style={{ display: 'block' }}>
                  <input
                    type="radio"
                    name={`m${m.id}q${qi}`}
                    checked={answers[m.id]?.[qi] === oi}
                    onChange={() => setAnswer(m.id, qi, oi)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          ))}
          <button onClick={() => submitQuiz(m)}>Submit Quiz</button>
          {results[m.id] && (
            <p>
              Score: {results[m.id].score}/{m.questions.length}{' '}
              {results[m.id].passed ? '- Passed!' : '- Try again'}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
