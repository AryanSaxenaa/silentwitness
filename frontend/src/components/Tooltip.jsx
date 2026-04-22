export default function Tooltip({ content, children, className = '' }) {
  if (!content) return children

  return (
    <span className={`tooltip ${className}`.trim()}>
      {children}
      <span className="tooltip__bubble" role="tooltip">
        {content}
      </span>
    </span>
  )
}
