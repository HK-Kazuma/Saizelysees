import React from 'react';
import { dishIconURL, hasHiRes } from '../render/sprites.js';

// hires=true のときだけ高精細版（あれば）を使う。レシピ帳専用。
export default function DishIcon({ recipe, size = 36, dim = false, hires = false }) {
  const hi = hires && hasHiRes(recipe);
  return (
    <img
      className={`dish-icon ${hi ? 'hires' : ''} ${dim ? 'dim' : ''}`}
      src={dishIconURL(recipe, 4, hi)}
      alt={recipe.name}
      width={size}
      height={Math.round((size * 9) / 12)}
      draggable={false}
    />
  );
}
