type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="brand-mark" aria-label="꿈이든 내일탐색">
      <span className="brand-symbol" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {!compact && (
        <span className="brand-words">
          <strong>꿈이든 내일탐색</strong>
          <small>반복 숙달학습</small>
        </span>
      )}
    </div>
  );
}
