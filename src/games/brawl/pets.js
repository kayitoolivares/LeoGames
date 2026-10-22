import { sfx } from '../../shared/sound.js';
import { textStyle } from '../../ui/style.js';
import { burst, popText } from './effects.js';

// La mascota (objeto de las cajas): un perrito que sigue a su dueño un rato y les muerde a los monstruos que se
// acerquen. Cada quien tiene una a la vez; lo que muerde cuenta como golpe de su dueño.
const LIFE_MS = 20000;
const SIZE = 64;
const FOLLOW = { behind: 70, speed: 380 };
const BITE = { range: 170, everyMs: 900, speed: 700, damage: 1 };

function drawPet(scene) {
  const key = 'brawl:objeto-mascota';
  if (scene.textures.exists(key)) {
    const image = scene.add.image(0, 0, key).setOrigin(0.5, 1);
    return image.setScale(SIZE / Math.max(image.width, image.height));
  }
  return scene.add.text(0, 0, '🐶', textStyle(44)).setOrigin(0.5, 1);
}

export class Pets {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  // Le da una mascota a `owner`. Devuelve false si ya traía una.
  add(owner) {
    if (this.list.some((pet) => pet.owner === owner)) return false;
    const look = drawPet(this.scene);
    const sprite = this.scene.add.container(owner.x - owner.facing * FOLLOW.behind, owner.y, [look]);
    this.list.push({ owner, x: sprite.x, y: owner.y, look, sprite, ms: 0, biteMs: BITE.everyMs, target: null, facing: owner.facing });
    burst(this.scene, sprite.x, owner.y - 30, 0xffd84d, 8);
    return true;
  }

  clear() {
    for (const pet of this.list) pet.sprite.destroy();
    this.list = [];
  }

  update(dtMs, monsters) {
    const dt = dtMs / 1000;
    this.list = this.list.filter((pet) => {
      pet.ms += dtMs;
      pet.biteMs -= dtMs;
      const owner = pet.owner;
      if (pet.ms > LIFE_MS || owner.down) {
        popText(this.scene, pet.x, pet.y - 70, '¡Guau! 👋', '#ffffff');
        this.scene.tweens.add({ targets: pet.sprite, alpha: 0, y: pet.y - 40, duration: 400, onComplete: () => pet.sprite.destroy() });
        return false;
      }
      // Busca a quién morder cerca de él (o de su dueño); si no, sigue al dueño por atrás.
      if (!pet.target || pet.target.dead) {
        pet.target = monsters.find((m) => !m.dead && m.entered && !m.grabbedBy && Math.hypot(m.x - pet.x, (m.y - pet.y) * 1.5) < BITE.range) ?? null;
      }
      const goal = pet.target ? { x: pet.target.x - Math.sign(pet.target.x - pet.x || 1) * pet.target.radius, y: pet.target.y } : { x: owner.x - owner.facing * FOLLOW.behind, y: owner.y + 4 };
      const dx = goal.x - pet.x;
      const dy = goal.y - pet.y;
      const d = Math.hypot(dx, dy);
      const speed = pet.target ? BITE.speed : FOLLOW.speed;
      if (d > 6) {
        const step = Math.min(d, speed * dt);
        pet.x += (dx / d) * step;
        pet.y += (dy / d) * step;
        if (Math.abs(dx) > 4) pet.facing = Math.sign(dx);
      }
      if (pet.target && d < 30 && pet.biteMs <= 0) {
        pet.biteMs = BITE.everyMs;
        this.scene.hitMonster(owner, pet.target, BITE.damage, { word: '¡Guau!' });
        sfx.hit(0.3);
        if (pet.target.dead) pet.target = null;
      }
      // Trotando: brinca un poquito.
      const hop = d > 6 ? Math.abs(Math.sin(pet.ms / 90)) * 8 : 0;
      pet.sprite.setPosition(pet.x, pet.y - hop).setDepth(pet.y);
      pet.look.setFlipX?.(pet.facing < 0);
      return true;
    });
  }
}
