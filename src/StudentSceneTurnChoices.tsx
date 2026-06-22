import type { ReactNode } from 'react';
import {
  CheckCircle2,
  Milk,
  Package,
  Soup,
  Utensils,
  Wheat
} from 'lucide-react';
import { appAssets } from './assets';
import type { AacOption } from './domain';

export function StudentSceneTurnChoices({
  displayText,
  studentQuestion,
  options,
  selectedAacOptionId,
  onChooseOption,
  children
}: {
  displayText: string;
  studentQuestion: string;
  options: readonly AacOption[];
  selectedAacOptionId: string | null;
  onChooseOption: (option: AacOption) => void;
  children?: ReactNode;
}) {
  return (
    <div className="aac-response-panel scene-aac-panel">
      <div className="aac-panel-heading">
        <span>{displayText}</span>
        <p>{studentQuestion}</p>
      </div>
      <div className="aac-option-grid" aria-label={studentQuestion}>
        {options.map((option) => {
          const tone = getAacOptionTone(option);
          const asset = getAacOptionAsset(option);

          return (
            <button
              key={option.id}
              className={['aac-choice', tone, option.id === selectedAacOptionId ? 'active' : '']
                .filter(Boolean)
                .join(' ')}
              type="button"
              aria-pressed={option.id === selectedAacOptionId}
              onClick={() => onChooseOption(option)}
            >
              <span className={`aac-option-icon ${tone}`}>
                {asset ? <img src={asset} alt="" draggable={false} /> : getAacOptionVisual(option)}
              </span>
              <span className="aac-option-label">{option.label}</span>
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

function getAacOptionTone(option: AacOption) {
  if (option.type === 'action') return 'tone-green';
  if (option.id.includes('flour') || option.id.includes('bread')) return 'tone-wheat';
  if (option.id.includes('bowl') || option.id.includes('cup')) return 'tone-blue';
  if (option.id.includes('ingredient') || option.id.includes('dough')) return 'tone-cream';
  return 'tone-amber';
}

function getAacOptionAsset(option: AacOption) {
  const keyword = `${option.id} ${option.label}`;
  if (keyword.includes('컵') || keyword.includes('cup') || keyword.includes('bowl')) return appAssets.aac.cup;
  if (keyword.includes('도구') || keyword.includes('tool') || keyword.includes('machine') || keyword.includes('counter')) {
    return appAssets.aac.tool;
  }
  if (option.type === 'action' || keyword.includes('준비') || keyword.includes('정리') || keyword.includes('확인')) {
    return appAssets.aac.ready;
  }
  return null;
}

function getAacOptionVisual(option: AacOption) {
  const iconProps = { size: 42, strokeWidth: 2.8 };
  if (option.id.includes('mix')) return <Utensils {...iconProps} />;
  if (option.id.includes('ingredient')) return <Milk {...iconProps} />;
  if (option.id.includes('milk')) return <Milk {...iconProps} />;
  if (option.id.includes('dough')) return <Soup {...iconProps} />;
  if (option.id.includes('bowl') || option.id.includes('cup')) return <Soup {...iconProps} />;
  if (option.id.includes('flour') || option.id.includes('bread')) return <Wheat {...iconProps} />;
  if (option.id.includes('prepare') || option.id.includes('clean')) return <CheckCircle2 {...iconProps} />;
  if (option.id.includes('tool') || option.id.includes('counter')) return <Package {...iconProps} />;
  return option.type === 'action' ? <CheckCircle2 {...iconProps} /> : <Package {...iconProps} />;
}
