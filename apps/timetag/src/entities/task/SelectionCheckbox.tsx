'use client';

import React from 'react';

interface SelectionCheckboxProps {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}

export function SelectionCheckbox({ checked, onChange, ariaLabel }: SelectionCheckboxProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const balancedVariant = {
	baseBorder: 'rgba(215, 222, 231, 0.78)',
	baseBackground: 'rgba(255,255,255,0.30)',
	hoverBorder: 'rgba(79, 125, 243, 0.76)',
	hoverBackground: 'rgba(79, 125, 243, 0.04)',
	selectedBorder: 'rgba(79, 125, 243, 0.82)',
	selectedBackground: 'rgba(79, 125, 243, 0.11)',
	innerBaseBorder: 'rgba(71, 85, 105, 0.76)',
	innerHoverBorder: 'rgba(51, 65, 85, 0.84)',
	innerSelectedBorder: 'rgba(63, 106, 224, 0.9)',
	innerBaseFill: 'rgba(255, 255, 255, 0.68)',
	innerHoverFill: 'rgba(255, 255, 255, 0.82)',
	innerSelectedFill: 'rgba(245, 248, 255, 0.92)',
	outerShadow: 'inset 0 1px 0 rgba(255,255,255,0.34)',
  };

  const borderColor = checked
	? balancedVariant.selectedBorder
	: isHovered
	  ? balancedVariant.hoverBorder
	  : balancedVariant.baseBorder;

  const background = checked
	? balancedVariant.selectedBackground
	: isHovered
	  ? balancedVariant.hoverBackground
	  : balancedVariant.baseBackground;

  const innerBorderColor = checked
	? balancedVariant.innerSelectedBorder
	: isHovered
	  ? balancedVariant.innerHoverBorder
	  : balancedVariant.innerBaseBorder;

  const innerFill = checked
	? balancedVariant.innerSelectedFill
	: isHovered
	  ? balancedVariant.innerHoverFill
	  : balancedVariant.innerBaseFill;

  return (
	<label
	  className="flex shrink-0 cursor-pointer items-center"
	  onMouseEnter={() => setIsHovered(true)}
	  onMouseLeave={() => setIsHovered(false)}
	>
	  <input
		type="checkbox"
		checked={checked}
		onChange={onChange}
		className="peer sr-only"
		aria-label={ariaLabel}
	  />
	  <span
		data-testid="task-selection-checkbox"
		aria-hidden="true"
		className="inline-flex items-center justify-center transition-all duration-150 ease-out peer-focus-visible:ring-4 peer-focus-visible:ring-blue-100 peer-focus-visible:ring-offset-0"
		style={{
		  width: 18,
		  height: 18,
		  borderRadius: 4,
		  border: `1px solid ${borderColor}`,
		  background,
		  boxShadow: balancedVariant.outerShadow,
		}}
	  >
		<span
		  data-testid="task-selection-checkbox-marker"
		  className="transition-all duration-150 ease-out"
		  style={{
			width: 8,
			height: 8,
			borderRadius: 2,
			border: `1px solid ${innerBorderColor}`,
			background: innerFill,
			opacity: checked ? 1 : isHovered ? 0.94 : 0.84,
			transform: checked ? 'scale(1)' : isHovered ? 'scale(0.94)' : 'scale(0.9)',
		  }}
		/>
	  </span>
	</label>
  );
}

