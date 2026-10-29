import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { B, BLOCKS, TILES, frameOf } from './blocks.js';

// Las recetas: con Y se abre el menú de "Hacer cosas" (las de bolsillo se hacen donde sea; las demás necesitan una
// mesa de trabajo cerquita). out: lo que sale   count: cuántos   cost: [[bloque, cuántos], ...]
export const RECIPES = [
  { out: B.PLANKS, count: 4, cost: [[B.LOG, 1]] },
  { out: B.TABLE, count: 1, cost: [[B.PLANKS, 4]] },
  {
    out: B.TORCH,
    count: 4,
    cost: [
      [B.PLANKS, 1],
      [B.COAL, 1],
    ],
  },
  { out: B.LADDER, count: 3, cost: [[B.PLANKS, 3]], table: true },
  { out: B.DOOR, count: 1, cost: [[B.PLANKS, 4]], table: true },
  {
    out: B.BED,
    count: 1,
    cost: [
      [B.PLANKS, 3],
      [B.WOOL, 2],
    ],
    table: true,
  },
  { out: B.GLASS, count: 2, cost: [[B.SAND, 2]], table: true },
  { out: B.BRICKS, count: 4, cost: [[B.STONE, 4]], table: true },
];
const SLOT = 52;
const PANEL_W = RECIPES.length * (SLOT + 6) + 30;
const PANEL_H = 180;

// ¿Qué le falta a `player` para esta receta? (null si ya puede hacerla)
export function missing(recipe, player, nearTable) {
  if (recipe.table && !nearTable) return 'Necesitas una mesa de trabajo cerca';
  const lacking = recipe.cost.filter(([id, n]) => player.count(id) < n);
  if (!lacking.length) return null;
  return `Te falta: ${lacking.map(([id, n]) => `${n - player.count(id)} ${BLOCKS[id].name}`).join(' y ')}`;
}

export function craft(recipe, player) {
  for (const [id, n] of recipe.cost) player.take(id, n);
  player.give(recipe.out, recipe.count);
}

// El menú de un jugador, arriba de su barrita: ◀ ▶ (o LB / RB) escoge, A hace la cosa, B o Y cierra.
export class CraftMenu {
  constructor(scene, parent, x, bottom, color) {
    this.scene = scene;
    this.index = 0;
    this.container = scene.add.container(x, bottom - PANEL_H / 2);
    parent.add(this.container);
    const bg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, COLORS.panel, 0.96).setRounded(18).setStrokeStyle(4, color);
    this.title = scene.add.text(0, -PANEL_H / 2 + 20, '🔨 Hacer cosas', textStyle(20, hexToCss(color), { fontStyle: 'bold' })).setOrigin(0.5);
    this.container.add([bg, this.title]);
    this.slots = RECIPES.map((recipe, i) => {
      const sx = -PANEL_W / 2 + 15 + SLOT / 2 + i * (SLOT + 6);
      const box = scene.add.rectangle(sx, -22, SLOT, SLOT, 0x14112b).setRounded(10);
      const icon = scene.add.image(sx, -22, TILES, frameOf(recipe.out)).setDisplaySize(SLOT - 14, SLOT - 14);
      const count = scene.add
        .text(
          sx + SLOT / 2 - 4,
          -22 + SLOT / 2 - 2,
          `${recipe.count}`,
          textStyle(15, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }),
        )
        .setOrigin(1);
      const lock = scene.add.text(sx - SLOT / 2 + 2, -22 - SLOT / 2, '🪚', textStyle(14)).setVisible(Boolean(recipe.table));
      this.container.add([box, icon, count, lock]);
      return { box, icon, count };
    });
    this.name = scene.add.text(0, 24, '', textStyle(20, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    this.costLine = scene.add.container(0, 52);
    this.status = scene.add.text(0, 78, '', textStyle(15, TEXT.muted)).setOrigin(0.5);
    this.container.add([this.name, this.costLine, this.status]);
  }

  move(step) {
    this.index = (this.index + step + RECIPES.length) % RECIPES.length;
  }

  get recipe() {
    return RECIPES[this.index];
  }

  refresh(player, nearTable) {
    const scene = this.scene;
    RECIPES.forEach((recipe, i) => {
      const ok = !missing(recipe, player, nearTable);
      const { box, icon } = this.slots[i];
      box.setStrokeStyle(i === this.index ? 4 : 2, i === this.index ? 0xffc93c : COLORS.panelBorder);
      icon.setAlpha(ok ? 1 : 0.35);
    });
    const recipe = this.recipe;
    this.name.setText(`${recipe.count} ${BLOCKS[recipe.out].name}`);
    // El costo con dibujitos: [icono] 1 Tronco + [icono] 1 Carbón
    this.costLine.removeAll(true);
    let x = 0;
    const parts = [];
    recipe.cost.forEach(([id, n], i) => {
      if (i > 0) parts.push(scene.add.text(0, 0, '+', textStyle(18, TEXT.muted)).setOrigin(0, 0.5));
      parts.push(scene.add.image(0, 0, TILES, frameOf(id)).setDisplaySize(26, 26).setOrigin(0, 0.5));
      const have = player.count(id);
      const enough = have >= n;
      parts.push(scene.add.text(0, 0, `${n} ${BLOCKS[id].name}`, textStyle(17, enough ? TEXT.normal : '#ff8a8a', { fontStyle: 'bold' })).setOrigin(0, 0.5));
    });
    for (const part of parts) {
      part.x = x;
      x += (part.displayWidth ?? part.width) + 6;
    }
    for (const part of parts) part.x -= x / 2;
    this.costLine.add(parts);
    const why = missing(recipe, player, nearTable);
    this.status.setText(why ?? 'A = ¡hacerlo!  ·  B = cerrar').setColor(why ? '#ff8a8a' : TEXT.accent);
  }

  destroy() {
    this.container.destroy();
  }
}
