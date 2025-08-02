import { createContext, useContext, useState, ReactNode } from "react";

type NotifyType = "success" | "error";

interface NotifyContextType {
  notify: (msg: string, type?: NotifyType) => void;
}

const NotifyContext = createContext<NotifyContextType | undefined>(undefined);

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<NotifyType>("success");

  const notify = (msg: string, t: NotifyType = "success") => {
    setType(t);
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <NotifyContext.Provider value={{ notify }}>
      {message && (
        <div
          className={`toast ${type}`}
          style={{
            position: "fixed",
            top: "1rem",
            right: "1rem",
            background: type === "success" ? "#4caf50" : "#f44336",
            color: "white",
            padding: "0.5rem 1rem",
            borderRadius: "4px",
            zIndex: 1000,
          }}
        >
          {message}
        </div>
      )}
      {children}
    </NotifyContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useNotify() {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error("useNotify must be used within a NotifyProvider");
  return ctx.notify;
}

