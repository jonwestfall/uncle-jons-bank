import { useState } from "react";

interface Props {
  onSubmit: (perms: string[]) => void;
  onCancel: () => void;
}

const PERMISSIONS = [
  "view_transactions",
  "deposit",
  "debit",
  "freeze_child",
  "offer_cd",
];

export default function ShareChildModal({ onSubmit, onCancel }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="modal" onClick={onCancel}>
      <div
        className="modal-content"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <h3>Select Permissions</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(selected);
          }}
        >
          {PERMISSIONS.map((p) => (
            <label key={p} className="block">
              <input
                type="checkbox"
                checked={selected.includes(p)}
                onChange={(e) => {
                  if (e.target.checked) setSelected([...selected, p]);
                  else setSelected(selected.filter((x) => x !== p));
                }}
              />
              {p}
            </label>
          ))}
          <div className="mt-1">
            <button type="submit">Generate</button>
            <button type="button" onClick={onCancel} className="ml-05">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
