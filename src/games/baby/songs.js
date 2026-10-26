import { noteFrequency } from '../../shared/music.js';

// Canciones para bebés (de las de siempre, que son de todos) para el Modo Bebé: cada botón de color toca la nota que
// sigue, así machacando botones el bebé "toca" la canción. Todas en Do, como la música de fondo.
export const SONGS = [
  {
    title: 'Estrellita, ¿dónde estás?',
    notes: 'C5 C5 G5 G5 A5 A5 G5 F5 F5 E5 E5 D5 D5 C5 G5 G5 F5 F5 E5 E5 D5 G5 G5 F5 F5 E5 E5 D5 C5 C5 G5 G5 A5 A5 G5 F5 F5 E5 E5 D5 D5 C5',
  },
  { title: 'Martinillo', notes: 'C5 D5 E5 C5 C5 D5 E5 C5 E5 F5 G5 E5 F5 G5 G5 A5 G5 F5 E5 C5 G5 A5 G5 F5 E5 C5 C5 G4 C5 C5 G4 C5' },
  {
    title: 'Witsi witsi araña',
    notes: 'G4 C5 C5 C5 D5 E5 E5 E5 D5 C5 D5 E5 C5 E5 E5 F5 G5 G5 F5 E5 F5 G5 E5 C5 C5 D5 E5 E5 D5 C5 D5 E5 C5 G4 G4 C5 C5 C5 D5 E5 E5 E5 D5 C5 D5 E5 C5',
  },
  { title: 'El viejo MacDonald', notes: 'C5 C5 C5 G4 A4 A4 G4 E5 E5 D5 D5 C5 G4 C5 C5 C5 G4 A4 A4 G4 E5 E5 D5 D5 C5' },
  { title: 'Cumpleaños feliz', notes: 'G4 G4 A4 G4 C5 B4 G4 G4 A4 G4 D5 C5 G4 G4 G5 E5 C5 B4 A4 F5 F5 E5 C5 D5 C5' },
  { title: 'Canción de cuna', notes: 'E5 E5 G5 E5 E5 G5 E5 G5 C6 B5 A5 A5 G5 D5 E5 F5 D5 D5 E5 F5 D5 F5 B5 A5 G5 B5 C6' },
].map((song) => ({ ...song, freqs: song.notes.split(' ').map(noteFrequency) }));
