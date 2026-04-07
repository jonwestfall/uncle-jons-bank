import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '../components/ToastProvider'
import { createApiClient } from '../api/client'
import { listEducationModules, submitModuleQuiz, type EducationModule } from '../api/education'
import { toastApiError } from '../utils/apiError'

interface Props {
  token: string
  apiUrl: string
}

export default function ChildBank101({ token, apiUrl }: Props) {
  const [modules, setModules] = useState<EducationModule[]>([])
  const [answers, setAnswers] = useState<Record<number, number[]>>({})
  const [results, setResults] = useState<Record<number, { score: number; passed: boolean }>>({})
  const { showToast } = useToast()
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  const fetchModules = useCallback(async () => {
    try {
      setModules(await listEducationModules(client))
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load modules')
    }
  }, [client, showToast])

  useEffect(() => {
    fetchModules()
  }, [fetchModules])

  const setAnswer = (moduleId: number, qIndex: number, option: number) => {
    setAnswers(prev => {
      const moduleAnswers = prev[moduleId] ? [...prev[moduleId]] : []
      moduleAnswers[qIndex] = option
      return { ...prev, [moduleId]: moduleAnswers }
    })
  }

  const submitQuiz = async (module: EducationModule) => {
    try {
      const data = await submitModuleQuiz(client, module.id, answers[module.id] || [])
      setResults(r => ({ ...r, [module.id]: { score: data.score, passed: data.passed } }))
      if (data.badge_awarded) {
        setModules(ms => ms.map(m => (m.id === module.id ? { ...m, badge_earned: true } : m)))
        showToast('Badge earned!')
      } else if (data.passed) {
        showToast('Quiz passed')
      } else {
        showToast('Try again', 'error')
      }
    } catch (error) {
      toastApiError(showToast, error, 'Failed to submit quiz')
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
