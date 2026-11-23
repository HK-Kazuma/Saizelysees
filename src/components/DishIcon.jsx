import React from 'react';
import { dishIconURL } from '../render/sprites.js';

export default function DishIcon({ recipe, size = 36, dim = false }) {
  return (
    <img
      className={`dish-icon ${dim ? 'dim' : ''}`}
      src={dishIconURL(recipe)}
      alt={recipe.name}
      width={size}
      height={Math.round((size * 9) / 12)}
      draggable={false}
    />
  );
}
