interface LinkedToggleProps {
  linked: boolean;
  onToggle: () => void;
  readOnly?: boolean;
}

const LINK_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const UNLINK_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export function LinkedToggle({ linked, onToggle, readOnly = false }: LinkedToggleProps) {
  return (
    <button
      className="linked-toggle"
      onClick={onToggle}
      disabled={readOnly}
      title={linked ? 'Timing is linked — click to unlink' : 'Timing is independent — click to link'}
    >
      {linked ? LINK_ICON : UNLINK_ICON}
      <span>{linked ? 'Link Times' : 'Unlink Times'}</span>
    </button>
  );
}
