export function Legend() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        justifyContent: 'center',
        marginTop: 12,
        fontSize: 12,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width={24} height={3}>
          <line
            x1={0} y1={1.5} x2={24} y2={1.5}
            stroke="var(--accent-brightness)"
            strokeWidth={2}
          />
        </svg>
        <span style={{ color: 'var(--accent-brightness)' }}>Brightness</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width={24} height={3}>
          <line
            x1={0} y1={1.5} x2={24} y2={1.5}
            stroke="var(--accent-colortemp)"
            strokeWidth={2}
            strokeDasharray="6 3"
          />
        </svg>
        <span style={{ color: 'var(--accent-colortemp)' }}>Color Temp</span>
      </span>
    </div>
  );
}
