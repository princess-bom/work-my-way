type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="brand-mark" aria-label="Work, My Way">
      <span className="brand-symbol" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {!compact && (
        <span className="brand-words">
          <strong>Work, My Way</strong>
          <small>Mastery learning</small>
        </span>
      )}
    </div>
  );
}
