export type ArtemisPresentationMode = 'simple' | 'advanced';

const MODE_KEY = 'titangold.ui.artemis.presentation';
const EXPLAINER_KEY = 'titangold.ui.artemis.explainerDismissed';

export function readPresentationMode(): ArtemisPresentationMode {
  try {
    const value = localStorage.getItem(MODE_KEY);
    if (value === 'advanced') return 'advanced';
  } catch {
    /* ignore */
  }
  return 'simple';
}

export function writePresentationMode(mode: ArtemisPresentationMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function readExplainerDismissed(): boolean {
  try {
    return localStorage.getItem(EXPLAINER_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeExplainerDismissed(): void {
  try {
    localStorage.setItem(EXPLAINER_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function isSimpleView(mode: ArtemisPresentationMode | undefined): boolean {
  return mode !== 'advanced';
}
