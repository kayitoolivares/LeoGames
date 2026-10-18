import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';

// Pantalla para escoger pista (HTML encima del 3D): ◀ ▶ escoger, A = ¡a correr!, B = regresar.
// Las pistas cerradas dicen qué hay que ganar para abrirlas.
const STYLE_ID = 'kart-choose-style';
const CSS = `
.kart-choose { position: absolute; inset: 0; background: #14112b; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 40px; color: #fff;
  font-family: "Segoe UI", "Trebuchet MS", Arial, sans-serif; }
.kart-choose h1 { margin: 0; font-size: 56px; }
.kart-choose .cards { display: flex; gap: 36px; }
.kart-choose .card { width: 340px; height: 290px; border-radius: 24px; background: #231d45; border: 4px solid #3a3170;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; box-sizing: border-box; }
.kart-choose .card.on { border-color: #ffc93c; box-shadow: 0 0 0 6px #ffc93c; }
.kart-choose .card .emoji { font-size: 96px; line-height: 1; }
.kart-choose .card b { font-size: 30px; }
.kart-choose .card.locked b, .kart-choose .card small { color: #a9a3d6; }
.kart-choose .card small { font-size: 17px; text-align: center; max-width: 290px; min-height: 22px; }
.kart-choose p { margin: 0; font-size: 24px; color: #ffc93c; }
.kart-choose .exit { position: absolute; bottom: 0; left: 50%; width: 200px; height: 6px; margin-left: -100px; }
.kart-choose .exit > div { height: 100%; width: 0; background: #fff; border-radius: 3px; }
`;

export class TrackChooser {
  // `tracks`: [{ name, emoji, open, lock }].
  constructor(stage, tracks, selected = 0) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    this.tracks = tracks;
    this.el = document.createElement('div');
    this.el.className = 'kart-choose';
    const cards = tracks
      .map(
        (track) => `<div class="card${track.open ? '' : ' locked'}"><span class="emoji">${track.emoji}</span>
          <b>${track.name}</b><small>${track.open ? '' : `🔒 ${track.lock}`}</small></div>`,
      )
      .join('');
    this.el.innerHTML = `<h1>Escoge pista</h1><div class="cards">${cards}</div>
      <p>◀ ▶ escoger  ·  A = ¡a correr!  ·  B = regresar</p><div class="exit"><div></div></div>`;
    stage.append(this.el);
    this.cards = [...this.el.querySelectorAll('.card')];
    this.exitBar = this.el.querySelector('.exit > div');
    this.select(selected);
  }

  select(index) {
    this.selected = index;
    this.cards.forEach((card, i) => card.classList.toggle('on', i === index));
    const track = this.tracks[index];
    say(track.open ? track.name : `${track.name}. Todavía no: ${track.lock}`);
  }

  move(step) {
    sfx.select();
    this.select((this.selected + step + this.tracks.length) % this.tracks.length);
  }

  setExitProgress(fraction) {
    this.exitBar.style.width = `${Math.round(fraction * 100)}%`;
  }

  destroy() {
    this.el.remove();
  }
}
