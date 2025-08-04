interface ParentInfo {
  user_id: number;
  name: string;
  email: string;
  permissions: string[];
  is_owner: boolean;
}

interface Props {
  parents: ParentInfo[];
  onRemove: (id: number) => void;
  onClose: () => void;
}

export default function ManageAccessModal({ parents, onRemove, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <h3>Parent Access</h3>
        <ul className="list">
          {parents.map((p) => (
            <li key={p.user_id}>
              {p.name} ({p.email}) [{p.permissions.join(", ")}]
              {!p.is_owner && (
                <button
                  onClick={() => onRemove(p.user_id)}
                  className="ml-05"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
